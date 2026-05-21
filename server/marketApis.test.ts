import { describe, it, expect, vi, afterEach } from "vitest";
import { getUsdBrlAwesome, getSmallCapB3 } from "./marketApis";

afterEach(() => vi.restoreAllMocks());

describe("marketApis.getUsdBrlAwesome", () => {
  it("parseia resposta válida da AwesomeAPI", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        USDBRL: {
          bid: "5.0582",
          ask: "5.0590",
          high: "5.0700",
          low: "5.0400",
          varBid: "0.0107",
          pctChange: "0.21",
          timestamp: "1747606620",
        },
      }),
    } as any)));
    const r = await getUsdBrlAwesome();
    expect(r).not.toBeNull();
    expect(r!.price).toBeCloseTo(5.0582, 4);
    expect(r!.changePct).toBeCloseTo(0.21, 2);
    expect(r!.source).toBe("awesomeapi");
    expect(r!.high).toBe(5.07);
    expect(r!.low).toBe(5.04);
  });

  it("retorna null para HTTP não-ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 } as any)));
    expect(await getUsdBrlAwesome()).toBeNull();
  });

  it("retorna null se fetch lançar (timeout/network)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET"); }));
    expect(await getUsdBrlAwesome()).toBeNull();
  });

  it("retorna null se bid for inválido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ USDBRL: { bid: "abc" } }),
    } as any)));
    expect(await getUsdBrlAwesome()).toBeNull();
  });

  it("retorna null se a chave USDBRL não vier no payload", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) } as any)));
    expect(await getUsdBrlAwesome()).toBeNull();
  });
});

describe("marketApis.getSmallCapB3", () => {
  it("parseia o formato Trad[0].scty.SctyQtn da B3", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        Trad: [
          {
            scty: {
              SctyQtn: {
                curPrc: 109.2,
                prcFlcn: -0.012658,
                maxPric: 110.44,
                minPric: 108.0,
              },
            },
          },
        ],
      }),
    } as any)));
    const r = await getSmallCapB3();
    expect(r).not.toBeNull();
    expect(r!.price).toBe(109.2);
    expect(r!.high).toBe(110.44);
    expect(r!.low).toBe(108);
    expect(r!.changePct).toBeCloseTo(-1.27, 1);
    expect(r!.source).toBe("b3-smal11");
  });

  it("aceita formato com SctyQtn na raiz", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ SctyQtn: { curPrc: 100, prcFlcn: 0, maxPric: 101, minPric: 99 } }),
    } as any)));
    const r = await getSmallCapB3();
    expect(r?.price).toBe(100);
  });

  it("retorna null para HTTP não-ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 } as any)));
    expect(await getSmallCapB3()).toBeNull();
  });

  it("retorna null se preço vier zero/ausente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ SctyQtn: { curPrc: 0 } }),
    } as any)));
    expect(await getSmallCapB3()).toBeNull();
  });

  it("retorna null se fetch lançar (B3 bloqueada/timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("blocked"); }));
    expect(await getSmallCapB3()).toBeNull();
  });
});
