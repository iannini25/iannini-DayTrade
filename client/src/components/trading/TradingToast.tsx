import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, AlertTriangle, Target,
  ArrowUpRight, ArrowDownRight, Activity, DollarSign,
  BarChart2, Clock, X
} from "lucide-react";

// ─── Tipos de evento de trading ──────────────────────────────────────────────

export interface OrderExecutedPayload {
  side: "buy" | "sell";
  contracts: number;
  price: number;
  stopPrice: number;
  targetPrice: number;
  stopPoints: number;
  targetPoints: number;
  financialValue: number; // contratos * preço * 0.20
  timestamp?: Date;
}

export interface OrderClosedPayload {
  side: "buy" | "sell";
  contracts: number;
  entryPrice: number;
  exitPrice: number;
  pnlPoints: number;
  pnlBrl: number;
  reason: "stop_loss" | "take_profit" | "manual";
  durationMs?: number;
}

export interface VwapCrossPayload {
  direction: "up" | "down";
  currentPrice: number;
  vwapValue: number;
  divergencePoints: number;
}

// ─── Helpers de formatação ────────────────────────────────────────────────────

function fmtPrice(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}

function fmtBrl(v: number) {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  return `${sign} R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const BASE_STYLE: React.CSSProperties = {
  background: "oklch(0.12 0.01 240)",
  border: "1px solid oklch(0.22 0.01 240)",
  borderRadius: "10px",
  padding: "0",
  overflow: "hidden",
  minWidth: "300px",
  maxWidth: "360px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
};

// ─── Componente interno de linha de dado ──────────────────────────────────────

function DataRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
      <span style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)", fontFamily: "'Inter', sans-serif" }}>
        {label}
      </span>
      <span style={{
        fontSize: "11px",
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 600,
        color: valueColor ?? "oklch(0.90 0.01 240)"
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Toast: Ordem Executada (Compra ou Venda) ─────────────────────────────────

export function showOrderExecutedToast(payload: OrderExecutedPayload) {
  const isBuy = payload.side === "buy";
  const accentColor = isBuy ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.18 25)";
  const bgAccent = isBuy ? "oklch(0.65 0.18 145 / 0.12)" : "oklch(0.65 0.18 25 / 0.12)";
  const Icon = isBuy ? TrendingUp : TrendingDown;
  const label = isBuy ? "COMPRA EXECUTADA" : "VENDA EXECUTADA";
  const Arrow = isBuy ? ArrowUpRight : ArrowDownRight;

  const content = (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px 8px",
        background: bgAccent,
        borderBottom: `1px solid oklch(0.20 0.01 240)`
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Icon size={14} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, letterSpacing: "0.05em" }}>
            {label}
          </div>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>
            {new Date().toLocaleTimeString("pt-BR")} · WIN Mini Índice
          </div>
        </div>
        <Arrow size={16} color={accentColor} />
      </div>

      {/* Dados principais */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {/* Preço de entrada em destaque */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: "6px", paddingBottom: "6px",
          borderBottom: "1px solid oklch(0.18 0.01 240)"
        }}>
          <span style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>Preço de Entrada</span>
          <span style={{
            fontSize: "16px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: accentColor
          }}>
            {fmtPrice(payload.price)}
          </span>
        </div>

        <DataRow label="Contratos" value={`${payload.contracts}x`} />
        <DataRow label="Valor Financeiro" value={`R$ ${(payload.contracts * payload.price * 0.20).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />

        {/* Divisor */}
        <div style={{ height: 1, background: "oklch(0.18 0.01 240)", margin: "4px 0" }} />

        <DataRow
          label="Stop Loss"
          value={`${fmtPrice(payload.stopPrice)} (−${payload.stopPoints} pts)`}
          valueColor="oklch(0.65 0.18 25)"
        />
        <DataRow
          label="Take Profit"
          value={`${fmtPrice(payload.targetPrice)} (+${payload.targetPoints} pts)`}
          valueColor="oklch(0.65 0.18 145)"
        />

        {/* Risco/Retorno */}
        <div style={{
          marginTop: "6px", padding: "6px 8px", borderRadius: "6px",
          background: "oklch(0.15 0.01 240)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>Risco/Retorno</span>
          <span style={{
            fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: "oklch(0.75 0.12 195)"
          }}>
            1 : {(payload.targetPoints / payload.stopPoints).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );

  toast.custom(() => content, {
    duration: 6000,
    style: BASE_STYLE,
    position: "top-right",
  });
}

// ─── Toast: Ordem Encerrada (Stop Loss, Take Profit ou Manual) ────────────────

export function showOrderClosedToast(payload: OrderClosedPayload) {
  const isProfit = payload.pnlBrl >= 0;
  const isStopLoss = payload.reason === "stop_loss";
  const isTakeProfit = payload.reason === "take_profit";

  const accentColor = isProfit ? "oklch(0.65 0.18 145)" : "oklch(0.65 0.18 25)";
  const bgAccent = isProfit ? "oklch(0.65 0.18 145 / 0.12)" : "oklch(0.65 0.18 25 / 0.12)";

  const Icon = isStopLoss ? AlertTriangle : isTakeProfit ? Target : X;
  const titles: Record<string, string> = {
    stop_loss: "⛔ STOP LOSS ATINGIDO",
    take_profit: "🎯 TAKE PROFIT ATINGIDO",
    manual: "📤 POSIÇÃO ENCERRADA",
  };

  const content = (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px 8px",
        background: bgAccent,
        borderBottom: `1px solid oklch(0.20 0.01 240)`
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Icon size={14} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, letterSpacing: "0.04em" }}>
            {titles[payload.reason]}
          </div>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>
            {new Date().toLocaleTimeString("pt-BR")} · {payload.side === "buy" ? "Comprado" : "Vendido"} · {payload.contracts} contratos
          </div>
        </div>
      </div>

      {/* P&L em destaque */}
      <div style={{
        padding: "12px 14px 8px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid oklch(0.18 0.01 240)"
      }}>
        <div>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)", marginBottom: "2px" }}>Resultado</div>
          <div style={{
            fontSize: "20px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: accentColor, lineHeight: 1
          }}>
            {fmtBrl(payload.pnlBrl)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)", marginBottom: "2px" }}>Pontos</div>
          <div style={{
            fontSize: "16px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 600, color: accentColor
          }}>
            {payload.pnlPoints >= 0 ? "+" : ""}{payload.pnlPoints.toFixed(0)} pts
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div style={{ padding: "8px 14px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <DataRow label="Preço de Entrada" value={fmtPrice(payload.entryPrice)} />
        <DataRow label="Preço de Saída" value={fmtPrice(payload.exitPrice)} />
        <DataRow
          label="Variação"
          value={`${payload.exitPrice > payload.entryPrice ? "+" : ""}${(payload.exitPrice - payload.entryPrice).toFixed(0)} pts`}
          valueColor={accentColor}
        />
        {payload.durationMs !== undefined && (
          <DataRow label="Duração" value={fmtDuration(payload.durationMs)} />
        )}
        <DataRow
          label="Valor por Contrato"
          value={`R$ ${Math.abs(payload.pnlBrl / payload.contracts).toFixed(2)}`}
          valueColor={accentColor}
        />
      </div>
    </div>
  );

  toast.custom(() => content, {
    duration: isStopLoss ? 10000 : isTakeProfit ? 8000 : 5000,
    style: BASE_STYLE,
    position: "top-right",
  });
}

// ─── Toast: Cruzamento VWAP ───────────────────────────────────────────────────

export function showVwapCrossToast(payload: VwapCrossPayload) {
  const isUp = payload.direction === "up";
  const accentColor = isUp ? "oklch(0.65 0.18 195)" : "oklch(0.75 0.15 60)";
  const bgAccent = isUp ? "oklch(0.65 0.18 195 / 0.12)" : "oklch(0.75 0.15 60 / 0.12)";
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;

  const content = (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px 8px",
        background: bgAccent,
        borderBottom: `1px solid oklch(0.20 0.01 240)`
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Activity size={14} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, letterSpacing: "0.04em" }}>
            {isUp ? "📈 CRUZAMENTO VWAP ↑" : "📉 CRUZAMENTO VWAP ↓"}
          </div>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>
            {new Date().toLocaleTimeString("pt-BR")} · Sinal de {isUp ? "compra" : "venda"}
          </div>
        </div>
        <Arrow size={16} color={accentColor} />
      </div>

      {/* Dados */}
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline",
          marginBottom: "6px", paddingBottom: "6px",
          borderBottom: "1px solid oklch(0.18 0.01 240)"
        }}>
          <span style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)" }}>Preço Atual</span>
          <span style={{
            fontSize: "16px", fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700, color: accentColor
          }}>
            {fmtPrice(payload.currentPrice)}
          </span>
        </div>

        <DataRow label="VWAP" value={fmtPrice(payload.vwapValue)} />
        <DataRow
          label="Divergência"
          value={`${isUp ? "+" : "-"}${Math.abs(payload.divergencePoints).toFixed(0)} pts`}
          valueColor={accentColor}
        />

        {/* Sinal */}
        <div style={{
          marginTop: "6px", padding: "6px 8px", borderRadius: "6px",
          background: bgAccent,
          display: "flex", alignItems: "center", gap: "6px"
        }}>
          <BarChart2 size={12} color={accentColor} />
          <span style={{ fontSize: "10px", color: accentColor, fontWeight: 600 }}>
            {isUp
              ? "Preço acima da VWAP — domínio comprador"
              : "Preço abaixo da VWAP — domínio vendedor"}
          </span>
        </div>
      </div>
    </div>
  );

  toast.custom(() => content, {
    duration: 7000,
    style: BASE_STYLE,
    position: "top-right",
  });
}

// ─── Toast: Alerta de Calendário Econômico ────────────────────────────────────

export function showEconomicEventToast(eventName: string, timeLabel: string, impact: number) {
  const accentColor = "oklch(0.75 0.15 60)";

  const content = (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 14px",
        background: "oklch(0.75 0.15 60 / 0.12)",
        borderBottom: `1px solid oklch(0.20 0.01 240)`
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: accentColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
        }}>
          <Clock size={14} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor }}>
            ⚠️ EVENTO ECONÔMICO EM {timeLabel}
          </div>
          <div style={{ fontSize: "10px", color: "oklch(0.55 0.01 240)", marginTop: "2px" }}>
            {eventName}
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 14px 10px" }}>
        <DataRow label="Impacto" value={"★".repeat(impact) + "☆".repeat(3 - impact)} valueColor={accentColor} />
        <div style={{
          marginTop: "6px", padding: "6px 8px", borderRadius: "6px",
          background: "oklch(0.15 0.01 240)",
          fontSize: "10px", color: "oklch(0.65 0.01 240)", lineHeight: 1.5
        }}>
          Considere evitar novas entradas durante este evento para reduzir exposição à volatilidade.
        </div>
      </div>
    </div>
  );

  toast.custom(() => content, {
    duration: 12000,
    style: BASE_STYLE,
    position: "top-right",
  });
}
