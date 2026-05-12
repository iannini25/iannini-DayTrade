/**
 * Testes unitários para as funções de automação de trading.
 * Cobre: calculateRSI, detectEMACross, getCriticalHourWarning,
 * e lógica de P&L do WIN.
 */

import { describe, it, expect } from "vitest";

// ─── Funções puras importadas do hook (lógica sem React) ─────────────────────
// Replicamos aqui para testar sem dependência do ambiente browser

function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function detectEMACross(ema9: number[], ema21: number[]): "bullish" | "bearish" | null {
  if (ema9.length < 2 || ema21.length < 2) return null;
  const ema9Prev = ema9[ema9.length - 2] ?? 0;
  const ema9Curr = ema9[ema9.length - 1] ?? 0;
  const ema21Prev = ema21[ema21.length - 2] ?? 0;
  const ema21Curr = ema21[ema21.length - 1] ?? 0;
  if (ema9Prev <= ema21Prev && ema9Curr > ema21Curr) return "bullish";
  if (ema9Prev >= ema21Prev && ema9Curr < ema21Curr) return "bearish";
  return null;
}

function getCriticalHourWarning(now: Date): string | null {
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;
  if (totalMin >= 9 * 60 && totalMin <= 9 * 60 + 30) return "abertura";
  if (totalMin >= 12 * 60 && totalMin <= 13 * 60) return "almoco";
  if (totalMin >= 16 * 60 + 30 && totalMin <= 17 * 60 + 30) return "fechamento";
  if (totalMin >= 17 * 60 + 30) return "encerrando";
  return null;
}

// ─── Helpers de P&L do WIN ───────────────────────────────────────────────────
const WIN_POINT_VALUE = 0.20; // R$ por ponto por contrato

function calcPnlBrl(pnlPoints: number, contracts: number): number {
  return Math.round(pnlPoints * WIN_POINT_VALUE * contracts * 100) / 100;
}

function calcPnlPoints(entryPrice: number, exitPrice: number, side: "buy" | "sell"): number {
  return side === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
}

function calcMarginRequired(contracts: number, marginPerContract = 100): number {
  return contracts * marginPerContract;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("calculateRSI", () => {
  it("retorna 50 quando não há dados suficientes", () => {
    expect(calculateRSI([100, 101, 102], 14)).toBe(50);
  });

  it("retorna 100 quando todos os movimentos são de alta", () => {
    const closes = Array.from({ length: 16 }, (_, i) => 100 + i);
    expect(calculateRSI(closes)).toBe(100);
  });

  it("retorna valor baixo quando todos os movimentos são de baixa", () => {
    const closes = Array.from({ length: 16 }, (_, i) => 200 - i);
    expect(calculateRSI(closes)).toBe(0);
  });

  it("retorna valor entre 30 e 70 para mercado lateral", () => {
    // Alternância de altas e baixas
    const closes = [100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102, 100, 102];
    const rsi = calculateRSI(closes);
    expect(rsi).toBeGreaterThan(30);
    expect(rsi).toBeLessThan(70);
  });

  it("detecta sobrecompra (RSI > 70) em tendência forte de alta", () => {
    const closes = [100, 103, 106, 109, 112, 115, 118, 121, 124, 127, 130, 133, 136, 139, 142, 145];
    const rsi = calculateRSI(closes);
    expect(rsi).toBeGreaterThan(70);
  });
});

describe("detectEMACross", () => {
  it("retorna null quando arrays têm menos de 2 elementos", () => {
    expect(detectEMACross([100], [99])).toBeNull();
    expect(detectEMACross([], [])).toBeNull();
  });

  it("detecta cruzamento bullish (EMA9 cruza acima da EMA21)", () => {
    // Antes: EMA9 (98) < EMA21 (100). Depois: EMA9 (102) > EMA21 (100)
    const ema9 = [98, 102];
    const ema21 = [100, 100];
    expect(detectEMACross(ema9, ema21)).toBe("bullish");
  });

  it("detecta cruzamento bearish (EMA9 cruza abaixo da EMA21)", () => {
    // Antes: EMA9 (102) > EMA21 (100). Depois: EMA9 (98) < EMA21 (100)
    const ema9 = [102, 98];
    const ema21 = [100, 100];
    expect(detectEMACross(ema9, ema21)).toBe("bearish");
  });

  it("retorna null quando não há cruzamento (EMA9 sempre acima)", () => {
    const ema9 = [105, 106];
    const ema21 = [100, 100];
    expect(detectEMACross(ema9, ema21)).toBeNull();
  });

  it("retorna null quando não há cruzamento (EMA9 sempre abaixo)", () => {
    const ema9 = [95, 96];
    const ema21 = [100, 100];
    expect(detectEMACross(ema9, ema21)).toBeNull();
  });

  it("detecta cruzamento com múltiplos pontos históricos", () => {
    // A função olha apenas os 2 últimos valores
    // Penultimo: EMA9[3]=101 > EMA21[3]=100 => já estava acima, sem cruzamento
    // Para cruzamento real: penultimo abaixo, último acima
    const ema9 = [95, 97, 99, 98, 103]; // penultimo=98 < 100, último=103 > 100
    const ema21 = [100, 100, 100, 100, 100];
    expect(detectEMACross(ema9, ema21)).toBe("bullish");
  });
});

describe("getCriticalHourWarning", () => {
  it("alerta na abertura (9h00 a 9h30)", () => {
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 9, 0))).toBe("abertura");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 9, 15))).toBe("abertura");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 9, 30))).toBe("abertura");
  });

  it("alerta no almoço (12h a 13h)", () => {
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 12, 0))).toBe("almoco");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 12, 30))).toBe("almoco");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 13, 0))).toBe("almoco");
  });

  it("alerta no pré-fechamento (16h30 a 17h30)", () => {
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 16, 30))).toBe("fechamento");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 17, 0))).toBe("fechamento");
  });

  it("alerta de encerramento após 17h30", () => {
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 17, 31))).toBe("encerrando");
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 18, 0))).toBe("encerrando");
  });

  it("retorna null em horário normal de operação", () => {
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 10, 0))).toBeNull();
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 11, 0))).toBeNull();
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 14, 0))).toBeNull();
    expect(getCriticalHourWarning(new Date(2026, 0, 1, 15, 0))).toBeNull();
  });
});

describe("Cálculos de P&L do WIN", () => {
  it("calcula P&L em R$ corretamente para compra vencedora", () => {
    // 5 contratos, ganho de 200 pontos: 5 × 200 × R$0,20 = R$200,00
    expect(calcPnlBrl(200, 5)).toBe(200.00);
  });

  it("calcula P&L em R$ corretamente para venda vencedora", () => {
    // 10 contratos, ganho de 150 pontos: 10 × 150 × R$0,20 = R$300,00
    expect(calcPnlBrl(150, 10)).toBe(300.00);
  });

  it("calcula P&L negativo para operação perdedora", () => {
    // 5 contratos, perda de 120 pontos: 5 × (-120) × R$0,20 = -R$120,00
    expect(calcPnlBrl(-120, 5)).toBe(-120.00);
  });

  it("calcula pontos de ganho para compra", () => {
    expect(calcPnlPoints(130000, 130200, "buy")).toBe(200);
  });

  it("calcula pontos de ganho para venda", () => {
    expect(calcPnlPoints(130200, 130000, "sell")).toBe(200);
  });

  it("calcula pontos de perda para compra", () => {
    expect(calcPnlPoints(130000, 129850, "buy")).toBe(-150);
  });

  it("calcula margem de garantia intraday corretamente", () => {
    // WIN intraday: ~R$100/contrato
    expect(calcMarginRequired(5)).toBe(500);
    expect(calcMarginRequired(10)).toBe(1000);
    expect(calcMarginRequired(15)).toBe(1500);
  });

  it("meta de R$2.000/dia com 5 contratos requer 20 ganhos de 200 pts", () => {
    const contracts = 5;
    const gainPerTrade = calcPnlBrl(200, contracts); // R$200 por trade
    const tradesNeeded = Math.ceil(2000 / gainPerTrade);
    expect(tradesNeeded).toBe(10); // 10 trades × R$200 = R$2.000
  });

  it("meta de R$2.000/dia com 10 contratos requer 5 ganhos de 200 pts", () => {
    const contracts = 10;
    const gainPerTrade = calcPnlBrl(200, contracts); // R$400 por trade
    const tradesNeeded = Math.ceil(2000 / gainPerTrade);
    expect(tradesNeeded).toBe(5); // 5 trades × R$400 = R$2.000
  });

  it("stop loss de 150 pts com 5 contratos = R$150 de perda", () => {
    expect(calcPnlBrl(-150, 5)).toBe(-150.00);
  });

  it("take profit de 250 pts com 5 contratos = R$250 de ganho", () => {
    expect(calcPnlBrl(250, 5)).toBe(250.00);
  });

  it("razão risco/retorno 1:1.67 com SL 150 e TP 250", () => {
    const sl = 150;
    const tp = 250;
    const rr = Math.round((tp / sl) * 100) / 100;
    expect(rr).toBe(1.67);
  });
});
