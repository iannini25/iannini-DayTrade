import { describe, expect, it } from "vitest";

// ─── Helpers replicados do router para teste isolado ──────────────────────────

function calcPnlBrl(pnlPoints: number, contracts: number): number {
  return pnlPoints * 0.20 * contracts;
}

function calcWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 10;
}

function calcStreak(trades: { pnlBrl: number }[]): { streak: number; streakType: "win" | "loss" | null } {
  let streak = 0;
  let streakType: "win" | "loss" | null = null;
  for (let i = trades.length - 1; i >= 0; i--) {
    const t = trades[i]!;
    const isWin = t.pnlBrl > 0;
    if (streakType === null) {
      streakType = isWin ? "win" : "loss";
      streak = 1;
    } else if ((streakType === "win") === isWin) {
      streak++;
    } else {
      break;
    }
  }
  return { streak, streakType };
}

function calcDrawdown(trades: { pnlBrl: number }[]): number {
  let cumPnl = 0;
  let minPnl = 0;
  for (const t of trades) {
    cumPnl += t.pnlBrl;
    if (cumPnl < minPnl) minPnl = cumPnl;
  }
  return minPnl;
}

function calcEquityCurve(trades: { pnlBrl: number; exitTime: string }[]): { time: string; pnl: number }[] {
  let cumPnl = 0;
  return trades.map(t => {
    cumPnl += t.pnlBrl;
    return { time: t.exitTime, pnl: Math.round(cumPnl * 100) / 100 };
  });
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("calcPnlBrl", () => {
  it("calcula P&L correto para compra com ganho", () => {
    // 100 pontos × R$ 0,20 × 5 contratos = R$ 100
    expect(calcPnlBrl(100, 5)).toBe(100);
    // 250 pontos × R$ 0,20 × 10 contratos = R$ 500
    expect(calcPnlBrl(250, 10)).toBe(500);
  });

  it("calcula P&L negativo para stop loss", () => {
    // -150 pontos × R$ 0,20 × 5 contratos = -R$ 150
    expect(calcPnlBrl(-150, 5)).toBe(-150);
  });

  it("retorna zero para operação empatada", () => {
    expect(calcPnlBrl(0, 5)).toBe(0);
  });

  it("escala corretamente com número de contratos", () => {
    const base = calcPnlBrl(100, 1);
    expect(calcPnlBrl(100, 5)).toBe(base * 5);
    expect(calcPnlBrl(100, 15)).toBe(base * 15);
  });
});

describe("calcWinRate", () => {
  it("retorna 0 quando não há operações", () => {
    expect(calcWinRate(0, 0)).toBe(0);
  });

  it("retorna 100% quando todas ganham", () => {
    expect(calcWinRate(5, 5)).toBe(100);
  });

  it("retorna 0% quando todas perdem", () => {
    expect(calcWinRate(0, 5)).toBe(0);
  });

  it("calcula taxa de acerto corretamente", () => {
    expect(calcWinRate(3, 5)).toBe(60);
    expect(calcWinRate(2, 4)).toBe(50);
    expect(calcWinRate(7, 10)).toBe(70);
  });

  it("arredonda para 1 casa decimal", () => {
    expect(calcWinRate(1, 3)).toBe(33.3);
    expect(calcWinRate(2, 3)).toBe(66.7);
  });
});

describe("calcStreak", () => {
  it("retorna streak nulo para lista vazia", () => {
    const result = calcStreak([]);
    expect(result.streak).toBe(0);
    expect(result.streakType).toBeNull();
  });

  it("detecta sequência de ganhos", () => {
    const trades = [
      { pnlBrl: -100 },
      { pnlBrl: 200 },
      { pnlBrl: 150 },
      { pnlBrl: 300 },
    ];
    const result = calcStreak(trades);
    expect(result.streak).toBe(3);
    expect(result.streakType).toBe("win");
  });

  it("detecta sequência de perdas", () => {
    const trades = [
      { pnlBrl: 200 },
      { pnlBrl: -100 },
      { pnlBrl: -150 },
    ];
    const result = calcStreak(trades);
    expect(result.streak).toBe(2);
    expect(result.streakType).toBe("loss");
  });

  it("retorna streak 1 para operação única", () => {
    expect(calcStreak([{ pnlBrl: 100 }])).toEqual({ streak: 1, streakType: "win" });
    expect(calcStreak([{ pnlBrl: -50 }])).toEqual({ streak: 1, streakType: "loss" });
  });
});

describe("calcDrawdown", () => {
  it("retorna 0 quando não há perdas", () => {
    const trades = [{ pnlBrl: 100 }, { pnlBrl: 200 }, { pnlBrl: 150 }];
    expect(calcDrawdown(trades)).toBe(0);
  });

  it("calcula drawdown máximo corretamente", () => {
    const trades = [
      { pnlBrl: 200 },
      { pnlBrl: -300 },
      { pnlBrl: -200 },
      { pnlBrl: 400 },
    ];
    // Curva: 200 → -100 → -300 → 100
    // Mínimo cumulativo: -300
    expect(calcDrawdown(trades)).toBe(-300);
  });

  it("retorna 0 para lista vazia", () => {
    expect(calcDrawdown([])).toBe(0);
  });
});

describe("calcEquityCurve", () => {
  it("gera curva de capital corretamente", () => {
    const trades = [
      { pnlBrl: 100, exitTime: "09:15" },
      { pnlBrl: -50, exitTime: "10:30" },
      { pnlBrl: 200, exitTime: "11:45" },
    ];
    const curve = calcEquityCurve(trades);
    expect(curve).toHaveLength(3);
    expect(curve[0]).toEqual({ time: "09:15", pnl: 100 });
    expect(curve[1]).toEqual({ time: "10:30", pnl: 50 });
    expect(curve[2]).toEqual({ time: "11:45", pnl: 250 });
  });

  it("retorna array vazio para lista vazia", () => {
    expect(calcEquityCurve([])).toEqual([]);
  });
});

describe("meta diária e limite de perda", () => {
  const DAILY_GOAL = 2000;
  const DAILY_LIMIT = -1000;

  it("detecta meta atingida", () => {
    expect(2100 >= DAILY_GOAL).toBe(true);
    expect(1999 >= DAILY_GOAL).toBe(false);
  });

  it("detecta limite de perda atingido", () => {
    expect(-1100 <= DAILY_LIMIT).toBe(true);
    expect(-999 <= DAILY_LIMIT).toBe(false);
  });

  it("calcula progresso da meta corretamente", () => {
    const pct = (pnl: number) => Math.min(100, (pnl / DAILY_GOAL) * 100);
    expect(pct(1000)).toBe(50);
    expect(pct(2000)).toBe(100);
    expect(pct(3000)).toBe(100); // capped at 100
    expect(pct(0)).toBe(0);
  });
});
