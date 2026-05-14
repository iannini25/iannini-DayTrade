import { describe, it, expect } from "vitest";
import {
  getActiveWinSymbol,
  resolveActiveWinContract,
  getExpiryDate,
} from "./lib/winContract";

describe("winContract.getExpiryDate", () => {
  // Quarta-feira entre dias 12-18 em cada mês de vencimento
  it("retorna 18-fev-2026 para FEV/26 (quarta entre 12 e 18)", () => {
    const d = getExpiryDate(2026, 2);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(1); // fevereiro
    expect(d.getUTCDate()).toBe(18);
    expect(d.getUTCDay()).toBe(3); // quarta-feira
  });

  it("retorna quarta-feira de junho/2026", () => {
    const d = getExpiryDate(2026, 6);
    expect(d.getUTCDay()).toBe(3);
    expect(d.getUTCDate()).toBeGreaterThanOrEqual(12);
    expect(d.getUTCDate()).toBeLessThanOrEqual(18);
  });

  it("retorna quarta-feira de dezembro/2026", () => {
    const d = getExpiryDate(2026, 12);
    expect(d.getUTCDay()).toBe(3);
    expect(d.getUTCDate()).toBeGreaterThanOrEqual(12);
    expect(d.getUTCDate()).toBeLessThanOrEqual(18);
  });
});

describe("winContract.resolveActiveWinContract", () => {
  it("em 01-jan-2026 retorna WING26 (FEV/26)", () => {
    const c = resolveActiveWinContract(new Date("2026-01-01T12:00:00Z"));
    expect(c.symbol).toBe("WING26");
    expect(c.monthCode).toBe("G");
    expect(c.expiryMonth).toBe(2);
    expect(c.expiryYear).toBe(2026);
    expect(c.daysToExpiry).toBeGreaterThan(0);
  });

  it("em 14-mai-2026 retorna WINM26 (JUN/26)", () => {
    const c = resolveActiveWinContract(new Date("2026-05-14T12:00:00Z"));
    expect(c.symbol).toBe("WINM26");
    expect(c.monthCode).toBe("M");
    expect(c.expiryMonth).toBe(6);
    expect(c.nearExpiry).toBe(false);
  });

  it("avança para o próximo contrato APOS o vencimento", () => {
    // Dia seguinte ao vencimento de JUN/26 = ~18-jun-2026 + 1
    const after = new Date("2026-06-19T12:00:00Z");
    const c = resolveActiveWinContract(after);
    expect(c.expiryMonth).toBe(8); // próximo é AGO
    expect(c.monthCode).toBe("Q");
    expect(c.symbol).toBe("WINQ26");
  });

  it("vira o ano corretamente: jan/27 após DEZ/26", () => {
    const c = resolveActiveWinContract(new Date("2027-01-05T12:00:00Z"));
    expect(c.expiryYear).toBe(2027);
    expect(c.expiryMonth).toBe(2);
    expect(c.symbol).toBe("WING27");
  });

  it("marca nearExpiry quando faltam <= 5 dias", () => {
    // 2 dias antes do vencimento de JUN/26 (18-jun-2026)
    const c = resolveActiveWinContract(new Date("2026-06-16T12:00:00Z"));
    expect(c.expiryMonth).toBe(6);
    expect(c.nearExpiry).toBe(true);
    expect(c.daysToExpiry).toBeLessThanOrEqual(5);
  });

  it("yahooSymbol é sempre WIN=F (continuous, não por contrato)", () => {
    const c = resolveActiveWinContract();
    expect(c.yahooSymbol).toBe("WIN=F");
  });
});

describe("winContract.getActiveWinSymbol", () => {
  it("retorna apenas o código do contrato", () => {
    const s = getActiveWinSymbol(new Date("2026-05-14T12:00:00Z"));
    expect(s).toBe("WINM26");
  });

  it("formato sempre WIN + letra + 2 dígitos", () => {
    const s = getActiveWinSymbol();
    expect(s).toMatch(/^WIN[GJMQVZ]\d{2}$/);
  });
});
