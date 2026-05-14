import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "sonner";
import {
  BarChart3, Brain, LineChart, Zap, LogOut, Monitor,
  TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw,
  Plus as PlusIcon, Minus as MinusIcon, ChevronUp, ChevronDown, Target, ListChecks,
} from "lucide-react";
import CandlestickChart, { type PriceLineSpec } from "@/components/trading/CandlestickChart";
import { setPreferredLayout, getRouteForLayout } from "@/lib/layoutPreference";
import { generateStepByStep } from "@shared/ntslGenerator";

type TabId = "summary" | "ai" | "chart" | "trade";

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: "summary", label: "Resumo", icon: BarChart3 },
  { id: "ai", label: "Análises", icon: Brain },
  { id: "chart", label: "Gráfico", icon: LineChart },
  { id: "trade", label: "Operar", icon: Zap },
];

const SIGNAL_COLORS = {
  buy: { color: "text-buy", bg: "bg-buy/10 border-buy/30", icon: TrendingUp, label: "COMPRA" },
  sell: { color: "text-sell", bg: "bg-sell/10 border-sell/30", icon: TrendingDown, label: "VENDA" },
  neutral: { color: "text-muted-foreground", bg: "bg-muted/10 border-border", icon: Minus, label: "NEUTRO" },
  avoid: { color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", icon: AlertTriangle, label: "EVITAR" },
} as const;

export default function MobilePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>("summary");
  const [zoom, setZoom] = useState(1);
  const [contracts, setContracts] = useState(5);
  const [showAiAutoConfirm, setShowAiAutoConfirm] = useState(false);

  // Queries
  const { data: settings, refetch: refetchSettings } = trpc.userSettings.get.useQuery();
  const { data: summary, refetch: refetchSummary } =
    trpc.trades.getDailySummary.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: predictionsList, refetch: refetchPredictions } =
    trpc.predictions.list.useQuery({ limit: 10 }, { refetchInterval: 60_000 });
  const { data: marketData } = trpc.market.getWinData.useQuery(
    { interval: "5m", range: "1d" },
    { refetchInterval: 30_000 }
  );
  const { data: activeContract } = trpc.market.getActiveWinContract.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });

  const generateMutation = trpc.predictions.generate.useMutation({
    onSuccess: (r) => {
      const layer = r.generatedBy === "llm" ? "IA" : r.generatedBy === "technical" ? "técnico" : "fallback";
      toast.success(`Nova análise (${layer})`);
      refetchPredictions();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleLive = trpc.userSettings.toggleLiveTrading.useMutation({
    onSuccess: () => refetchSettings(),
    onError: (e) => toast.error(e.message),
  });

  // Latest prediction context
  const latest = predictionsList?.[0];
  const latestContext = useMemo(() => {
    if (!latest?.marketContext) return {} as any;
    try { return JSON.parse(latest.marketContext); } catch { return {}; }
  }, [latest]);

  const handleSwitchDesktop = useCallback(() => {
    setPreferredLayout("desktop");
    setLocation(getRouteForLayout("desktop"));
  }, [setLocation]);

  return (
    <div
      className="h-screen w-screen flex flex-col bg-background overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top bar minimal */}
      <header
        className="shrink-0 h-12 px-3 flex items-center justify-between border-b border-border"
        style={{ background: "oklch(0.09 0.01 240)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-tight">Iannini Day Trade</span>
          {activeContract && (
            <Badge variant="outline" className="text-[9px] font-trading h-5">
              {activeContract.symbol}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom buttons (M2) */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.1).toFixed(2)))}
            title="Diminuir zoom"
          >
            <MinusIcon className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] font-trading w-9 text-center text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
            title="Aumentar zoom"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </Button>

          {/* Trocar para Desktop */}
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSwitchDesktop} title="Modo Desktop">
            <Monitor className="w-3.5 h-3.5" />
          </Button>
          {/* Logout */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => { logout(); setLocation("/login"); }}
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Conteúdo da aba */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, height: `${100 / zoom}%` }}
      >
        {tab === "summary" && <TabSummary summary={summary} settings={settings} />}
        {tab === "ai" && (
          <TabAi
            predictions={predictionsList ?? []}
            isGenerating={generateMutation.isPending}
            onGenerate={() => generateMutation.mutate({ symbol: "WIN", forceRefresh: true })}
          />
        )}
        {tab === "chart" && (
          <TabChart
            marketData={marketData}
            latest={latest}
            latestContext={latestContext}
          />
        )}
        {tab === "trade" && (
          <TabTrade
            latest={latest}
            latestContext={latestContext}
            contracts={contracts}
            setContracts={setContracts}
            settings={settings}
            onAiAutoToggle={(enabled) => {
              if (enabled && !settings?.enableLiveTrading) {
                setShowAiAutoConfirm(true);
              } else {
                toggleLive.mutate({ enabled });
              }
            }}
            isLivePending={toggleLive.isPending}
            onGenerate={() => generateMutation.mutate({ symbol: "WIN", forceRefresh: true })}
            isGenerating={generateMutation.isPending}
          />
        )}
      </main>

      {/* Bottom tab bar (estilo app nativo) */}
      <nav
        className="shrink-0 grid grid-cols-4 border-t border-border"
        style={{ background: "oklch(0.09 0.01 240)" }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-pressed={active}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal: confirmar IA Auto */}
      <AlertDialog open={showAiAutoConfirm} onOpenChange={setShowAiAutoConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Ativar IA Operacional?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você está ativando a operação assistida por IA. Ordens só serão enviadas para a corretora
              quando as credenciais do Banco Inter estiverem configuradas e ativas. Caso contrário,
              continuamos em modo simulação. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { toggleLive.mutate({ enabled: true }); setShowAiAutoConfirm(false); }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── ABA 1 — Resumo do Dia ────────────────────────────────────────────────────
function TabSummary({ summary, settings }: { summary: any; settings: any }) {
  const dailyLimit = settings?.dailyLimit ? Number(settings.dailyLimit) : null;
  const dailyGoal = settings?.dailyGoal ? Number(settings.dailyGoal) : null;
  const todayPnl = summary?.totalPnlBrl ?? 0;
  const goalStatus =
    dailyGoal && todayPnl >= dailyGoal ? "Atingida ✓" :
    dailyLimit && todayPnl <= -dailyLimit ? "Limite atingido!" :
    "Em andamento";

  return (
    <div className="p-3 space-y-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" /> Resumo do Dia
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <BigCard
          label="P&L Hoje"
          value={`R$ ${todayPnl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          subValue={`${(summary?.totalPnlPoints ?? 0).toFixed(0)} pts`}
          valueClass={todayPnl >= 0 ? "text-buy" : "text-sell"}
        />
        <BigCard
          label="Operações"
          value={String(summary?.tradesCount ?? 0)}
          subValue={`${summary?.winsCount ?? 0}V / ${summary?.lossesCount ?? 0}P`}
        />
        <BigCard
          label="Win Rate"
          value={`${(summary?.winRate ?? 0).toFixed(1)}%`}
          subValue={(summary?.winRate ?? 0) >= 50 ? "Acima de 50%" : "Abaixo de 50%"}
          valueClass={(summary?.winRate ?? 0) >= 50 ? "text-buy" : "text-amber-400"}
        />
        <BigCard
          label="Drawdown"
          value={`R$ ${Math.abs(summary?.maxDrawdown ?? 0).toFixed(0)}`}
          subValue={dailyLimit ? `Limite: R$ ${dailyLimit}` : "—"}
          valueClass="text-sell"
        />
        <BigCard
          label="Sequência"
          value={summary?.streak ? `${summary.streak}` : "—"}
          subValue={summary?.streakType === "win" ? "Ganhos seguidos" : summary?.streakType === "loss" ? "Perdas seguidas" : "—"}
          valueClass={summary?.streakType === "win" ? "text-buy" : "text-sell"}
        />
        <BigCard
          label="Meta"
          value={goalStatus}
          subValue={dailyGoal ? `Meta: R$ ${dailyGoal}` : "—"}
          valueClass={goalStatus.includes("✓") ? "text-buy" : goalStatus.includes("Limite") ? "text-sell" : "text-foreground"}
        />
      </div>

      {/* Equity curve simplificada */}
      {summary?.equityCurve && summary.equityCurve.length > 0 && (
        <div
          className="rounded-xl border border-border p-3"
          style={{ background: "oklch(0.10 0.01 240)" }}
        >
          <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">
            Evolução do P&L
          </p>
          <div className="flex items-end gap-0.5 h-16">
            {summary.equityCurve.slice(-30).map((p: any, i: number) => {
              const max = Math.max(...summary.equityCurve.map((q: any) => Math.abs(q.pnl)), 1);
              const h = (Math.abs(p.pnl) / max) * 100;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${p.pnl >= 0 ? "bg-buy/40" : "bg-sell/40"}`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BigCard({ label, value, subValue, valueClass }: { label: string; value: string; subValue?: string; valueClass?: string }) {
  return (
    <div
      className="rounded-xl border border-border p-3 flex flex-col gap-1"
      style={{ background: "oklch(0.10 0.01 240)" }}
    >
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold font-trading ${valueClass ?? "text-foreground"}`}>{value}</p>
      {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
    </div>
  );
}

// ─── ABA 2 — Análises da IA ──────────────────────────────────────────────────
function TabAi({ predictions, isGenerating, onGenerate }: { predictions: any[]; isGenerating: boolean; onGenerate: () => void }) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" /> Análises da IA
        </h2>
        <Button size="sm" onClick={onGenerate} disabled={isGenerating} className="gap-1.5 h-8">
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          Gerar
        </Button>
      </div>

      {predictions.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          Nenhuma análise ainda. Toque em "Gerar" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {predictions.map((p: any, idx: number) => (
            <PredictionMobileCard key={p.id} prediction={p} highlight={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionMobileCard({ prediction, highlight }: { prediction: any; highlight: boolean }) {
  const [expanded, setExpanded] = useState(highlight);
  const conf = SIGNAL_COLORS[(prediction.signalType as keyof typeof SIGNAL_COLORS) ?? "neutral"] ?? SIGNAL_COLORS.neutral;
  const Icon = conf.icon;
  let context: any = {};
  try { context = JSON.parse(prediction.marketContext ?? "{}"); } catch {}

  return (
    <div className={`rounded-xl border ${conf.bg} ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${conf.color}`} />
          <div>
            <p className={`text-sm font-bold ${conf.color}`}>{conf.label}</p>
            <p className="text-[10px] text-muted-foreground">
              Confiança: <strong className="text-foreground">{prediction.confidence}%</strong>
            </p>
          </div>
        </div>
        {context.generatedBy && (
          <Badge variant="outline" className="text-[9px] font-mono">
            {context.generatedBy === "llm" ? "IA" : context.generatedBy === "technical" ? "TÉC" : "FB"}
          </Badge>
        )}
      </div>

      {/* Confidence bar */}
      <div className="px-3 -mt-1 mb-2">
        <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
          <div
            className={`h-full ${prediction.confidence >= 70 ? "bg-buy" : prediction.confidence >= 50 ? "bg-amber-400" : "bg-sell"}`}
            style={{ width: `${prediction.confidence}%` }}
          />
        </div>
      </div>

      {/* Preço-chave */}
      <div className="px-3 grid grid-cols-3 gap-2 text-[10px] mb-2">
        <div>
          <p className="text-muted-foreground">Entrada</p>
          <p className="font-trading font-bold text-foreground">{Number(prediction.entryZoneLow).toFixed(0)}-{Number(prediction.entryZoneHigh).toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Stop</p>
          <p className="font-trading font-bold text-sell">{Number(prediction.stopLoss).toFixed(0)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Alvo</p>
          <p className="font-trading font-bold text-buy">{Number(prediction.takeProfit).toFixed(0)}</p>
        </div>
      </div>

      {/* Estratégia (M3) */}
      {context.strategyExplanation && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-left rounded-lg border border-border/30 p-2 text-[11px]"
            style={{ background: "oklch(0.07 0.01 240)" }}
          >
            <p className="text-foreground font-medium mb-0.5">Estratégia</p>
            <p className={`text-muted-foreground leading-snug ${expanded ? "" : "line-clamp-2"}`}>
              {context.strategyExplanation}
            </p>
            <p className="text-primary text-[10px] mt-1">{expanded ? "← Recolher" : "Toque para expandir →"}</p>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ABA 3 — Gráfico com linhas da IA ────────────────────────────────────────
function TabChart({ marketData, latest, latestContext }: { marketData: any; latest: any; latestContext: any }) {
  const priceLines: PriceLineSpec[] = useMemo(() => {
    if (!latest || latest.status !== "pending") return [];
    const lines: PriceLineSpec[] = [];
    const entryLow = Number(latest.entryZoneLow ?? 0);
    const entryHigh = Number(latest.entryZoneHigh ?? 0);
    const entryMid = Math.round((entryLow + entryHigh) / 2);
    const stop = Number(latest.stopLoss ?? 0);
    const target = Number(latest.takeProfit ?? 0);
    if (entryMid > 0) lines.push({ price: entryMid, color: "#3b82f6", title: "Entrada IA", lineStyle: 1 });
    if (stop > 0) lines.push({ price: stop, color: "#ef4444", title: "Stop", lineStyle: 2 });
    if (target > 0) lines.push({ price: target, color: "#22c55e", title: "Alvo", lineStyle: 2 });
    return lines;
  }, [latest]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-border">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <LineChart className="w-4 h-4 text-primary" /> Gráfico WIN · 5M
        </h2>
        {latest && latest.status === "pending" && (
          <Badge variant="outline" className="text-[9px]">
            Linhas IA ativas
          </Badge>
        )}
      </div>

      <div className="flex-1 min-h-[400px]">
        <CandlestickChart marketData={marketData} priceLines={priceLines} />
      </div>

      {latest && latestContext.strategyExplanation && (
        <div className="px-3 py-2 border-t border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
          <p className="text-[10px] text-muted-foreground line-clamp-2">{latestContext.strategyExplanation}</p>
        </div>
      )}
    </div>
  );
}

// ─── ABA 4 — Operação (Boletos) ──────────────────────────────────────────────
function TabTrade({
  latest, latestContext, contracts, setContracts, settings,
  onAiAutoToggle, isLivePending, onGenerate, isGenerating,
}: {
  latest: any; latestContext: any;
  contracts: number; setContracts: (n: number) => void;
  settings: any;
  onAiAutoToggle: (enabled: boolean) => void;
  isLivePending: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  const stepByStep = useMemo(() => {
    if (!latest) return [];
    const sl = Number(latest.stopLoss ?? 0);
    const tp = Number(latest.takeProfit ?? 0);
    const lo = Number(latest.entryZoneLow ?? 0);
    const hi = Number(latest.entryZoneHigh ?? 0);
    const entryMid = Math.round((lo + hi) / 2);
    return generateStepByStep({
      signalType: latest.signalType ?? "neutral",
      currentPrice: latestContext.indicators?.currentPrice ?? entryMid,
      entryZoneLow: lo,
      entryZoneHigh: hi,
      stopLoss: sl,
      takeProfit: tp,
      stopPoints: Math.abs(entryMid - sl),
      gainPoints: Math.abs(tp - entryMid),
      contracts: latestContext.suggestedContracts ?? contracts,
      ema9: latestContext.indicators?.ema9,
      ema21: latestContext.indicators?.ema21,
      vwap: latestContext.indicators?.vwap,
    });
  }, [latest, latestContext, contracts]);

  const conf = SIGNAL_COLORS[(latest?.signalType as keyof typeof SIGNAL_COLORS) ?? "neutral"] ?? SIGNAL_COLORS.neutral;
  const tradingPaused = settings?.tradingPaused;
  const canTrade = !tradingPaused && latest?.signalType !== "avoid";

  return (
    <div className="flex flex-col h-full">
      {/* Painel da IA (parte superior) */}
      <div className="px-3 py-3 border-b border-border" style={{ background: "oklch(0.10 0.01 240)" }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            Orientação da IA
          </h2>
          <Button size="sm" onClick={onGenerate} disabled={isGenerating} variant="ghost" className="gap-1 h-7 text-xs">
            <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {!latest ? (
          <p className="text-xs text-muted-foreground">Toque em "Atualizar" para gerar a primeira análise.</p>
        ) : (
          <>
            <div className={`rounded-lg border ${conf.bg} p-2.5 mb-2`}>
              <div className="flex items-center justify-between text-xs">
                <span className={`font-bold ${conf.color}`}>{conf.label} · {latest.confidence}%</span>
                {latestContext.generatedBy && (
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {latestContext.generatedBy === "llm" ? "IA" : latestContext.generatedBy === "technical" ? "TÉC" : "FB"}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1.5 text-[10px]">
                <Mini label="Entrada" value={`${Math.round((Number(latest.entryZoneLow) + Number(latest.entryZoneHigh)) / 2)}`} />
                <Mini label="Stop" value={Number(latest.stopLoss).toFixed(0)} cls="text-sell" />
                <Mini label="Alvo" value={Number(latest.takeProfit).toFixed(0)} cls="text-buy" />
              </div>
            </div>

            {/* Passo a passo resumido (M6b) */}
            {stepByStep.length > 0 && (
              <details className="rounded-lg border border-border/30 text-xs">
                <summary className="px-2.5 py-1.5 font-medium text-foreground cursor-pointer">
                  O que fazer agora ({stepByStep.length} passos)
                </summary>
                <ol className="px-3 py-2 space-y-1.5 text-[11px]">
                  {stepByStep.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span
                        className="text-muted-foreground leading-snug"
                        dangerouslySetInnerHTML={{
                          __html: s.replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>'),
                        }}
                      />
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </>
        )}
      </div>

      {/* Boletos (parte inferior) */}
      <div className="px-3 py-3 flex-1 flex flex-col gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Execução
        </h2>

        {/* Toggle IA Auto */}
        <div className="flex items-center justify-between rounded-lg border border-border p-2.5"
          style={{ background: "oklch(0.10 0.01 240)" }}>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">Operação Automática (IA)</p>
              <p className="text-[10px] text-muted-foreground">Ordens só vão à corretora se Inter ativo</p>
            </div>
          </div>
          <Switch
            checked={settings?.enableLiveTrading ?? false}
            onCheckedChange={onAiAutoToggle}
            disabled={isLivePending}
          />
        </div>

        {/* Contadores grandes */}
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-12 p-0 shrink-0"
            onClick={() => setContracts(Math.max(1, contracts - 1))}
          >
            <MinusIcon className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center py-2 rounded-lg border border-border"
            style={{ background: "oklch(0.10 0.01 240)" }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contratos</p>
            <p className="font-trading text-2xl font-bold text-foreground">{contracts}</p>
          </div>
          <Button
            size="lg"
            variant="outline"
            className="h-12 w-12 p-0 shrink-0"
            onClick={() => setContracts(Math.min(15, contracts + 1))}
          >
            <PlusIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Botões grandes para polegar */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-14 text-base font-semibold gap-2"
            style={{ background: canTrade ? "oklch(0.65 0.18 145)" : "oklch(0.3 0.05 145)", color: "white" }}
            disabled={!canTrade}
            onClick={() => toast.info("Em modo simulação — ordem registrada localmente.")}
          >
            <ChevronUp className="w-5 h-5" /> COMPRAR
          </Button>
          <Button
            className="h-14 text-base font-semibold gap-2"
            style={{ background: canTrade ? "oklch(0.60 0.22 25)" : "oklch(0.3 0.08 25)", color: "white" }}
            disabled={!canTrade}
            onClick={() => toast.info("Em modo simulação — ordem registrada localmente.")}
          >
            <ChevronDown className="w-5 h-5" /> VENDER
          </Button>
        </div>

        {tradingPaused && (
          <p className="text-xs text-center text-amber-400 mt-1">
            ⏸ Operações pausadas no Workspace
          </p>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-trading font-semibold ${cls ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
