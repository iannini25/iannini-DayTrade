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
  breakevenPoints?: number; // default 100
  horaInicio?: number; // HHMM, default 915
  horaFim?: number; // HHMM, default 1700
};

export function generateNtslCode(inputs: NtslInputs): string {
  const {
    entryPrice, stopLossPoints, takeProfitPoints, contracts, signalType,
    breakevenPoints = 100, horaInicio = 915, horaFim = 1700,
  } = inputs;

  const entryComment =
    signalType === "buy"
      ? "// Vies da IA: COMPRA — priorize entradas compradoras neste ciclo"
      : signalType === "sell"
        ? "// Vies da IA: VENDA — priorize entradas vendedoras neste ciclo"
        : signalType === "avoid"
          ? "// Vies da IA: NAO OPERAR — condicao desfavoravel, aguarde reversao"
          : "// Vies da IA: NEUTRO — aguarde direcao definida antes de operar";

  return `// ============================================================
// Estrategia gerada por Iannini Day Trade (IA Operacional)
// Gerado em: ${new Date().toLocaleString("pt-BR")}
// Cole no editor de estrategias do Profit One Pro (Neologica NTSL v4.3)
// Timeframe recomendado: 5 minutos | Execucao: Tick a Tick
// ============================================================

input
  EntradaPreco(${entryPrice.toFixed(0)});      // Preco de referencia da analise
  StopLoss(${stopLossPoints});                 // Stop em pontos
  TakeProfit(${takeProfitPoints});             // Alvo em pontos
  Contratos(${contracts});                     // Quantidade de contratos
  BreakevenAtivacao(${breakevenPoints});       // Pontos de lucro p/ mover stop ao zero a zero
  HoraInicio(${horaInicio});                   // Nao opera antes (HHMM)
  HoraFim(${horaFim});                         // Nao opera depois (HHMM)

var
  sEMA9     : Float;
  sEMA21    : Float;
  sVWAP     : Float;
  bComprado : Boolean;
  bVendido  : Boolean;

begin
  sEMA9     := Media(9, Close);
  sEMA21    := Media(21, Close);
  sVWAP     := VWAP;
  bComprado := IsBought;
  bVendido  := IsSold;

  // Filtro de horario — so opera dentro da janela definida
  if (CurrentTime < HoraInicio) or (CurrentTime > HoraFim) then
  begin
    // Fora do horario: nao envia novas ordens
    SetStopLoss(StopLoss);
    SetProfitTarget(TakeProfit);
    exit;
  end;

  ${entryComment}

  // Entrada COMPRA: EMA9 acima da EMA21 e preco acima da VWAP
  if (sEMA9 > sEMA21) and (Close > sVWAP) and (not bComprado) and (not bVendido) then
    BuyAtMarket(Contratos);

  // Entrada VENDA: EMA9 abaixo da EMA21 e preco abaixo da VWAP
  if (sEMA9 < sEMA21) and (Close < sVWAP) and (not bVendido) and (not bComprado) then
    SellShortAtMarket(Contratos);

  // Gestao de risco (stop e alvo sempre ativos)
  SetStopLoss(StopLoss);
  SetProfitTarget(TakeProfit);

  // Breakeven automatico: ao atingir +BreakevenAtivacao pontos a favor,
  // move o stop para o preco de entrada (protege o trade)
  if bComprado and (Close >= EntradaPreco + BreakevenAtivacao) then
    SetStopLoss(0);
  if bVendido and (Close <= EntradaPreco - BreakevenAtivacao) then
    SetStopLoss(0);
end;`;
}

export type SignalQuality = {
  level: "forte" | "moderado" | "fraco";
  label: string;
  warning: string | null;
  color: string;
};

/**
 * Classifica a qualidade do sinal pela confiança (M2c do prompt v4).
 */
export function getSignalQuality(confidence: number): SignalQuality {
  if (confidence >= 75) {
    return { level: "forte", label: "Forte", warning: null, color: "text-buy" };
  }
  if (confidence >= 50) {
    return {
      level: "moderado",
      label: "Moderado",
      warning: null,
      color: "text-amber-400",
    };
  }
  return {
    level: "fraco",
    label: "Fraco",
    warning: "Aguarde confirmação antes de operar.",
    color: "text-sell",
  };
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
