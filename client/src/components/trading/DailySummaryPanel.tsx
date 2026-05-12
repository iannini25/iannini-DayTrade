import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  TrendingUp, TrendingDown, Target, AlertTriangle,
  BarChart2, Zap, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBrl(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  return `${sign} R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Tooltip customizado para o gráfico ──────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-border px-3 py-2 text-xs shadow-xl"
      style={{ background: "oklch(0.13 0.01 240)" }}>
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className={`font-trading font-bold ${val >= 0 ? "text-buy" : "text-sell"}`}>
        {fmtBrl(val)}
      </p>
    </div>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "blue" | "amber" | "default";
  icon: React.ReactNode;
}

function MetricCard({ label, value, sub, color = "default", icon }: MetricCardProps) {
  const colorMap = {
    green: "text-buy",
    red: "text-sell",
    blue: "text-primary",
    amber: "text-amber-400",
    default: "text-foreground",
  };
  return (
    <div className="rounded-lg border border-border p-3 flex flex-col gap-1"
      style={{ background: "oklch(0.11 0.01 240)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`font-trading text-base font-bold leading-tight ${colorMap[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface DailySummaryPanelProps {
  /** Se true, exibe como painel lateral colapsável */
  collapsible?: boolean;
}

export default function DailySummaryPanel({ collapsible = false }: DailySummaryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { data, isLoading, refetch, isFetching } = trpc.trades.getDailySummary.useQuery(
    undefined,
    { refetchInterval: 30000, staleTime: 20000 }
  );

  // Limites de alerta
  const DAILY_GOAL = 2000;   // Meta diária R$
  const DAILY_LIMIT = -1000; // Limite de perda diária R$

  const pnl = data?.totalPnlBrl ?? 0;
  const pnlPts = data?.totalPnlPoints ?? 0;
  const winRate = data?.winRate ?? 0;
  const tradesCount = data?.tradesCount ?? 0;
  const winsCount = data?.winsCount ?? 0;
  const lossesCount = data?.lossesCount ?? 0;
  const drawdown = data?.maxDrawdown ?? 0;
  const streak = data?.streak ?? 0;
  const streakType = data?.streakType ?? null;
  const equityCurve = data?.equityCurve ?? [];
  const trades = data?.trades ?? [];

  const pnlColor: MetricCardProps["color"] = pnl > 0 ? "green" : pnl < 0 ? "red" : "default";
  const goalPct = DAILY_GOAL > 0 ? Math.min(100, (pnl / DAILY_GOAL) * 100) : 0;
  const isGoalReached = pnl >= DAILY_GOAL;
  const isLimitBreached = pnl <= DAILY_LIMIT;

  // Pontos de referência no gráfico
  const chartData = equityCurve.length > 0
    ? equityCurve
    : [{ time: "Início", pnl: 0 }];

  if (collapsible && collapsed) {
    return (
      <div className="border-t border-border" style={{ background: "oklch(0.09 0.01 240)" }}>
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-between px-4 py-2 hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo do Dia</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-trading text-sm font-bold ${pnlColor === "green" ? "text-buy" : pnlColor === "red" ? "text-sell" : "text-foreground"}`}>
              {fmtBrl(pnl)}
            </span>
            <span className="text-xs text-muted-foreground">{winRate.toFixed(1)}% acerto</span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border flex flex-col" style={{ background: "oklch(0.09 0.01 240)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0"
        style={{ background: "oklch(0.11 0.01 240)" }}>
        <div className="flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo do Dia</span>
          {isGoalReached && (
            <Badge className="text-[9px] h-4 px-1.5 bg-buy/20 text-buy border-buy/30">Meta atingida</Badge>
          )}
          {isLimitBreached && (
            <Badge className="text-[9px] h-4 px-1.5 bg-sell/20 text-sell border-sell/30">Limite atingido</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            title="Atualizar">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          </button>
          {collapsible && (
            <button onClick={() => setCollapsed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Alertas de meta/limite */}
          {isGoalReached && (
            <div className="mx-3 mt-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <Target className="w-3.5 h-3.5 text-buy shrink-0" />
              <span className="text-buy font-medium">Meta diária de R$ {DAILY_GOAL.toLocaleString("pt-BR")} atingida! Considere encerrar as operações.</span>
            </div>
          )}
          {isLimitBreached && (
            <div className="mx-3 mt-3 rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" }}>
              <AlertTriangle className="w-3.5 h-3.5 text-sell shrink-0" />
              <span className="text-sell font-medium">Limite de perda de R$ {Math.abs(DAILY_LIMIT).toLocaleString("pt-BR")} atingido. Pare de operar hoje.</span>
            </div>
          )}

          {/* Cards de métricas */}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <MetricCard
              label="P&L do Dia"
              value={fmtBrl(pnl)}
              sub={`${pnlPts >= 0 ? "+" : ""}${pnlPts.toFixed(0)} pts`}
              color={pnlColor}
              icon={pnl >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Taxa de Acerto"
              value={`${winRate.toFixed(1)}%`}
              sub={`${winsCount}G / ${lossesCount}P de ${tradesCount} ops`}
              color={winRate >= 60 ? "green" : winRate >= 40 ? "amber" : "red"}
              icon={<Target className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Drawdown Máx."
              value={drawdown < 0 ? fmtBrl(drawdown) : "R$ 0,00"}
              sub="Pior momento do dia"
              color={drawdown < -500 ? "red" : drawdown < 0 ? "amber" : "green"}
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
            />
            <MetricCard
              label="Sequência Atual"
              value={streak > 0 && streakType ? `${streak}× ${streakType === "win" ? "Ganho" : "Perda"}` : "—"}
              sub={streak >= 3 ? (streakType === "win" ? "Ótimo momento!" : "Cuidado, pause") : ""}
              color={streakType === "win" ? "green" : streakType === "loss" ? "red" : "default"}
              icon={<Zap className="w-3.5 h-3.5" />}
            />
          </div>

          {/* Barra de progresso da meta */}
          {tradesCount > 0 && (
            <div className="px-3 pb-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Progresso da meta diária</span>
                <span>{goalPct.toFixed(0)}% de R$ {DAILY_GOAL.toLocaleString("pt-BR")}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.15 0.01 240)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, goalPct))}%`,
                    background: isGoalReached
                      ? "oklch(0.65 0.18 145)"
                      : pnl < 0
                      ? "oklch(0.60 0.22 25)"
                      : "oklch(0.65 0.18 195)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Gráfico de curva de capital */}
          {equityCurve.length > 0 && (
            <div className="px-3 pb-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Curva de Capital</p>
              <div className="h-28 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={pnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={pnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,62,74,0.5)" />
                    <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(140,140,160,0.8)" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "rgba(140,140,160,0.8)" }} tickLine={false} axisLine={false} width={52}
                      tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(140,140,160,0.4)" strokeDasharray="4 2" />
                    <ReferenceLine y={DAILY_GOAL} stroke="rgba(34,197,94,0.4)" strokeDasharray="4 2" label={{ value: "Meta", fontSize: 9, fill: "rgba(34,197,94,0.7)" }} />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke={pnl >= 0 ? "#22c55e" : "#ef4444"}
                      strokeWidth={1.5}
                      fill="url(#pnlGradient)"
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Histórico de operações do dia */}
          {trades.length > 0 ? (
            <div className="px-3 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Operações do Dia</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr style={{ background: "oklch(0.13 0.01 240)" }}>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Hora</th>
                      <th className="text-left px-2 py-1.5 text-muted-foreground font-medium">Lado</th>
                      <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Contr.</th>
                      <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Entrada</th>
                      <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Saída</th>
                      <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">Pts</th>
                      <th className="text-right px-2 py-1.5 text-muted-foreground font-medium">R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => {
                      const isWin = (t.pnlBrl ?? 0) > 0;
                      const isOpen = t.status === "open";
                      return (
                        <tr key={t.id}
                          className="border-t border-border/50 hover:bg-secondary/20 transition-colors"
                          style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                          <td className="px-2 py-1.5 text-muted-foreground font-trading">
                            {fmtTime(t.entryAt)}
                          </td>
                          <td className="px-2 py-1.5">
                            <span className={`font-semibold ${t.side === "buy" ? "text-buy" : "text-sell"}`}>
                              {t.side === "buy" ? "▲ C" : "▼ V"}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-trading text-foreground">{t.contracts}</td>
                          <td className="px-2 py-1.5 text-right font-trading text-foreground">
                            {t.entryPrice.toLocaleString("pt-BR")}
                          </td>
                          <td className="px-2 py-1.5 text-right font-trading text-muted-foreground">
                            {isOpen ? <span className="text-amber-400 animate-pulse">Aberta</span> : (t.exitPrice?.toLocaleString("pt-BR") ?? "—")}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-trading font-semibold ${isOpen ? "text-muted-foreground" : isWin ? "text-buy" : "text-sell"}`}>
                            {isOpen ? "—" : `${(t.pnlPoints ?? 0) >= 0 ? "+" : ""}${(t.pnlPoints ?? 0).toFixed(0)}`}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-trading font-semibold ${isOpen ? "text-muted-foreground" : isWin ? "text-buy" : "text-sell"}`}>
                            {isOpen ? "—" : fmtBrl(t.pnlBrl ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center px-4">
              <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma operação registrada hoje.</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">As operações aparecerão aqui ao serem encerradas no SuperDOM.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
