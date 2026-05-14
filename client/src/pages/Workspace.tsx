import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  PanelGroup, Panel, PanelResizeHandle
} from "react-resizable-panels";
import {
  TrendingUp, Activity, BarChart2,
  Settings, LogOut, Calculator, Calendar, BookOpen,
  ChevronUp, ChevronDown, Wifi, WifiOff, Menu, X, LayoutDashboard,
  Pause, Play, Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { showVwapCrossToast } from "@/components/trading/TradingToast";
import CandlestickChart from "@/components/trading/CandlestickChart";
import SuperDOM from "@/components/trading/SuperDOM";
import TimesAndTrades from "@/components/trading/TimesAndTrades";
import AlertsPanel from "@/components/trading/AlertsPanel";
import DailySummaryPanel from "@/components/trading/DailySummaryPanel";
import PaperTradingBanner from "@/components/trading/PaperTradingBanner";
import { useTradingAlerts } from "@/hooks/useTradingAlerts";
import { useTradingAutomations, calculateRSI } from "@/hooks/useTradingAutomations";

// Tipo do payload de trade encerrado vindo do SuperDOM
export interface TradeClosedPayload {
  side: "buy" | "sell";
  contracts: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  pnlPoints: number;
  pnlBrl: number;
  reason: "take_profit" | "stop_loss" | "manual";
  durationMs: number;
  entryAt: string; // ISO string
}

export default function Workspace() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  // Hook de alertas sonoros
  const {
    settings: alertSettings,
    playAlert,
    toggleAlert,
    updateAlertConfig,
    updateMasterVolume,
    resetToDefaults,
    testAlert,
  } = useTradingAlerts();

  // Mutation para registrar trade encerrado
  const utils = trpc.useUtils();
  const registerTrade = trpc.trades.registerTrade.useMutation({
    onSuccess: () => {
      // Invalidar o resumo diário para forçar refetch
      utils.trades.getDailySummary.invalidate();
      utils.performance.getSummary.invalidate();
    },
    onError: (err) => {
      console.error("[registerTrade]", err);
    },
  });

  // Callback chamado pelo SuperDOM ao encerrar uma posição
  const handleTradeClose = useCallback((payload: TradeClosedPayload) => {
    registerTrade.mutate({
      symbol: "WIN",
      side: payload.side,
      contracts: payload.contracts,
      entryPrice: payload.entryPrice,
      exitPrice: payload.exitPrice,
      stopLoss: payload.stopLoss,
      takeProfit: payload.takeProfit,
      pnlPoints: payload.pnlPoints,
      pnlBrl: payload.pnlBrl,
      reason: payload.reason,
      durationMs: payload.durationMs,
      entryAt: payload.entryAt,
    });
  }, [registerTrade]);

  // Atualizar relógio
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const totalMin = now.getHours() * 60 + now.getMinutes();
      setIsMarketOpen(totalMin >= 540 && totalMin < 1080);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: marketData } = trpc.market.getWinData.useQuery(
    { interval: "5m", range: "1d" },
    { refetchInterval: 30000, staleTime: 25000 }
  );

  // Contrato WIN ativo (ex.: WINM26) — atualiza só de hora em hora
  const { data: activeContract } = trpc.market.getActiveWinContract.useQuery(
    undefined,
    { staleTime: 60 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const { data: summary } = trpc.performance.getSummary.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );

  // Extrair preço atual
  const chartResult = (marketData as any)?.data?.chart?.result?.[0];
  const meta = chartResult?.meta;
  const currentPrice = meta?.regularMarketPrice ?? 0;
  const prevClose = meta?.previousClose ?? meta?.chartPreviousClose ?? 0;
  const priceChange = currentPrice - prevClose;
  const priceChangePct = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;
  const isPositive = priceChange >= 0;

  // Extrair último valor VWAP para os toasts ricos
  const getLastVwap = useCallback((): number => {
    const result = (marketData as any)?.data?.chart?.result?.[0];
    if (!result) return 0;
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    const highs: number[] = result.indicators?.quote?.[0]?.high ?? [];
    const lows: number[] = result.indicators?.quote?.[0]?.low ?? [];
    const volumes: number[] = result.indicators?.quote?.[0]?.volume ?? [];
    if (!closes.length) return 0;
    let cumPV = 0, cumVol = 0;
    for (let i = 0; i < closes.length; i++) {
      const tp = ((highs[i] ?? 0) + (lows[i] ?? 0) + (closes[i] ?? 0)) / 3;
      cumPV += tp * (volumes[i] ?? 0);
      cumVol += volumes[i] ?? 0;
    }
    return cumVol > 0 ? cumPV / cumVol : 0;
  }, [marketData]);

  // Hook de automações inteligentes (EMA cross, RSI, horários críticos, pausa)
  const { data: userSettings } = trpc.userSettings.get.useQuery();

  // Kill switch
  const toggleTradingPause = trpc.userSettings.toggleTradingPause.useMutation({
    onSuccess: (data) => {
      utils.userSettings.get.invalidate();
      toast[data.tradingPaused ? "warning" : "success"](
        data.tradingPaused
          ? "Operações pausadas. Novos envios estão bloqueados."
          : "Operações retomadas."
      );
    },
    onError: () => toast.error("Falha ao alternar pausa de operações."),
  });

  const { checkIndicators, checkDailySummary } = useTradingAutomations({
    emaCrossEnabled: true,
    rsiAlertsEnabled: true,
    pauseSuggestionEnabled: true,
    pauseAfterLosses: userSettings?.pauseAfterLosses ?? 3,
    goalAlertEnabled: true,
    dailyGoal: userSettings?.dailyGoal ? Number(userSettings.dailyGoal) : 2000,
    criticalHoursEnabled: true,
  });

  // Callback chamado pelo gráfico quando novos dados chegam (EMA + RSI)
  const handleChartUpdate = useCallback((ema9: number[], ema21: number[], closes: number[], price: number) => {
    const rsi = calculateRSI(closes);
    checkIndicators({ ema9, ema21, rsi, currentPrice: price });
  }, [checkIndicators]);

  // Verificar resumo diário sempre que atualizar
  const { data: dailySummary } = trpc.trades.getDailySummary.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );
  useEffect(() => {
    if (dailySummary) {
      checkDailySummary({
        totalPnlBrl: dailySummary.totalPnlBrl,
        lossesCount: dailySummary.lossesCount,
        winsCount: dailySummary.winsCount,
        streak: dailySummary.streak,
        streakType: dailySummary.streakType,
      });
    }
  }, [dailySummary, checkDailySummary]);

  // ─── Proteções operacionais ──────────────────────────────────────────────
  const dailyLimit = userSettings?.dailyLimit ? Number(userSettings.dailyLimit) : null;
  const dailyGoal = userSettings?.dailyGoal ? Number(userSettings.dailyGoal) : null;
  const todayPnl = dailySummary?.totalPnlBrl ?? 0;

  const tradingDisabled: { reason: string } | null = userSettings?.tradingPaused
    ? { reason: "Operações pausadas pelo usuário. Reative no botão do header para voltar a operar." }
    : dailyLimit !== null && todayPnl <= -dailyLimit
      ? { reason: `Limite diário de perda atingido (-R$ ${dailyLimit.toLocaleString("pt-BR")}). Operações bloqueadas até o próximo pregão.` }
      : null;

  // Modal de meta atingida (uma vez por sessão)
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const goalShownRef = useRef(false);
  useEffect(() => {
    if (!dailyGoal || goalShownRef.current) return;
    if (todayPnl >= dailyGoal) {
      goalShownRef.current = true;
      setGoalDialogOpen(true);
    }
  }, [todayPnl, dailyGoal]);

  // Callbacks de cruzamento VWAP
  const handleVwapCrossUp = useCallback(() => {
    playAlert("vwap_cross_up");
    const vwap = getLastVwap();
    const divergence = currentPrice > 0 && vwap > 0 ? currentPrice - vwap : 0;
    showVwapCrossToast({ direction: "up", currentPrice, vwapValue: vwap, divergencePoints: divergence });
  }, [playAlert, currentPrice, getLastVwap]);

  const handleVwapCrossDown = useCallback(() => {
    playAlert("vwap_cross_down");
    const vwap = getLastVwap();
    const divergence = currentPrice > 0 && vwap > 0 ? vwap - currentPrice : 0;
    showVwapCrossToast({ direction: "down", currentPrice, vwapValue: vwap, divergencePoints: divergence });
  }, [playAlert, currentPrice, getLastVwap]);

  const navItems = [
    { icon: BarChart2, label: "Workspace", path: "/workspace", active: true },
    { icon: Activity, label: "Performance", path: "/dashboard" },
    { icon: Calculator, label: "Calculadora", path: "/risk-calculator" },
    { icon: Settings, label: "Config. OCO", path: "/oco-config" },
    { icon: Calendar, label: "Calendário", path: "/economic-calendar" },
    { icon: BookOpen, label: "Guia Inter API", path: "/banco-inter-guide" },
  ];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top Bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0"
        style={{ background: "oklch(0.09 0.01 240)", zIndex: 50 }}>
        <div className="flex items-center gap-3">
          <button className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
              <TrendingUp className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:block">Iannini Day Trade</span>
          </div>

          {/* Preço WIN com contrato ativo */}
          {currentPrice > 0 && (
            <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
              <span
                className="text-xs font-medium flex items-center gap-1"
                title={
                  activeContract
                    ? `Vencimento: ${new Date(activeContract.expiry).toLocaleDateString("pt-BR")} (${activeContract.daysToExpiry} dia${activeContract.daysToExpiry !== 1 ? "s" : ""})`
                    : ""
                }
              >
                <span className={activeContract?.nearExpiry ? "text-amber-400" : "text-muted-foreground"}>
                  {activeContract?.symbol ?? "WIN"}
                </span>
                {activeContract && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${activeContract.nearExpiry ? "bg-amber-400 animate-pulse" : "bg-buy"}`}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="font-trading text-sm font-semibold text-foreground">
                {currentPrice.toLocaleString("pt-BR")}
              </span>
              <span className={`font-trading text-xs font-medium flex items-center gap-0.5 ${isPositive ? "text-buy" : "text-sell"}`}>
                {isPositive ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {Math.abs(priceChangePct).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* P&L do dia no header */}
          {summary && (
            <div className="hidden md:flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">P&L Hoje:</span>
              <span className={`font-trading font-semibold ${summary.todayPnl >= 0 ? "text-profit" : "text-loss"}`}>
                {summary.todayPnl >= 0 ? "+" : ""}R$ {summary.todayPnl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Kill Switch — Pausar / Retomar operações */}
          <Button
            variant={userSettings?.tradingPaused ? "destructive" : "ghost"}
            size="sm"
            className={`h-7 px-2 gap-1.5 text-xs ${
              userSettings?.tradingPaused
                ? "font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => toggleTradingPause.mutate()}
            disabled={toggleTradingPause.isPending}
            title={userSettings?.tradingPaused ? "Retomar operações" : "Pausar todas as operações"}>
            {userSettings?.tradingPaused
              ? (<><Play className="w-3.5 h-3.5" /><span className="hidden sm:block">RETOMAR</span></>)
              : (<><Pause className="w-3.5 h-3.5" /><span className="hidden sm:block">Pausar</span></>)}
          </Button>

          {/* Toggle do painel de resumo */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 gap-1.5 text-xs ${summaryOpen ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => setSummaryOpen(v => !v)}
            title="Painel de Resumo Diário">
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Resumo</span>
          </Button>

          {/* Painel de Alertas Sonoros */}
          <AlertsPanel
            settings={alertSettings}
            onToggle={toggleAlert}
            onUpdateConfig={updateAlertConfig}
            onUpdateMasterVolume={updateMasterVolume}
            onReset={resetToDefaults}
            onTest={testAlert}
          />

          {/* Status do mercado */}
          <div className={`flex items-center gap-1.5 text-xs ${isMarketOpen ? "text-buy" : "text-muted-foreground"}`}>
            {isMarketOpen ? <Wifi className="w-3 h-3 animate-live" /> : <WifiOff className="w-3 h-3" />}
            <span className="hidden sm:block">{isMarketOpen ? "Mercado Aberto" : "Fechado"}</span>
          </div>

          {/* Relógio */}
          <div className="font-trading text-xs text-muted-foreground">
            {currentTime.toLocaleTimeString("pt-BR")}
          </div>

          {/* User */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:block">{user?.name?.split(" ")[0]}</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => { logout(); setLocation("/login"); }}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Banner de Paper Trading / Live Trading */}
      <PaperTradingBanner />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "flex" : "hidden"} lg:flex flex-col w-48 border-r border-border shrink-0 py-3 gap-1`}
          style={{ background: "oklch(0.09 0.01 240)" }}>
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}
              className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer
                ${item.active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              style={item.active ? { background: "oklch(0.65 0.18 195 / 0.15)", color: "oklch(0.65 0.18 195)" } : {}}>
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </aside>

        {/* Main area: trading panels + summary panel */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Trading panels */}
          <main className="flex-1 overflow-hidden p-2 min-h-0">
            <PanelGroup direction="horizontal" className="h-full gap-2">
              {/* Left: Chart + Volume */}
              <Panel defaultSize={65} minSize={40}>
                <PanelGroup direction="vertical" className="h-full gap-2">
                  <Panel defaultSize={80} minSize={50}>
                    <div className="h-full rounded-lg border border-border overflow-hidden flex flex-col"
                      style={{ background: "oklch(0.09 0.01 240)" }}>
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0"
                        style={{ background: "oklch(0.11 0.01 240)" }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">WIN · 5M</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-trading">
                            {isMarketOpen ? "AO VIVO" : "FECHADO"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 rounded" style={{ background: "oklch(0.75 0.15 60)" }} />
                            <span className="text-muted-foreground">VWAP</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 rounded" style={{ background: "oklch(0.65 0.18 195)" }} />
                            <span className="text-muted-foreground">EMA9</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-0.5 rounded" style={{ background: "oklch(0.70 0.15 300)" }} />
                            <span className="text-muted-foreground">EMA21</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-h-0">
                        <CandlestickChart
                          marketData={marketData}
                          onVwapCrossUp={handleVwapCrossUp}
                          onVwapCrossDown={handleVwapCrossDown}
                        />
                      </div>
                    </div>
                  </Panel>
                  <PanelResizeHandle className="h-1 rounded-full transition-colors hover:bg-primary"
                    style={{ background: "oklch(0.18 0.01 240)" }} />
                  <Panel defaultSize={20} minSize={15}>
                    <div className="h-full rounded-lg border border-border overflow-hidden flex flex-col"
                      style={{ background: "oklch(0.09 0.01 240)" }}>
                      <div className="px-3 py-2 border-b border-border shrink-0"
                        style={{ background: "oklch(0.11 0.01 240)" }}>
                        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">Volume Financeiro</span>
                      </div>
                      <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                        Integrado ao gráfico principal
                      </div>
                    </div>
                  </Panel>
                </PanelGroup>
              </Panel>

              <PanelResizeHandle className="w-1 rounded-full transition-colors hover:bg-primary"
                style={{ background: "oklch(0.18 0.01 240)" }} />

              {/* Right: SuperDOM + Times & Trades */}
              <Panel defaultSize={35} minSize={25}>
                <PanelGroup direction="vertical" className="h-full gap-2">
                  <Panel defaultSize={55} minSize={35}>
                    <SuperDOM
                      currentPrice={currentPrice}
                      disabled={tradingDisabled}
                      requireConfirmation={userSettings?.requireOrderConfirmation ?? true}
                      onTradeClose={handleTradeClose}
                    />
                  </Panel>
                  <PanelResizeHandle className="h-1 rounded-full transition-colors hover:bg-primary"
                    style={{ background: "oklch(0.18 0.01 240)" }} />
                  <Panel defaultSize={45} minSize={30}>
                    <TimesAndTrades currentPrice={currentPrice} />
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </main>

          {/* Painel de Resumo Diário — colapsável na parte inferior */}
          {summaryOpen && (
            <div className="shrink-0 max-h-72 overflow-y-auto border-t border-border"
              style={{ background: "oklch(0.09 0.01 240)" }}>
              <DailySummaryPanel collapsible={false} />
            </div>
          )}
        </div>
      </div>

      {/* Modal: meta diária atingida */}
      <AlertDialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-profit" />
              Meta diária atingida
            </AlertDialogTitle>
            <AlertDialogDescription>
              Parabéns! Você atingiu sua meta de
              {dailyGoal ? ` R$ ${dailyGoal.toLocaleString("pt-BR")} ` : " hoje "}
              com um P&L de R$ {todayPnl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.
              <br /><br />
              <strong className="text-foreground">Recomendamos encerrar o dia.</strong>{" "}
              Manter a disciplina é tão importante quanto o ganho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setGoalDialogOpen(false)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
