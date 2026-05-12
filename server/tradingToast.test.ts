import { describe, expect, it } from "vitest";

/**
 * Testes unitários para a lógica de cálculo e formatação dos toasts de trading.
 * Os helpers são espelhados aqui pois são funções puras extraídas do TradingToast.tsx.
 */

// ─── Helpers espelhados de TradingToast.tsx ───────────────────────────────────

function fmtPrice(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
}

function fmtBrl(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "-";
  return `${sign} R$ ${abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

function calcPnlPoints(side: "buy" | "sell", entryPrice: number, exitPrice: number): number {
  return side === "buy" ? exitPrice - entryPrice : entryPrice - exitPrice;
}

function calcPnlBrl(pnlPoints: number, contracts: number): number {
  return pnlPoints * 0.20 * contracts;
}

function calcRiskReward(targetPoints: number, stopPoints: number): number {
  return targetPoints / stopPoints;
}

function calcFinancialValue(contracts: number, price: number): number {
  return contracts * price * 0.20;
}

function calcDivergence(currentPrice: number, vwapValue: number): number {
  return Math.abs(currentPrice - vwapValue);
}

// ─── Testes de formatação ─────────────────────────────────────────────────────

describe("fmtPrice", () => {
  it("deve formatar preço sem casas decimais em pt-BR", () => {
    const result = fmtPrice(130000);
    expect(result).toBe("130.000");
  });

  it("deve formatar preço com separador de milhar", () => {
    const result = fmtPrice(1234567);
    expect(result).toContain("1");
    expect(result.replace(/\D/g, "")).toBe("1234567");
  });
});

describe("fmtBrl", () => {
  it("deve formatar valor positivo com sinal +", () => {
    const result = fmtBrl(1500.50);
    expect(result).toContain("+");
    expect(result).toContain("R$");
    expect(result).toContain("1.500,50");
  });

  it("deve formatar valor negativo com sinal -", () => {
    const result = fmtBrl(-750.00);
    expect(result).toContain("-");
    expect(result).toContain("R$");
    expect(result).toContain("750,00");
  });

  it("deve formatar zero com sinal +", () => {
    const result = fmtBrl(0);
    expect(result).toContain("+");
    expect(result).toContain("0,00");
  });
});

describe("fmtDuration", () => {
  it("deve formatar duração menor que 60s em segundos", () => {
    expect(fmtDuration(30000)).toBe("30s");
    expect(fmtDuration(1000)).toBe("1s");
    expect(fmtDuration(59000)).toBe("59s");
  });

  it("deve formatar duração de exatamente 60s como 1m 0s", () => {
    expect(fmtDuration(60000)).toBe("1m 0s");
  });

  it("deve formatar duração de 90s como 1m 30s", () => {
    expect(fmtDuration(90000)).toBe("1m 30s");
  });

  it("deve formatar duração de 5 minutos corretamente", () => {
    expect(fmtDuration(300000)).toBe("5m 0s");
  });

  it("deve formatar duração de 7m 45s corretamente", () => {
    expect(fmtDuration(465000)).toBe("7m 45s");
  });
});

// ─── Testes de cálculo de P&L ─────────────────────────────────────────────────

describe("calcPnlPoints", () => {
  it("deve calcular P&L positivo para compra com preço subindo", () => {
    expect(calcPnlPoints("buy", 130000, 130250)).toBe(250);
  });

  it("deve calcular P&L negativo para compra com preço caindo", () => {
    expect(calcPnlPoints("buy", 130000, 129850)).toBe(-150);
  });

  it("deve calcular P&L positivo para venda com preço caindo", () => {
    expect(calcPnlPoints("sell", 130000, 129750)).toBe(250);
  });

  it("deve calcular P&L negativo para venda com preço subindo", () => {
    expect(calcPnlPoints("sell", 130000, 130150)).toBe(-150);
  });

  it("deve retornar zero quando preço de saída igual ao de entrada", () => {
    expect(calcPnlPoints("buy", 130000, 130000)).toBe(0);
    expect(calcPnlPoints("sell", 130000, 130000)).toBe(0);
  });
});

describe("calcPnlBrl", () => {
  it("deve calcular P&L em R$ corretamente (R$ 0,20 por ponto por contrato)", () => {
    // 250 pontos × 5 contratos × R$ 0,20 = R$ 250,00
    expect(calcPnlBrl(250, 5)).toBe(250);
  });

  it("deve calcular P&L negativo em R$ corretamente", () => {
    // -150 pontos × 10 contratos × R$ 0,20 = -R$ 300,00
    expect(calcPnlBrl(-150, 10)).toBe(-300);
  });

  it("deve escalar linearmente com o número de contratos", () => {
    const base = calcPnlBrl(200, 1);
    expect(calcPnlBrl(200, 5)).toBe(base * 5);
    expect(calcPnlBrl(200, 15)).toBe(base * 15);
  });

  it("deve calcular ganho máximo (250 pts × 15 contratos)", () => {
    // 250 × 15 × 0,20 = R$ 750,00
    expect(calcPnlBrl(250, 15)).toBe(750);
  });

  it("deve calcular perda máxima (150 pts × 15 contratos)", () => {
    // -150 × 15 × 0,20 = -R$ 450,00
    expect(calcPnlBrl(-150, 15)).toBe(-450);
  });
});

// ─── Testes de risco/retorno ──────────────────────────────────────────────────

describe("calcRiskReward", () => {
  it("deve calcular razão risco/retorno 1:1.67 para stop 150 e gain 250", () => {
    const rr = calcRiskReward(250, 150);
    expect(rr).toBeCloseTo(1.667, 2);
  });

  it("deve calcular razão 1:1.5 para stop 100 e gain 150", () => {
    const rr = calcRiskReward(150, 100);
    expect(rr).toBeCloseTo(1.5, 1);
  });

  it("deve calcular razão 1:2.5 para stop 100 e gain 250", () => {
    const rr = calcRiskReward(250, 100);
    expect(rr).toBeCloseTo(2.5, 1);
  });

  it("razão risco/retorno deve ser sempre positiva", () => {
    expect(calcRiskReward(200, 100)).toBeGreaterThan(0);
    expect(calcRiskReward(150, 150)).toBe(1);
  });
});

// ─── Testes de valor financeiro ───────────────────────────────────────────────

describe("calcFinancialValue", () => {
  it("deve calcular valor financeiro correto (contratos × preço × 0,20)", () => {
    // 5 contratos × 130.000 × 0,20 = R$ 130.000,00
    expect(calcFinancialValue(5, 130000)).toBe(130000);
  });

  it("deve escalar com número de contratos", () => {
    const base = calcFinancialValue(1, 130000);
    expect(calcFinancialValue(10, 130000)).toBe(base * 10);
  });
});

// ─── Testes de divergência VWAP ──────────────────────────────────────────────

describe("calcDivergence", () => {
  it("deve calcular divergência positiva quando preço está acima da VWAP", () => {
    expect(calcDivergence(130200, 130000)).toBe(200);
  });

  it("deve calcular divergência positiva quando preço está abaixo da VWAP", () => {
    expect(calcDivergence(129800, 130000)).toBe(200);
  });

  it("deve retornar zero quando preço igual à VWAP", () => {
    expect(calcDivergence(130000, 130000)).toBe(0);
  });
});
