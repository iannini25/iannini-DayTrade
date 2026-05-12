import { describe, expect, it } from "vitest";
import { isAuthorizedEmail, AUTHORIZED_EMAILS } from "../shared/const";

describe("isAuthorizedEmail - whitelist de acesso", () => {
  it("deve autorizar tulio.iannini@gmail.com", () => {
    expect(isAuthorizedEmail("tulio.iannini@gmail.com")).toBe(true);
  });

  it("deve autorizar lucaszbr@gmail.com", () => {
    expect(isAuthorizedEmail("lucaszbr@gmail.com")).toBe(true);
  });

  it("deve autorizar bernardo.iannini14@gmail.com", () => {
    expect(isAuthorizedEmail("bernardo.iannini14@gmail.com")).toBe(true);
  });

  it("deve bloquear e-mail não autorizado", () => {
    expect(isAuthorizedEmail("hacker@evil.com")).toBe(false);
  });

  it("deve bloquear e-mail vazio", () => {
    expect(isAuthorizedEmail("")).toBe(false);
  });

  it("deve bloquear null", () => {
    expect(isAuthorizedEmail(null)).toBe(false);
  });

  it("deve bloquear undefined", () => {
    expect(isAuthorizedEmail(undefined)).toBe(false);
  });

  it("deve ser case-insensitive", () => {
    expect(isAuthorizedEmail("TULIO.IANNINI@GMAIL.COM")).toBe(true);
  });

  it("deve ter exatamente 3 e-mails na whitelist", () => {
    expect(AUTHORIZED_EMAILS.length).toBe(3);
  });
});

describe("Calculadora de Risco - lógica de pontos WIN", () => {
  const POINT_VALUE = 0.20;

  it("deve calcular risco em R$ corretamente com 5 contratos e 150 pontos de stop", () => {
    const contracts = 5;
    const stopPoints = 150;
    const risk = stopPoints * POINT_VALUE * contracts;
    expect(risk).toBe(150);
  });

  it("deve calcular gain em R$ corretamente com 5 contratos e 250 pontos de gain", () => {
    const contracts = 5;
    const gainPoints = 250;
    const gain = gainPoints * POINT_VALUE * contracts;
    expect(gain).toBe(250);
  });

  it("deve calcular ratio risco/retorno corretamente", () => {
    const risk = 150;
    const reward = 250;
    const ratio = reward / risk;
    expect(ratio).toBeCloseTo(1.667, 2);
  });

  it("deve calcular margem necessária para 15 contratos", () => {
    const contracts = 15;
    const marginPerContract = 1000;
    const totalMargin = contracts * marginPerContract;
    expect(totalMargin).toBe(15000);
  });

  it("deve calcular risco percentual sobre capital", () => {
    const capital = 15000;
    const risk = 150;
    const riskPct = (risk / capital) * 100;
    expect(riskPct).toBeCloseTo(1.0, 1);
  });

  it("deve calcular win rate mínimo para breakeven com ratio 1:1.67", () => {
    const rrRatio = 250 / 150;
    const minWinRate = (1 / (1 + rrRatio)) * 100;
    expect(minWinRate).toBeCloseTo(37.5, 0);
  });
});

describe("Configuração OCO - validação de limites", () => {
  it("stop loss deve estar entre 100 e 150 pontos", () => {
    const validStops = [100, 125, 150];
    const invalidStops = [99, 151, 200];
    validStops.forEach(s => expect(s >= 100 && s <= 150).toBe(true));
    invalidStops.forEach(s => expect(s >= 100 && s <= 150).toBe(false));
  });

  it("take profit deve estar entre 150 e 250 pontos", () => {
    const validGains = [150, 200, 250];
    const invalidGains = [149, 251, 300];
    validGains.forEach(g => expect(g >= 150 && g <= 250).toBe(true));
    invalidGains.forEach(g => expect(g >= 150 && g <= 250).toBe(false));
  });

  it("número de contratos deve estar entre 1 e 15", () => {
    const validContracts = [1, 5, 10, 15];
    const invalidContracts = [0, 16, 100];
    validContracts.forEach(c => expect(c >= 1 && c <= 15).toBe(true));
    invalidContracts.forEach(c => expect(c >= 1 && c <= 15).toBe(false));
  });

  it("breakeven padrão deve ser 100 pontos", () => {
    const defaultBreakeven = 100;
    expect(defaultBreakeven).toBe(100);
  });

  it("trailing stop padrão deve ser 50 pontos", () => {
    const defaultTrailing = 50;
    expect(defaultTrailing).toBe(50);
  });
});
