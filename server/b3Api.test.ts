import { describe, it, expect, vi, afterEach } from "vitest";
import { getB3WinQuote, getB3WinContracts, getActiveWinContract } from "./b3Api";

afterEach(() => vi.restoreAllMocks());

describe("b3Api.getB3WinQuote", () => {
  it("parseia o formato SctyQtn da B3", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        SctyQtn: {
          curPrc: 130250,
          opngPric: 129800,
          minPric: 129500,
          maxPric: 130600,
          prvsDayAdjstmntPric: 129900,
          oscnPctg: 0.27,
          tradQty: 154321,
          avrgPric: 130100,
        },
      }),
    } as any)));
    const q = await getB3WinQuote("WINM26");
    expect(q).not.toBeNull();
    expect(q!.price).toBe(130250);
    expect(q!.open).toBe(129800);
    expect(q!.min).toBe(129500);
    expect(q!.max).toBe(130600);
    expect(q!.changePercent).toBe(0.27);
    expect(q!.vwap).toBe(130100);
  });

  it("retorna null se a B3 responder não-ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 } as any)));
    expect(await getB3WinQuote("WINM26")).toBeNull();
  });

  it("retorna null se o fetch lançar (timeout/bloqueio)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    expect(await getB3WinQuote("WINM26")).toBeNull();
  });

  it("retorna null se preço vier zero/ausente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, json: async () => ({ SctyQtn: { curPrc: 0 } }),
    } as any)));
    expect(await getB3WinQuote("WINM26")).toBeNull();
  });

  it("calcula changePercent a partir do prevClose quando oscnPctg ausente", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ SctyQtn: { curPrc: 101000, prvsDayAdjstmntPric: 100000 } }),
    } as any)));
    const q = await getB3WinQuote("WINM26");
    expect(q!.changePercent).toBeCloseTo(1, 1);
  });
});

describe("b3Api.getB3WinContracts", () => {
  it("retorna [] em falha (defensivo)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 } as any)));
    expect(await getB3WinContracts()).toEqual([]);
  });

  it("extrai símbolos de lista", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ Scty: [{ symb: "WINM26" }, { symb: "WINQ26" }] }),
    } as any)));
    const cs = await getB3WinContracts();
    expect(cs.map((c) => c.symbol)).toContain("WINM26");
  });
});

describe("b3Api.getActiveWinContract", () => {
  it("sempre retorna símbolo (resolvido localmente) mesmo se B3 cair", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("blocked"); }));
    const r = await getActiveWinContract();
    expect(r.symbol).toMatch(/^WIN[GJMQVZ]\d{2}$/);
    expect(r.quote).toBeNull();
  });
});
