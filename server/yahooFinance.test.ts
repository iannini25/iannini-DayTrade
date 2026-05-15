import { describe, it, expect, vi, afterEach } from "vitest";
import { getStockChart, WIN_SYMBOL_FALLBACKS, extractQuoteMeta } from "./yahooFinance";

const VALID = (symbol: string) => ({
  chart: {
    result: [
      {
        meta: {
          symbol,
          regularMarketPrice: 130000,
          regularMarketDayHigh: 130500,
          regularMarketDayLow: 129500,
          regularMarketVolume: 1000,
          previousClose: 129800,
        },
        timestamp: [1, 2, 3],
        indicators: { quote: [{ open: [1], high: [2], low: [0], close: [1.5], volume: [100] }] },
      },
    ],
    error: null,
  },
});

const EMPTY = {
  chart: { result: [{ meta: { symbol: "X", regularMarketPrice: 0, regularMarketDayHigh: 0, regularMarketDayLow: 0, regularMarketVolume: 0 }, timestamp: [], indicators: { quote: [{ open: [], high: [], low: [], close: [], volume: [] }] } }], error: null },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("yahooFinance.WIN_SYMBOL_FALLBACKS", () => {
  it("contém WIN=F como primeiro fallback e ^BVSP", () => {
    expect(WIN_SYMBOL_FALLBACKS).toContain("WIN=F");
    expect(WIN_SYMBOL_FALLBACKS).toContain("^BVSP");
  });
});

describe("yahooFinance.getStockChart fallback chain", () => {
  it("retorna o primeiro símbolo WIN que traz dados válidos", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const sym = decodeURIComponent(url.split("/chart/")[1]!.split("?")[0]!);
      return {
        ok: true,
        json: async () => (sym === "WIN=F" ? VALID("WIN=F") : EMPTY),
      } as any;
    }));
    const r = await getStockChart({ symbol: "WIN=F" });
    expect(r.resolvedSymbol).toBe("WIN=F");
  });

  it("cai para ^BVSP quando WIN=F vem vazio", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const sym = decodeURIComponent(url.split("/chart/")[1]!.split("?")[0]!);
      return {
        ok: true,
        json: async () => (sym === "^BVSP" ? VALID("^BVSP") : EMPTY),
      } as any;
    }));
    const r = await getStockChart({ symbol: "WIN=F" });
    expect(r.resolvedSymbol).toBe("^BVSP");
  });

  it("lança erro quando nenhum candidato retorna dados", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => EMPTY } as any)));
    await expect(getStockChart({ symbol: "WIN=F" })).rejects.toThrow(/nenhum símbolo/i);
  });

  it("símbolo não-WIN não dispara fallback chain", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => VALID("PETR4.SA") } as any));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getStockChart({ symbol: "PETR4.SA" });
    expect(r.resolvedSymbol).toBe("PETR4.SA");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("yahooFinance.extractQuoteMeta", () => {
  it("extrai preço e variação", () => {
    const meta = extractQuoteMeta(VALID("WIN=F") as any);
    expect(meta?.symbol).toBe("WIN=F");
    expect(meta?.price).toBe(130000);
  });

  it("retorna null para resultado vazio", () => {
    expect(extractQuoteMeta({ chart: { result: null } } as any)).toBeNull();
  });
});
