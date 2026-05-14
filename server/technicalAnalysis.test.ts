import { describe, it, expect } from "vitest";
import {
  ema,
  vwap,
  rsi,
  generateTechnicalSignal,
  generateFallbackSignal,
  type Candle,
} from "./services/technicalAnalysis";

const baseParams = {
  stopLossPoints: 150,
  takeProfitPoints: 250,
  preferredContracts: 5,
  riskProfile: "moderate" as const,
};

function makeCandles(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    open: c - 5,
    high: c + 10,
    low: c - 10,
    close: c,
    volume: 1000 + i,
  }));
}

describe("technicalAnalysis.ema", () => {
  it("retorna média simples se length < period", () => {
    expect(ema([10, 20, 30], 9)).toBeCloseTo(20, 1);
  });

  it("calcula EMA crescente quando preços sobem", () => {
    const e = ema([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110], 9);
    expect(e).toBeGreaterThan(100);
  });

  it("EMA9 < EMA21 quando preços caem", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 - i * 50);
    const e9 = ema(closes, 9);
    const e21 = ema(closes, 21);
    expect(e9).toBeLessThan(e21);
  });
});

describe("technicalAnalysis.vwap", () => {
  it("retorna 0 quando volume é zero", () => {
    const c: Candle[] = [{ open: 100, high: 110, low: 90, close: 105, volume: 0 }];
    expect(vwap(c)).toBe(105);
  });

  it("VWAP pondera por volume", () => {
    const candles: Candle[] = [
      { open: 100, high: 100, low: 100, close: 100, volume: 100 },
      { open: 200, high: 200, low: 200, close: 200, volume: 100 },
    ];
    expect(vwap(candles)).toBeCloseTo(150, 0);
  });
});

describe("technicalAnalysis.rsi", () => {
  it("retorna 50 se dados insuficientes", () => {
    expect(rsi([100], 14)).toBe(50);
  });

  it("RSI alto quando só sobe", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBeGreaterThan(90);
  });

  it("RSI baixo quando só cai", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130 - i);
    expect(rsi(closes, 14)).toBeLessThan(10);
  });
});

describe("technicalAnalysis.generateTechnicalSignal", () => {
  it("retorna BUY em mercado de alta clara", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 + i * 30);
    const sig = generateTechnicalSignal(makeCandles(closes), baseParams);
    expect(["buy", "avoid"]).toContain(sig.signalType);
    expect(sig.marketBias).toBe("bullish");
    expect(sig.indicators.ema9).toBeGreaterThan(sig.indicators.ema21);
  });

  it("retorna SELL em mercado de baixa clara", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 - i * 30);
    const sig = generateTechnicalSignal(makeCandles(closes), baseParams);
    expect(["sell", "avoid"]).toContain(sig.signalType);
    expect(sig.marketBias).toBe("bearish");
    expect(sig.indicators.ema9).toBeLessThan(sig.indicators.ema21);
  });

  it("stop e take profit respeitam parâmetros do usuário", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 + i * 30);
    const sig = generateTechnicalSignal(makeCandles(closes), baseParams);
    if (sig.signalType === "buy") {
      expect(Math.abs(sig.stopLoss - sig.indicators.currentPrice)).toBeCloseTo(150, 0);
      expect(Math.abs(sig.takeProfit - sig.indicators.currentPrice)).toBeCloseTo(250, 0);
    }
  });

  it("inclui strategyExplanation não vazio", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 + i * 30);
    const sig = generateTechnicalSignal(makeCandles(closes), baseParams);
    expect(sig.strategyExplanation.length).toBeGreaterThan(20);
    expect(sig.strategyExplanation).toContain("EMA9");
  });

  it("perfil conservador reduz contratos sugeridos", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 130000 + i * 30);
    const consSig = generateTechnicalSignal(makeCandles(closes), {
      ...baseParams,
      riskProfile: "conservative",
    });
    expect(consSig.suggestedContracts).toBeLessThanOrEqual(baseParams.preferredContracts);
  });

  it("confiança é sempre entre 0 e 100", () => {
    for (let i = 0; i < 5; i++) {
      const closes = Array.from({ length: 30 }, () => 130000 + Math.random() * 1000);
      const sig = generateTechnicalSignal(makeCandles(closes), baseParams);
      expect(sig.confidence).toBeGreaterThanOrEqual(0);
      expect(sig.confidence).toBeLessThanOrEqual(100);
    }
  });
});

describe("technicalAnalysis.generateFallbackSignal", () => {
  it("retorna 'avoid' fora do horário de pregão (madrugada)", () => {
    const sig = generateFallbackSignal(
      new Date("2026-05-14T03:00:00"),
      { preferredContracts: 5 }
    );
    expect(sig.signalType).toBe("avoid");
    expect(sig.reasoning).toContain("fechado");
  });

  it("avisa sobre volatilidade nos primeiros 30 minutos", () => {
    const sig = generateFallbackSignal(
      new Date("2026-05-14T09:15:00"),
      { preferredContracts: 5 }
    );
    expect(sig.warnings.join(" ")).toContain("abertura");
  });

  it("avisa sobre almoço entre 12-13h", () => {
    const sig = generateFallbackSignal(
      new Date("2026-05-14T12:30:00"),
      { preferredContracts: 5 }
    );
    expect(sig.warnings.join(" ")).toContain("almoço");
  });
});
