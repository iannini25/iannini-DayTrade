import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSignalAlert } from "@/hooks/useSignalAlert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Copy, Check, RefreshCw, Code, ListChecks, Clock,
} from "lucide-react";
import { generateNtslCode, generateStepByStep, getSignalQuality } from "@shared/ntslGenerator";

const SIGNAL_COLORS = {
  buy: { color: "text-buy", bg: "bg-buy/10 border-buy/30", icon: TrendingUp, label: "COMPRA" },
  sell: { color: "text-sell", bg: "bg-sell/10 border-sell/30", icon: TrendingDown, label: "VENDA" },
  neutral: { color: "text-muted-foreground", bg: "bg-muted/10 border-border", icon: Minus, label: "NEUTRO" },
  avoid: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: AlertTriangle, label: "EVITAR" },
} as const;

export default function AiTrading() {
  const [copied, setCopied] = useState(false);
  const [showActivationConfirm, setShowActivationConfirm] = useState(false);

  const { data: settings, refetch: refetchSettings } = trpc.userSettings.get.useQuery();
  const { data: latestList, refetch: refetchPredictions } =
    trpc.predictions.list.useQuery({ limit: 1 });
  const generateMutation = trpc.predictions.generate.useMutation();
  const toggleLive = trpc.userSettings.toggleLiveTrading.useMutation({
    onSuccess: () => refetchSettings(),
  });

  // Auto-refresh a cada 60s
  useEffect(() => {
    const interval = setInterval(() => {
      refetchPredictions();
    }, 60_000);
    return () => clearInterval(interval);
  }, [refetchPredictions]);

  const latest = latestList?.[0];
  const context = useMemo(() => {
    if (!latest?.marketContext) return {} as any;
    try { return JSON.parse(latest.marketContext); } catch { return {}; }
  }, [latest]);

  // Alerta sonoro ao MUDAR de sinal (respeitando enableSoundAlerts)
  const { playAlert } = useSignalAlert();
  const prevSignalRef = useRef<string | null>(null);
  useEffect(() => {
    if (!settings?.enableSoundAlerts) return;
    const sig = latest?.signalType;
    const conf = latest?.confidence ?? 0;
    if (!sig) return;
    if (prevSignalRef.current === sig) return;
    prevSignalRef.current = sig;
    if (sig === "buy" && conf >= 60) {
      playAlert("buy");
      toast.success("🔔 Sinal de COMPRA detectado!", { duration: 5000 });
    } else if (sig === "sell" && conf >= 60) {
      playAlert("sell");
      toast.error("🔔 Sinal de VENDA detectado!", { duration: 5000 });
    } else if (sig === "avoid" || conf < 40) {
      playAlert("warning");
    }
  }, [latest?.signalType, latest?.confidence, settings?.enableSoundAlerts, playAlert]);

  const signalConf =
    SIGNAL_COLORS[(latest?.signalType ?? "neutral") as keyof typeof SIGNAL_COLORS] ??
    SIGNAL_COLORS.neutral;
  const SignalIcon = signalConf.icon;

  const inputsForGen = useMemo(() => {
    if (!latest) return null;
    const sl = Number(latest.stopLoss ?? 0);
    const tp = Number(latest.takeProfit ?? 0);
    const lo = Number(latest.entryZoneLow ?? 0);
    const hi = Number(latest.entryZoneHigh ?? 0);
    const entryMid = Math.round((lo + hi) / 2);
    const stopPoints = Math.abs(entryMid - sl);
    const gainPoints = Math.abs(tp - entryMid);
    return {
      entryPrice: entryMid,
      stopLoss: sl,
      takeProfit: tp,
      entryZoneLow: lo,
      entryZoneHigh: hi,
      stopPoints,
      gainPoints,
      contracts: context.suggestedContracts ?? settings?.preferredContracts ?? 5,
      signalType: (latest.signalType ?? "neutral") as "buy" | "sell" | "neutral" | "avoid",
      currentPrice: context.indicators?.currentPrice ?? entryMid,
      ema9: context.indicators?.ema9,
      ema21: context.indicators?.ema21,
      vwap: context.indicators?.vwap,
    };
  }, [latest, context, settings]);

  const ntslCode = useMemo(() => {
    if (!inputsForGen) return "";
    return generateNtslCode({
      entryPrice: inputsForGen.entryPrice,
      stopLossPoints: inputsForGen.stopPoints,
      takeProfitPoints: inputsForGen.gainPoints,
      contracts: inputsForGen.contracts,
      signalType: inputsForGen.signalType,
    });
  }, [inputsForGen]);

  const stepByStep = useMemo(() => {
    if (!inputsForGen) return [];
    return generateStepByStep({
      signalType: inputsForGen.signalType,
      currentPrice: inputsForGen.currentPrice,
      entryZoneLow: inputsForGen.entryZoneLow,
      entryZoneHigh: inputsForGen.entryZoneHigh,
      stopLoss: inputsForGen.stopLoss,
      takeProfit: inputsForGen.takeProfit,
      stopPoints: inputsForGen.stopPoints,
      gainPoints: inputsForGen.gainPoints,
      contracts: inputsForGen.contracts,
      ema9: inputsForGen.ema9,
      ema21: inputsForGen.ema21,
      vwap: inputsForGen.vwap,
    });
  }, [inputsForGen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(ntslCode);
    setCopied(true);
    toast.success("Código NTSL copiado!", {
      description: "Cole no editor de estratégias do Profit One Pro.",
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegenerate = async () => {
    try {
      const r = await generateMutation.mutateAsync({ symbol: "WIN", forceRefresh: true });
      const layer =
        r.generatedBy === "llm" ? "IA" :
        r.generatedBy === "technical" ? "técnico" : "fallback";
      toast.success(`Nova análise gerada (${layer})`);
      refetchPredictions();
    } catch (e: any) {
      toast.error("Falha ao gerar análise", { description: e?.message });
    }
  };

  const handleLiveToggle = (checked: boolean) => {
    if (checked && !settings?.enableLiveTrading) {
      setShowActivationConfirm(true);
      return;
    }
    toggleLive.mutate({ enabled: checked });
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            IA Operacional
            {settings?.enableLiveTrading && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sell/20 text-sell border border-sell/40">
                <span className="w-1.5 h-1.5 rounded-full bg-sell animate-pulse" />
                AO VIVO
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise em tempo real + código NTSL pronto para o Profit One Pro
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border"
            style={{ background: "oklch(0.10 0.01 240)" }}>
            <span className="text-xs text-muted-foreground">Live Trading</span>
            <Switch
              checked={settings?.enableLiveTrading ?? false}
              onCheckedChange={handleLiveToggle}
              disabled={toggleLive.isPending}
            />
          </div>
          <Button onClick={handleRegenerate} disabled={generateMutation.isPending} size="sm" className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Atualizar Análise
          </Button>
        </div>
      </div>

      {/* Painel de análise atual */}
      <Card className={`border ${signalConf.bg}`} style={{ background: "oklch(0.10 0.01 240)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <SignalIcon className={`w-4 h-4 ${signalConf.color}`} />
              Sinal Atual
            </span>
            {context.generatedBy && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {context.generatedBy === "llm" ? "IA-GPT" :
                  context.generatedBy === "technical" ? "TÉCNICO" : "FALLBACK"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!latest ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma análise gerada ainda. Clique em "Atualizar Análise" para começar.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Metric label="Sinal" value={signalConf.label} valueClass={signalConf.color} />
                <Metric label="Confiança" value={`${latest.confidence}%`} />
                <Metric label="Entrada" value={inputsForGen ? String(inputsForGen.entryPrice) : "—"} valueClass="text-foreground" mono />
                <Metric label="Stop" value={inputsForGen ? `${inputsForGen.stopLoss.toFixed(0)} (${inputsForGen.stopPoints}pts)` : "—"} valueClass="text-sell" mono />
                <Metric label="Alvo" value={inputsForGen ? `${inputsForGen.takeProfit.toFixed(0)} (${inputsForGen.gainPoints}pts)` : "—"} valueClass="text-buy" mono />
              </div>
              {(() => {
                const q = getSignalQuality(latest.confidence);
                return (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Qualidade do Sinal:</span>
                    <span className={`text-xs font-bold ${q.color}`}>{q.label}</span>
                    {q.warning && (
                      <span className="text-xs text-sell flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {q.warning}
                      </span>
                    )}
                  </div>
                );
              })()}
            </>
          )}
          {context.indicators && (
            <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] pt-3 border-t border-border/20">
              <SmallMetric label="EMA9" value={Number(context.indicators.ema9).toFixed(0)} />
              <SmallMetric label="EMA21" value={Number(context.indicators.ema21).toFixed(0)} />
              <SmallMetric label="VWAP" value={Number(context.indicators.vwap).toFixed(0)} />
              <SmallMetric label="RSI" value={Number(context.indicators.rsi).toFixed(0)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estratégia / strategyExplanation */}
      {context.strategyExplanation && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Estratégia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{context.strategyExplanation}</p>
          </CardContent>
        </Card>
      )}

      {/* Passo a passo (M6b) */}
      {stepByStep.length > 0 && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              O que fazer agora
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {stepByStep.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span
                    className="text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: step.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                    }}
                  />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Código NTSL (M6a) */}
      {ntslCode && (
        <Card className="border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Code className="w-4 h-4 text-primary" />
                Código NTSL para Profit One Pro
              </span>
              <Button onClick={handleCopy} size="sm" variant="outline" className="h-7 gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-buy" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="rounded-lg p-4 text-xs font-mono overflow-x-auto border border-border/30 max-h-[500px] overflow-y-auto"
              style={{ background: "oklch(0.07 0.01 240)" }}
            >
              <code className="text-foreground">{ntslCode}</code>
            </pre>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Cole este código no editor de estratégias do Profit One Pro. Os parâmetros são atualizados
              automaticamente a cada nova análise (auto-refresh a cada 60s).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Last update */}
      {latest && (
        <div className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3" />
          Análise gerada em {new Date(latest.createdAt).toLocaleString("pt-BR")}
        </div>
      )}

      {/* Modal de confirmação Live Trading */}
      <AlertDialog open={showActivationConfirm} onOpenChange={setShowActivationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Ativar operação assistida por IA?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está ativando a operação assistida por IA. Quando esta opção estiver
              ligada <strong>E</strong> as credenciais do Banco Inter estiverem configuradas e ativas,
              ordens reais serão enviadas para sua corretora.
              <br /><br />
              Sem credenciais Inter ativas, esta opção fica em modo simulação.
              <br /><br />
              <strong>Confirma?</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                toggleLive.mutate({ enabled: true });
                setShowActivationConfirm(false);
              }}
            >
              Confirmar Ativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ label, value, valueClass, mono }: { label: string; value: string; valueClass?: string; mono?: boolean }) {
  return (
    <div className="rounded-lg p-2.5 border border-border/30" style={{ background: "oklch(0.07 0.01 240)" }}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`mt-1 font-bold ${valueClass ?? "text-foreground"} ${mono ? "font-trading" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-trading font-semibold text-foreground text-xs mt-0.5">{value}</p>
    </div>
  );
}
