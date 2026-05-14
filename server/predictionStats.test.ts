import { describe, it, expect } from "vitest";
import { computeStats, formatStatsForPrompt } from "./services/predictionStats";
import type { Prediction } from "../drizzle/schema";

function mockPred(p: Partial<Prediction>): Prediction {
  return {
    id: p.id ?? 1,
    userId: p.userId ?? 1,
    symbol: p.symbol ?? "WIN",
    signalType: p.signalType ?? "buy",
    confidence: p.confidence ?? 70,
    entryZoneLow: p.entryZoneLow ?? "130000",
    entryZoneHigh: p.entryZoneHigh ?? "130100",
    stopLoss: p.stopLoss ?? "129850",
    takeProfit: p.takeProfit ?? "130250",
    reasoning: p.reasoning ?? "",
    marketContext: p.marketContext ?? null,
    riskLevel: p.riskLevel ?? "medium",
    status: p.status ?? "pending",
    expiresAt: p.expiresAt ?? null,
    createdAt: p.createdAt ?? new Date(),
    updatedAt: p.updatedAt ?? new Date(),
  } as Prediction;
}

describe("predictionStats.computeStats", () => {
  it("retorna stats vazias para array vazio", () => {
    const s = computeStats([]);
    expect(s.total).toBe(0);
    expect(s.overallWinRate).toBe(0);
  });

  it("calcula win-rate por sinal", () => {
    const preds = [
      mockPred({ signalType: "buy", status: "won" }),
      mockPred({ signalType: "buy", status: "won" }),
      mockPred({ signalType: "buy", status: "lost" }),
      mockPred({ signalType: "sell", status: "lost" }),
    ];
    const s = computeStats(preds);
    expect(s.bySignal.buy.count).toBe(3);
    expect(s.bySignal.buy.won).toBe(2);
    expect(s.bySignal.buy.winRate).toBeCloseTo(66.7, 0);
    expect(s.bySignal.sell.winRate).toBe(0);
    expect(s.overallWinRate).toBe(50); // 2W de 4 decididas
  });

  it("ignora status pending/ignored/expired no winRate", () => {
    const preds = [
      mockPred({ status: "pending" }),
      mockPred({ status: "ignored" }),
      mockPred({ status: "won" }),
    ];
    const s = computeStats(preds);
    expect(s.total).toBe(3);
    expect(s.totalDecided).toBe(1);
    expect(s.overallWinRate).toBe(100);
  });

  it("classifica por hora do dia (morning < 13h, afternoon >= 13h)", () => {
    const morning = new Date("2026-05-14T10:00:00");
    const afternoon = new Date("2026-05-14T15:00:00");
    const preds = [
      mockPred({ createdAt: morning, status: "won" }),
      mockPred({ createdAt: afternoon, status: "lost" }),
      mockPred({ createdAt: afternoon, status: "won" }),
    ];
    const s = computeStats(preds);
    expect(s.byTimeOfDay.morning.count).toBe(1);
    expect(s.byTimeOfDay.afternoon.count).toBe(2);
    expect(s.byTimeOfDay.afternoon.won).toBe(1);
  });
});

describe("predictionStats.formatStatsForPrompt", () => {
  it("retorna mensagem amigável para primeiro uso", () => {
    const s = computeStats([]);
    expect(formatStatsForPrompt(s)).toContain("sem predições anteriores");
  });

  it("inclui win-rate geral quando há dados", () => {
    const preds = [
      mockPred({ signalType: "buy", status: "won" }),
      mockPred({ signalType: "sell", status: "lost" }),
    ];
    const s = computeStats(preds);
    const out = formatStatsForPrompt(s);
    expect(out).toContain("Win-rate geral");
    expect(out).toContain("últimos 30 dias");
  });
});
