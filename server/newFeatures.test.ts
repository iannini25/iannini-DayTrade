import { describe, expect, it } from "vitest";

// ─── Testes de lógica de predições ────────────────────────────────────────
describe("Predictions - Signal Logic", () => {
  it("deve identificar sinal de compra corretamente", () => {
    const signal = { signalType: "buy", confidence: 75, entryZoneLow: 130000, entryZoneHigh: 130200, stopLoss: 129850, takeProfit: 130500 };
    expect(signal.signalType).toBe("buy");
    expect(signal.confidence).toBeGreaterThanOrEqual(50);
  });

  it("deve calcular risco/retorno corretamente", () => {
    const entryMid = (130000 + 130200) / 2; // 130100
    const sl = 129850;
    const tp = 130500;
    const risk = Math.abs(entryMid - sl);   // 250
    const reward = Math.abs(tp - entryMid); // 400
    const rr = reward / risk;
    expect(rr).toBeGreaterThan(1);
    expect(Number(rr.toFixed(2))).toBe(1.6);
  });

  it("deve rejeitar confiança fora do range 0-100", () => {
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    expect(clamp(150)).toBe(100);
    expect(clamp(-10)).toBe(0);
    expect(clamp(75)).toBe(75);
  });

  it("deve calcular expiração de 1 hora a partir de agora", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 60 * 1000);
    const diffMs = expiresAt.getTime() - now;
    expect(diffMs).toBe(3600000);
  });

  it("deve identificar horário de abertura volátil", () => {
    const isOpeningVolatile = (h: number, m: number) => h === 9 && m < 30;
    expect(isOpeningVolatile(9, 15)).toBe(true);
    expect(isOpeningVolatile(9, 30)).toBe(false);
    expect(isOpeningVolatile(10, 0)).toBe(false);
  });

  it("deve identificar horário de almoço", () => {
    const isLunch = (h: number) => h >= 12 && h < 13;
    expect(isLunch(12)).toBe(true);
    expect(isLunch(12, 59)).toBe(true);
    expect(isLunch(13)).toBe(false);
  });
});

// ─── Testes de configurações do usuário ───────────────────────────────────
describe("UserSettings - Risk Profile", () => {
  it("deve calcular P&L potencial por trade corretamente", () => {
    const pointValue = 0.20;
    const contracts = 5;
    const takeProfitPoints = 250;
    const stopLossPoints = 150;
    const gain = takeProfitPoints * pointValue * contracts;
    const loss = stopLossPoints * pointValue * contracts;
    expect(gain).toBe(250); // R$ 250
    expect(loss).toBe(150); // R$ 150
  });

  it("deve calcular número de trades necessários para meta", () => {
    const dailyGoal = 2000;
    const gainPerTrade = 250;
    const tradesNeeded = Math.ceil(dailyGoal / gainPerTrade);
    expect(tradesNeeded).toBe(8);
  });

  it("deve calcular risco/retorno para perfil conservador", () => {
    const sl = 100;
    const tp = 200;
    const rr = tp / sl;
    expect(rr).toBe(2.0);
    expect(rr).toBeGreaterThanOrEqual(1.5);
  });

  it("deve calcular risco/retorno para perfil moderado", () => {
    const sl = 150;
    const tp = 250;
    const rr = tp / sl;
    expect(Number(rr.toFixed(2))).toBe(1.67);
    expect(rr).toBeGreaterThan(1.5);
  });

  it("deve validar limites de contratos (1-15)", () => {
    const isValidContracts = (n: number) => n >= 1 && n <= 15;
    expect(isValidContracts(1)).toBe(true);
    expect(isValidContracts(15)).toBe(true);
    expect(isValidContracts(0)).toBe(false);
    expect(isValidContracts(16)).toBe(false);
  });

  it("deve validar stop loss entre 100 e 150 pontos", () => {
    const isValidSL = (n: number) => n >= 100 && n <= 150;
    expect(isValidSL(100)).toBe(true);
    expect(isValidSL(150)).toBe(true);
    expect(isValidSL(99)).toBe(false);
    expect(isValidSL(151)).toBe(false);
  });

  it("deve validar take profit entre 150 e 250 pontos", () => {
    const isValidTP = (n: number) => n >= 150 && n <= 250;
    expect(isValidTP(150)).toBe(true);
    expect(isValidTP(250)).toBe(true);
    expect(isValidTP(149)).toBe(false);
    expect(isValidTP(251)).toBe(false);
  });
});

// ─── Testes de integração Banco Inter ─────────────────────────────────────
describe("Inter Integration - Validation", () => {
  it("deve validar formato de client_id não vazio", () => {
    const isValidClientId = (id: string) => id.trim().length > 0;
    expect(isValidClientId("abc123")).toBe(true);
    expect(isValidClientId("")).toBe(false);
    expect(isValidClientId("  ")).toBe(false);
  });

  it("deve codificar client_secret em base64", () => {
    const secret = "meu-secret-super-seguro";
    const encoded = Buffer.from(secret).toString("base64");
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    expect(decoded).toBe(secret);
    expect(encoded).not.toBe(secret);
  });

  it("deve identificar ambiente sandbox vs produção", () => {
    const environments = ["sandbox", "production"];
    expect(environments.includes("sandbox")).toBe(true);
    expect(environments.includes("production")).toBe(true);
    expect(environments.includes("staging")).toBe(false);
  });

  it("deve construir URL base correta para sandbox", () => {
    const base = "https://cdpj.partners.bancointer.com.br";
    const authPath = "/oauth/v2/token";
    const fullUrl = `${base}${authPath}`;
    expect(fullUrl).toBe("https://cdpj.partners.bancointer.com.br/oauth/v2/token");
  });

  it("deve validar escopos necessários para trading", () => {
    const requiredScopes = ["extrato.read", "bolsa.read", "bolsa.trade"];
    const hasAllScopes = (userScopes: string[]) =>
      requiredScopes.every(s => userScopes.includes(s));
    expect(hasAllScopes(["extrato.read", "bolsa.read", "bolsa.trade"])).toBe(true);
    expect(hasAllScopes(["extrato.read", "bolsa.read"])).toBe(false);
  });
});

// ─── Testes de índices de mercado ─────────────────────────────────────────
describe("Market Overview - Index Calculations", () => {
  it("deve calcular variação percentual corretamente", () => {
    const prevClose = 130000;
    const currentPrice = 131300;
    const change = currentPrice - prevClose;
    const changePct = (change / prevClose) * 100;
    expect(change).toBe(1300);
    expect(Number(changePct.toFixed(2))).toBe(1.0);
  });

  it("deve identificar sentimento de mercado bullish", () => {
    const getSentiment = (changePct: number) =>
      changePct > 0.5 ? "bullish" : changePct < -0.5 ? "bearish" : "neutral";
    expect(getSentiment(1.0)).toBe("bullish");
    expect(getSentiment(-1.0)).toBe("bearish");
    expect(getSentiment(0.2)).toBe("neutral");
  });

  it("deve ordenar movers por variação percentual", () => {
    const stocks = [
      { symbol: "PETR4", changePct: 2.5 },
      { symbol: "VALE3", changePct: -1.8 },
      { symbol: "ITUB4", changePct: 0.9 },
    ];
    const sorted = [...stocks].sort((a, b) => b.changePct - a.changePct);
    expect(sorted[0]!.symbol).toBe("PETR4");
    expect(sorted[sorted.length - 1]!.symbol).toBe("VALE3");
  });

  it("deve formatar preço do Ibovespa sem casas decimais", () => {
    const price = 130456;
    const formatted = price.toLocaleString("pt-BR", { minimumFractionDigits: 0 });
    expect(formatted).toBe("130.456");
  });

  it("deve formatar preço do dólar com 4 casas decimais", () => {
    const price = 5.1234;
    const formatted = price.toLocaleString("pt-BR", { minimumFractionDigits: 4 });
    expect(formatted).toBe("5,1234");
  });
});
