import { describe, it, expect } from "vitest";
import {
  EDUCATION_TOPICS,
  STATIC_CONTENT,
  buildMarketNarrative,
  getProfitGuide,
} from "./services/education";
import type { TechnicalSignal } from "./services/technicalAnalysis";

describe("education.STATIC_CONTENT", () => {
  it("tem conteúdo para todos os tópicos", () => {
    for (const topic of EDUCATION_TOPICS) {
      expect(STATIC_CONTENT[topic]).toBeDefined();
      expect(STATIC_CONTENT[topic].title.length).toBeGreaterThan(5);
      expect(STATIC_CONTENT[topic].content.length).toBeGreaterThan(100);
    }
  });

  it("inclui os 6 tópicos esperados", () => {
    expect(EDUCATION_TOPICS).toContain("vwap");
    expect(EDUCATION_TOPICS).toContain("ema-cross");
    expect(EDUCATION_TOPICS).toContain("volume");
    expect(EDUCATION_TOPICS).toContain("suporte-resistencia");
    expect(EDUCATION_TOPICS).toContain("risco-retorno");
    expect(EDUCATION_TOPICS).toContain("horarios-pregao");
  });
});

describe("education.buildMarketNarrative", () => {
  it("retorna mensagem de mercado fechado fora do horário sem sinal", () => {
    const n = buildMarketNarrative(null, new Date("2026-05-14T03:00:00"));
    expect(n).toContain("fechado");
  });

  it("descreve tendência de alta quando EMA9 > EMA21 e preço > VWAP", () => {
    const signal = {
      signalType: "buy",
      indicators: { ema9: 130450, ema21: 130200, vwap: 130100, rsi: 55, currentPrice: 130500, high: 0, low: 0 },
    } as TechnicalSignal;
    const n = buildMarketNarrative(signal, new Date("2026-05-14T11:00:00"));
    expect(n).toContain("alta");
    expect(n).toContain("comprador");
    expect(n).toMatch(/130500|130\.500/);
  });

  it("avisa sobre sobrecompra quando RSI >= 70", () => {
    const signal = {
      signalType: "neutral",
      indicators: { ema9: 100, ema21: 100, vwap: 100, rsi: 78, currentPrice: 100, high: 0, low: 0 },
    } as TechnicalSignal;
    const n = buildMarketNarrative(signal, new Date("2026-05-14T11:00:00"));
    expect(n).toContain("sobrecompra");
  });
});

describe("education.getProfitGuide", () => {
  it("retorna array de seções com título e conteúdo", () => {
    const g = getProfitGuide();
    expect(g.length).toBeGreaterThanOrEqual(3);
    for (const s of g) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.content.length).toBeGreaterThan(50);
    }
  });

  it("cobre código NTSL, configurações e limitações", () => {
    const joined = getProfitGuide().map((s) => s.title + s.content).join(" ").toLowerCase();
    expect(joined).toContain("ntsl");
    expect(joined).toContain("timeframe");
    expect(joined).toContain("limitaç");
  });
});
