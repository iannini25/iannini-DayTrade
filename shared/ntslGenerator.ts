/**
 * ntslGenerator.ts — Gera código NTSL (Neologica Trading Strategy Language)
 * compatível com Profit One Pro a partir de uma predição da IA.
 *
 * Sintaxe baseada na documentação Neologica v4.3. O código gerado é uma
 * estratégia de cruzamento EMA + filtro VWAP, com stop e take profit
 * configurados pelos parâmetros da predição.
 *
 * IMPORTANTE: este arquivo está em shared/ para poder ser usado tanto no
 * server (gerar quando salva a predição) quanto no client (regenerar com
 * inputs interativos no /ai-trading).
 */

export type NtslInputs = {
  entryPrice: number;
  stopLossPoints: number;
  takeProfitPoints: number;
  contracts: number;
  signalType: "buy" | "sell" | "neutral" | "avoid";
};

export function generateNtslCode(inputs: NtslInputs): string {
  const { entryPrice, stopLossPoints, takeProfitPoints, contracts, signalType } = inputs;

  const entryComment =
    signalType === "buy"
      ? "// Sinal de COMPRA — entrada a mercado em alta confirmada"
      : signalType === "sell"
        ? "// Sinal de VENDA — entrada a mercado em baixa confirmada"
        : signalType === "avoid"
          ? "// Sinal: NÃO operar agora — aguardar reversão de condição"
          : "// Sinal NEUTRO — aguardar direção definida";

  return `// ============================================================
// Estratégia gerada por Iannini Day Trade (IA Operacional)
// ${new Date().toLocaleString("pt-BR")}
// ============================================================

input
  EntradaPreco(${entryPrice.toFixed(0)});
  StopLoss(${stopLossPoints});
  TakeProfit(${takeProfitPoints});
  Contratos(${contracts});

var
  sEMA9    : Float;
  sEMA21   : Float;
  sVWAP    : Float;
  sCruzou  : Boolean;

begin
  sEMA9  := Media(9, Close);
  sEMA21 := Media(21, Close);
  sVWAP  := VWAP;

  ${entryComment}
  if (sEMA9 > sEMA21) and (Close > sVWAP) and (not IsBought) then
    BuyAtMarket(Contratos)
  else if (sEMA9 < sEMA21) and (Close < sVWAP) and (not IsSold) then
    SellShortAtMarket(Contratos);

  // Gestão de risco
  SetStopLoss(StopLoss);
  SetProfitTarget(TakeProfit);

  // Breakeven automático ao atingir +100 pontos
  if IsBought and (Close >= EntradaPreco + 100) then
    SetStopLoss(0);
  if IsSold and (Close <= EntradaPreco - 100) then
    SetStopLoss(0);
end;`;
}

/**
 * Gera o "passo a passo didático" (M6b) a partir dos parâmetros da predição.
 * Útil para usuários menos experientes seguirem a operação manualmente.
 */
export type StepByStepInputs = {
  signalType: "buy" | "sell" | "neutral" | "avoid";
  currentPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  takeProfit: number;
  stopPoints: number;
  gainPoints: number;
  contracts: number;
  ema9?: number;
  ema21?: number;
  vwap?: number;
};

export function generateStepByStep(p: StepByStepInputs): string[] {
  const steps: string[] = [];
  const entryMid = Math.round((p.entryZoneLow + p.entryZoneHigh) / 2);
  const sideWord = p.signalType === "buy" ? "Compre" : p.signalType === "sell" ? "Venda" : "Aguarde";

  if (p.signalType === "avoid" || p.signalType === "neutral") {
    steps.push("**Não operar agora.** A análise atual não recomenda envio de ordens.");
    if (p.ema9 != null && p.ema21 != null) {
      steps.push(
        `Indicadores: EMA9 = ${p.ema9.toFixed(0)}, EMA21 = ${p.ema21.toFixed(0)}. Aguarde alinhamento claro de tendência.`
      );
    }
    steps.push("Recarregue a análise em alguns minutos ou aguarde mudança no fluxo de mercado.");
    return steps;
  }

  // Passo 1 — Diagnóstico
  if (p.ema9 != null && p.ema21 != null) {
    const dir = p.signalType === "buy" ? "alta" : "baixa";
    steps.push(
      `O mercado está em tendência de ${dir}. EMA9 (${p.ema9.toFixed(0)}) está ${p.signalType === "buy" ? "acima" : "abaixo"} da EMA21 (${p.ema21.toFixed(0)}).`
    );
  } else {
    steps.push(`Sinal de ${p.signalType === "buy" ? "COMPRA" : "VENDA"} identificado.`);
  }

  // Passo 2 — Zona de entrada
  steps.push(
    `Aguarde o preço ${p.signalType === "buy" ? "recuar" : "subir"} para a zona de entrada: entre **${p.entryZoneLow.toFixed(0)}** e **${p.entryZoneHigh.toFixed(0)}**.`
  );

  // Passo 3 — Entrada
  steps.push(
    `${sideWord} **${p.contracts} contrato${p.contracts > 1 ? "s" : ""}** a mercado quando o preço tocar **${entryMid}**.`
  );

  // Passo 4 — Stop
  steps.push(
    `Configure o Stop Loss em **${p.stopLoss.toFixed(0)}** (${p.stopPoints} pontos ${p.signalType === "buy" ? "abaixo" : "acima"} da entrada).`
  );

  // Passo 5 — Gain
  steps.push(
    `Configure o Take Profit em **${p.takeProfit.toFixed(0)}** (${p.gainPoints} pontos ${p.signalType === "buy" ? "acima" : "abaixo"} da entrada).`
  );

  // Passo 6 — Breakeven
  const breakevenLevel =
    p.signalType === "buy" ? entryMid + 100 : entryMid - 100;
  steps.push(
    `Se o preço atingir **${breakevenLevel}** (+100 pts a favor), mova o stop para o breakeven (**${entryMid}**) para proteger o trade.`
  );

  return steps;
}
