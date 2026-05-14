import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Brain, TrendingUp, TrendingDown, Minus, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Clock, Target,
  Shield, Zap, BarChart3, ChevronDown, ChevronUp, Settings2,
} from "lucide-react";

const SIGNAL_CONFIG = {
  buy: { label: "COMPRA", color: "text-buy", bg: "bg-buy/10 border-buy/30", icon: TrendingUp, badge: "bg-buy/20 text-buy border-buy/30" },
  sell: { label: "VENDA", color: "text-sell", bg: "bg-sell/10 border-sell/30", icon: TrendingDown, badge: "bg-sell/20 text-sell border-sell/30" },
  neutral: { label: "NEUTRO", color: "text-muted-foreground", bg: "bg-muted/10 border-border", icon: Minus, badge: "bg-muted/20 text-muted-foreground border-border" },
  avoid: { label: "EVITAR", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: AlertTriangle, badge: "bg-amber-400/20 text-amber-400 border-amber-400/30" },
};

const RISK_CONFIG = {
  low: { label: "Baixo", color: "text-buy", icon: Shield },
  medium: { label: "Médio", color: "text-amber-400", icon: Zap },
  high: { label: "Alto", color: "text-sell", icon: AlertTriangle },
};

const STATUS_CONFIG = {
  pending: { label: "Aguardando", color: "text-muted-foreground" },
  executed: { label: "Executada", color: "text-blue-400" },
  ignored: { label: "Ignorada", color: "text-muted-foreground" },
  won: { label: "Vencedora ✓", color: "text-buy" },
  lost: { label: "Perdedora ✗", color: "text-sell" },
  expired: { label: "Expirada", color: "text-muted-foreground" },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 70 ? "bg-buy" : value >= 50 ? "bg-amber-400" : "bg-sell";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${value >= 70 ? "text-buy" : value >= 50 ? "text-amber-400" : "text-sell"}`}>
        {value}%
      </span>
    </div>
  );
}

function PredictionCard({ prediction, onUpdateStatus }: {
  prediction: any;
  onUpdateStatus: (id: number, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const signal = SIGNAL_CONFIG[prediction.signalType as keyof typeof SIGNAL_CONFIG] ?? SIGNAL_CONFIG.neutral;
  const risk = RISK_CONFIG[prediction.riskLevel as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.medium;
  const status = STATUS_CONFIG[prediction.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
  const SignalIcon = signal.icon;
  const RiskIcon = risk.icon;

  let context: any = {};
  try { context = JSON.parse(prediction.marketContext ?? "{}"); } catch {}

  const isPending = prediction.status === "pending";
  const entryLow = Number(prediction.entryZoneLow ?? 0);
  const entryHigh = Number(prediction.entryZoneHigh ?? 0);
  const sl = Number(prediction.stopLoss ?? 0);
  const tp = Number(prediction.takeProfit ?? 0);
  const entryMid = (entryLow + entryHigh) / 2;
  const riskPoints = Math.abs(entryMid - sl);
  const rewardPoints = Math.abs(tp - entryMid);
  const rr = riskPoints > 0 ? (rewardPoints / riskPoints).toFixed(2) : "—";

  return (
    <div className={`rounded-xl border ${signal.bg} overflow-hidden transition-all`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${signal.bg} border ${signal.bg}`}>
              <SignalIcon className={`w-5 h-5 ${signal.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold font-trading ${signal.color}`}>{signal.label}</span>
                <Badge variant="outline" className={`text-[10px] ${signal.badge}`}>{prediction.symbol}</Badge>
                {prediction.status !== "pending" && (
                  <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <RiskIcon className={`w-3 h-3 ${risk.color}`} />
                <span className={`text-xs ${risk.color}`}>Risco {risk.label}</span>
                <span className="text-muted-foreground text-xs">·</span>
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(prediction.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {context.validUntil && ` · válido até ${context.validUntil}`}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground mb-1">Confiança</div>
            <div className="w-24">
              <ConfidenceBar value={prediction.confidence} />
            </div>
          </div>
        </div>

        {/* Níveis de preço */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-lg p-2 text-center" style={{ background: "oklch(0.12 0.01 240)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Zona Entrada</p>
            <p className="font-trading font-bold text-sm text-foreground mt-0.5">
              {entryLow.toLocaleString("pt-BR")} – {entryHigh.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "oklch(0.12 0.01 240)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stop Loss</p>
            <p className="font-trading font-bold text-sm text-sell mt-0.5">{sl.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "oklch(0.12 0.01 240)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Take Profit</p>
            <p className="font-trading font-bold text-sm text-buy mt-0.5">{tp.toLocaleString("pt-BR")}</p>
          </div>
          <div className="rounded-lg p-2 text-center" style={{ background: "oklch(0.12 0.01 240)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">R:R</p>
            <p className={`font-trading font-bold text-sm mt-0.5 ${Number(rr) >= 1.5 ? "text-buy" : "text-amber-400"}`}>1:{rr}</p>
          </div>
        </div>

        {/* Sugestão de contratos */}
        {context.suggestedContracts && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Sugestão: <strong className="text-foreground">{context.suggestedContracts} contratos</strong></span>
            {context.marketBias && (
              <>
                <span>·</span>
                <span>Viés: <strong className={context.marketBias === "bullish" ? "text-buy" : context.marketBias === "bearish" ? "text-sell" : "text-muted-foreground"}>
                  {context.marketBias === "bullish" ? "Alta" : context.marketBias === "bearish" ? "Baixa" : "Lateral"}
                </strong></span>
              </>
            )}
          </div>
        )}

        {/* Avisos */}
        {context.warnings && context.warnings.length > 0 && (
          <div className="mt-3 space-y-1">
            {context.warnings.map((w: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Estratégia (sempre visível, M3) */}
      {context.strategyExplanation && (
        <div className="px-4 pb-3 -mt-1">
          <div
            className="rounded-lg border border-border/30 p-3 text-xs"
            style={{ background: "oklch(0.07 0.01 240)" }}
          >
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Brain className="w-3 h-3" />
              Estratégia
              {context.generatedBy && (
                <Badge variant="outline" className="text-[9px] font-mono ml-auto">
                  {context.generatedBy === "llm" ? "IA-GPT" :
                   context.generatedBy === "technical" ? "TÉCNICO" :
                   "FALLBACK"}
                </Badge>
              )}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {context.strategyExplanation}
            </p>
          </div>
        </div>
      )}

      {/* Análise expandível */}
      <div className="border-t border-border/30">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Ver análise completa</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <div className="px-4 pb-4 text-sm text-muted-foreground prose prose-invert prose-sm max-w-none">
            <Streamdown>{prediction.reasoning ?? ""}</Streamdown>
            {context.keyLevels && context.keyLevels.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Níveis-Chave</p>
                <div className="flex flex-wrap gap-1.5">
                  {context.keyLevels.map((level: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-trading">{level}</Badge>
                  ))}
                </div>
              </div>
            )}
            {context.indicators && (
              <div className="mt-3 grid grid-cols-4 gap-2 text-[10px]">
                <div>
                  <p className="text-muted-foreground">EMA9</p>
                  <p className="font-trading font-semibold text-foreground">{Number(context.indicators.ema9).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">EMA21</p>
                  <p className="font-trading font-semibold text-foreground">{Number(context.indicators.ema21).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">VWAP</p>
                  <p className="font-trading font-semibold text-foreground">{Number(context.indicators.vwap).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">RSI</p>
                  <p className="font-trading font-semibold text-foreground">{Number(context.indicators.rsi).toFixed(0)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Ações */}
      {isPending && (
        <div className="border-t border-border/30 px-4 py-3 flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-buy/20 hover:bg-buy/30 text-buy border border-buy/30"
            variant="outline"
            onClick={() => onUpdateStatus(prediction.id, "executed")}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Executei
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs bg-sell/10 hover:bg-sell/20 text-sell border border-sell/30"
            variant="outline"
            onClick={() => onUpdateStatus(prediction.id, "ignored")}
          >
            <XCircle className="w-3.5 h-3.5 mr-1.5" /> Ignorar
          </Button>
          <Button
            size="sm"
            className="flex-1 h-8 text-xs"
            variant="outline"
            onClick={() => onUpdateStatus(prediction.id, "won")}
          >
            <Target className="w-3.5 h-3.5 mr-1.5" /> Ganhou
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Predictions() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: predictions, refetch } = trpc.predictions.list.useQuery({ limit: 20 });
  const { data: settings } = trpc.userSettings.get.useQuery();
  const generateMutation = trpc.predictions.generate.useMutation();
  const updateStatusMutation = trpc.predictions.updateStatus.useMutation();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({ symbol: "WIN", forceRefresh: true });
      const sourceLabel =
        result.generatedBy === "llm"
          ? "Análise com IA (GPT)"
          : result.generatedBy === "technical"
            ? "Análise técnica determinística"
            : "Fallback (sem dados de mercado)";
      toast.success("Nova análise gerada", { description: sourceLabel });
      refetch();
    } catch (err: any) {
      toast.error("Erro ao gerar análise", { description: err?.message ?? "Tente novamente em alguns segundos." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status: status as any });
      toast.success("Status atualizado");
      refetch();
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const pendingCount = predictions?.filter(p => p.status === "pending").length ?? 0;
  const wonCount = predictions?.filter(p => p.status === "won").length ?? 0;
  const lostCount = predictions?.filter(p => p.status === "lost").length ?? 0;
  const aiWinRate = (wonCount + lostCount) > 0
    ? Math.round((wonCount / (wonCount + lostCount)) * 100)
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Análise Preditiva
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sinais gerados por IA com base em dados técnicos e contexto de mercado em tempo real
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="gap-2"
        >
          {isGenerating
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando...</>
            : <><Brain className="w-4 h-4" /> Gerar Análise</>}
        </Button>
      </div>

      {/* Métricas da IA */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sinais Hoje", value: predictions?.length ?? 0, color: "text-foreground" },
          { label: "Aguardando", value: pendingCount, color: "text-amber-400" },
          { label: "Vencedoras", value: wonCount, color: "text-buy" },
          { label: "Taxa Acerto IA", value: aiWinRate !== null ? `${aiWinRate}%` : "—", color: aiWinRate !== null && aiWinRate >= 60 ? "text-buy" : "text-muted-foreground" },
        ].map((m) => (
          <Card key={m.label} className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className={`text-2xl font-bold font-trading mt-1 ${m.color}`}>{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Perfil do usuário */}
      {settings && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Settings2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Perfil ativo:</span>
                <Badge variant="outline" className={
                  settings.riskProfile === "conservative" ? "border-buy/30 text-buy" :
                  settings.riskProfile === "aggressive" ? "border-sell/30 text-sell" :
                  "border-amber-400/30 text-amber-400"
                }>
                  {settings.riskProfile === "conservative" ? "Conservador" :
                   settings.riskProfile === "aggressive" ? "Agressivo" : "Moderado"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Stop: {settings.stopLossPoints} pts · Gain: {settings.takeProfitPoints} pts · {settings.preferredContracts} contratos
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Meta: R$ {Number(settings.dailyGoal).toLocaleString("pt-BR")} · Limite: R$ {Number(settings.dailyLimit).toLocaleString("pt-BR")}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator className="opacity-20" />

      {/* Lista de predições */}
      {!predictions || predictions.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Nenhuma análise gerada ainda</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Clique em "Gerar Análise" para que a IA analise o mercado e sugira uma operação
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} className="mt-4 gap-2" variant="outline">
            <Brain className="w-4 h-4" /> Gerar Primeira Análise
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {predictions.map((p) => (
            <PredictionCard key={p.id} prediction={p} onUpdateStatus={handleUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
