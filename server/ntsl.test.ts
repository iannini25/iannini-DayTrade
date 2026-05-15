import { describe, it, expect } from "vitest";
import { generateNtslCode, generateStepByStep, getSignalQuality } from "../shared/ntslGenerator";

describe("ntslGenerator.generateNtslCode", () => {
  it("inclui entry price, stop, take profit e contratos nos inputs", () => {
    const code = generateNtslCode({
      entryPrice: 130250,
      stopLossPoints: 150,
      takeProfitPoints: 250,
      contracts: 5,
      signalType: "buy",
    });
    expect(code).toContain("EntradaPreco(130250)");
    expect(code).toContain("StopLoss(150)");
    expect(code).toContain("TakeProfit(250)");
    expect(code).toContain("Contratos(5)");
  });

  it("contém estrutura NTSL básica (input/var/begin/end)", () => {
    const code = generateNtslCode({
      entryPrice: 130000,
      stopLossPoints: 100,
      takeProfitPoints: 200,
      contracts: 3,
      signalType: "buy",
    });
    expect(code).toMatch(/input/);
    expect(code).toMatch(/var/);
    expect(code).toMatch(/begin/);
    expect(code).toMatch(/end;/);
    expect(code).toMatch(/Media\(9, Close\)/);
    expect(code).toMatch(/Media\(21, Close\)/);
    expect(code).toMatch(/VWAP/);
  });

  it("usa BuyAtMarket para compra", () => {
    const code = generateNtslCode({
      entryPrice: 130000, stopLossPoints: 150, takeProfitPoints: 250,
      contracts: 5, signalType: "buy",
    });
    expect(code).toContain("BuyAtMarket(Contratos)");
    expect(code).toContain("SellShortAtMarket(Contratos)");
  });

  it("comentário difere para avoid/neutral", () => {
    const avoid = generateNtslCode({
      entryPrice: 130000, stopLossPoints: 150, takeProfitPoints: 250,
      contracts: 5, signalType: "avoid",
    });
    expect(avoid).toContain("NAO OPERAR");
  });

  it("inclui lógica de breakeven", () => {
    const code = generateNtslCode({
      entryPrice: 130250, stopLossPoints: 150, takeProfitPoints: 250,
      contracts: 5, signalType: "buy",
    });
    expect(code.toLowerCase()).toContain("breakeven");
    expect(code).toContain("BreakevenAtivacao");
  });

  it("inclui filtro de horário (HoraInicio/HoraFim) com defaults 915/1700", () => {
    const code = generateNtslCode({
      entryPrice: 130250, stopLossPoints: 150, takeProfitPoints: 250,
      contracts: 5, signalType: "buy",
    });
    expect(code).toContain("HoraInicio(915)");
    expect(code).toContain("HoraFim(1700)");
    expect(code).toContain("CurrentTime < HoraInicio");
  });

  it("respeita horaInicio/horaFim customizados", () => {
    const code = generateNtslCode({
      entryPrice: 130000, stopLossPoints: 100, takeProfitPoints: 200,
      contracts: 3, signalType: "sell", horaInicio: 1000, horaFim: 1600,
    });
    expect(code).toContain("HoraInicio(1000)");
    expect(code).toContain("HoraFim(1600)");
  });
});

describe("ntslGenerator.getSignalQuality", () => {
  it("confiança >= 75 = Forte sem aviso", () => {
    const q = getSignalQuality(80);
    expect(q.level).toBe("forte");
    expect(q.warning).toBeNull();
  });

  it("confiança 50-74 = Moderado sem aviso", () => {
    expect(getSignalQuality(60).level).toBe("moderado");
    expect(getSignalQuality(74).level).toBe("moderado");
    expect(getSignalQuality(50).level).toBe("moderado");
  });

  it("confiança < 50 = Fraco com aviso", () => {
    const q = getSignalQuality(40);
    expect(q.level).toBe("fraco");
    expect(q.warning).toContain("Aguarde confirmação");
  });

  it("limites exatos: 75 forte, 49 fraco", () => {
    expect(getSignalQuality(75).level).toBe("forte");
    expect(getSignalQuality(49).level).toBe("fraco");
  });
});

describe("ntslGenerator.generateStepByStep", () => {
  const baseInputs = {
    signalType: "buy" as const,
    currentPrice: 130350,
    entryZoneLow: 130300,
    entryZoneHigh: 130400,
    stopLoss: 130200,
    takeProfit: 130600,
    stopPoints: 150,
    gainPoints: 250,
    contracts: 5,
    ema9: 130450,
    ema21: 130200,
    vwap: 130350,
  };

  it("retorna 6 passos para sinal de compra", () => {
    const steps = generateStepByStep(baseInputs);
    expect(steps.length).toBe(6);
    expect(steps[0]).toContain("alta");
    expect(steps[0]).toContain("EMA9");
    expect(steps[2]).toContain("Compre");
    expect(steps[2]).toContain("5 contrato");
  });

  it("inverte direção para venda", () => {
    const steps = generateStepByStep({
      ...baseInputs,
      signalType: "sell",
      ema9: 130200,
      ema21: 130400,
    });
    expect(steps[0]).toContain("baixa");
    expect(steps[2]).toContain("Venda");
  });

  it("retorna passos diferentes para avoid (não opera)", () => {
    const steps = generateStepByStep({ ...baseInputs, signalType: "avoid" });
    expect(steps.length).toBeLessThan(6);
    expect(steps[0]).toContain("Não operar");
  });

  it("inclui breakeven no passo final", () => {
    const steps = generateStepByStep(baseInputs);
    expect(steps[steps.length - 1]).toMatch(/breakeven|\+100/i);
  });
});
