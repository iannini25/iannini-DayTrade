import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BarChart2, TrendingUp, TrendingDown, Target, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data: summary, isLoading } = trpc.performance.getSummary.useQuery();
  const { data: trades } = trpc.trades.list.useQuery({ limit: 50, offset: 0 });

  const dailyData = summary?.dailyData ?? [];

  // Curva de capital acumulada
  let cumPnl = 0;
  const equityCurve = [...dailyData].reverse().map(d => {
    cumPnl += Number(d.totalPnl);
    return {
      date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      pnl: Number(d.totalPnl),
      cumPnl: Math.round(cumPnl * 100) / 100,
    };
  });

  const StatCard = ({ icon: Icon, label, value, sub, color }: any) => (
    <div className="rounded-xl border border-border p-4" style={{ background: "oklch(0.11 0.01 240)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-1">{label}</p>
      <p className="font-trading text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="h-12 border-b border-border flex items-center px-4 gap-3"
        style={{ background: "oklch(0.09 0.01 240)" }}>
        <a href="/workspace" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
        <div className="w-5 h-5 rounded flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 195), oklch(0.55 0.22 250))" }}>
          <BarChart2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold">Dashboard de Performance</span>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={TrendingUp} label="P&L Hoje" color="#22c55e"
            value={`${(summary?.todayPnl ?? 0) >= 0 ? "+" : ""}R$ ${(summary?.todayPnl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            sub="Resultado do dia" />
          <StatCard icon={BarChart2} label="P&L 30 dias" color="#06b6d4"
            value={`${(summary?.totalPnl30d ?? 0) >= 0 ? "+" : ""}R$ ${(summary?.totalPnl30d ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            sub="Acumulado mensal" />
          <StatCard icon={Target} label="Taxa de Acerto" color="#d97706"
            value={`${summary?.winRate ?? 0}%`}
            sub={`${summary?.totalTrades30d ?? 0} operações`} />
          <StatCard icon={Activity} label="Operações" color="#a855f7"
            value={summary?.totalTrades30d ?? 0}
            sub="Últimos 30 dias" />
        </div>

        {/* Curva de Capital */}
        <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
          <h3 className="text-sm font-semibold mb-4">Curva de Capital (30 dias)</h3>
          {equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,42,54,1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(140,140,160,1)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(140,140,160,1)" }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.13 0.01 240)", border: "1px solid oklch(0.20 0.01 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "P&L Acumulado"]}
                />
                <Area type="monotone" dataKey="cumPnl" stroke="#06b6d4" fill="url(#pnlGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Nenhuma operação registrada ainda
            </div>
          )}
        </div>

        {/* P&L por dia */}
        {equityCurve.length > 0 && (
          <div className="rounded-xl border border-border p-5" style={{ background: "oklch(0.11 0.01 240)" }}>
            <h3 className="text-sm font-semibold mb-4">P&L por Dia</h3>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,42,54,1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(140,140,160,1)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(140,140,160,1)" }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.13 0.01 240)", border: "1px solid oklch(0.20 0.01 240)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "P&L"]}
                />
                <Bar dataKey="pnl" fill="#22c55e" radius={[3, 3, 0, 0]}
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Histórico de operações */}
        <div className="rounded-xl border border-border overflow-hidden" style={{ background: "oklch(0.11 0.01 240)" }}>
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Histórico de Operações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border" style={{ background: "oklch(0.13 0.01 240)" }}>
                  {["Data", "Ativo", "Lado", "Contratos", "Entrada", "Saída", "Pts", "P&L", "Status"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(trades ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma operação registrada
                    </td>
                  </tr>
                ) : (
                  (trades ?? []).map((trade) => {
                    const pnl = Number(trade.pnl ?? 0);
                    const pts = Number(trade.pnlPoints ?? 0);
                    return (
                      <tr key={trade.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-2 font-trading text-muted-foreground">
                          {new Date(trade.entryAt).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-2 font-semibold">{trade.symbol}</td>
                        <td className="px-4 py-2">
                          <span className={`font-semibold ${trade.side === "buy" ? "text-buy" : "text-sell"}`}>
                            {trade.side === "buy" ? "▲ COMPRA" : "▼ VENDA"}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-trading text-center">{trade.contracts}</td>
                        <td className="px-4 py-2 font-trading">{Number(trade.entryPrice).toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-2 font-trading">{trade.exitPrice ? Number(trade.exitPrice).toLocaleString("pt-BR") : "—"}</td>
                        <td className={`px-4 py-2 font-trading font-semibold ${pts >= 0 ? "text-profit" : "text-loss"}`}>
                          {pts !== 0 ? `${pts >= 0 ? "+" : ""}${pts.toFixed(0)}` : "—"}
                        </td>
                        <td className={`px-4 py-2 font-trading font-semibold ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                          {pnl !== 0 ? `${pnl >= 0 ? "+" : ""}R$ ${pnl.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            trade.status === "target" ? "bg-buy/20 text-buy" :
                            trade.status === "stopped" ? "bg-sell/20 text-sell" :
                            trade.status === "open" ? "bg-primary/20 text-primary" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {trade.status === "target" ? "Gain" :
                             trade.status === "stopped" ? "Stop" :
                             trade.status === "open" ? "Aberta" : "Fechada"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
