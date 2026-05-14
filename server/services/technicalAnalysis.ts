/**
 * technicalAnalysis.ts — Motor de análise técnica server-side.
 *
 * Calcula EMA9, EMA21, VWAP e RSI a partir de candles, e produz um sinal
 * de operação determinístico (sem LLM). Usado como fallback do
 * `predictions.generate` quando OpenAI não está configurada ou falha.
 */

import type { YFChartResult } from "../yahooFinance";

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TechnicalSignal = {
  signalType: "buy" | "sell" | "neutral" | "avoid";
  confidence: number; // 0-100
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  takeProfit: number;
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
  strategyExplanation: string;
  keyLevels: string[];
  marketBias: "bullish" | "bearish" | "sideways";
  suggestedContracts: number;
  validUntil: string;
  warnings: string[];
  // Valores brutos dos indicadores (para auditoria e UI)
  indicators: {
    ema9: number;
    ema21: number;
    vwap: number;
    rsi: number;
    currentPrice: number;
    high: number;
    low: number;
  };
};

export function extractCandles(result: YFChartResult): Candle[] {
  const r = result?.chart?.result?.[0];
  if (!r) return [];
  const q = r.indicators?.quote?.[0];
  if (!q) return [];
  const len = q.close?.length ?? 0;
  const candles: Candle[] = [];
  for (let i = 0; i < len; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ open: o, high: h, low: l, close: c, volume: v ?? 0 });
  }
  return candles;
}

/** EMA (exponential moving average) — período `p` sobre `values`. */
export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length < period) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    e = values[i]! * k + e * (1 - k);
  }
  return e;
}

/** VWAP cumulativo a partir dos candles (do início da sessão). */
export function vwap(candles: Candle[]): number {
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumVol += c.volume;
  }
  return cumVol > 0 ? cumPV / cumVol : (candles[candles.length - 1]?.close ?? 0);
}

/** RSI (Relative Strength Index) — período 14 padrão. */
export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Gera um sinal de operação determinístico a partir dos candles e dos
 * parâmetros do usuário. Lógica simples baseada em cruzamento EMA + posição
 * relativa à VWAP + RSI.
 */
export function generateTechnicalSignal(
  candles: Candle[],
  params: {
    stopLossPoints: number;
    takeProfitPoints: number;
    preferredContracts: number;
    riskProfile: "conservative" | "moderate" | "aggressive";
  }
): TechnicalSignal {
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1] ?? 0;
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const vwapValue = vwap(candles);
  const rsiValue = rsi(closes, 14);

  // Sinal: cruzamento EMA + posição vs VWAP + RSI
  const emaBull = ema9 > ema21;
  const aboveVwap = currentPrice > vwapValue;
  const overbought = rsiValue >= 70;
  const oversold = rsiValue <= 30;

  let signalType: TechnicalSignal["signalType"];
  let marketBias: TechnicalSignal["marketBias"];
  let confidence = 50;
  const warnings: string[] = [];

  if (overbought && emaBull) {
    signalType = "avoid";
    marketBias = "bullish";
    confidence = 40;
    warnings.push(`RSI ${rsiValue.toFixed(0)} em sobrecompra — evitar entrada agora.`);
  } else if (oversold && !emaBull) {
    signalType = "avoid";
    marketBias = "bearish";
    confidence = 40;
    warnings.push(`RSI ${rsiValue.toFixed(0)} em sobrevenda — evitar entrada agora.`);
  } else if (emaBull && aboveVwap) {
    signalType = "buy";
    marketBias = "bullish";
    confidence = 65 + Math.min(20, Math.round(((ema9 - ema21) / Math.max(1, ema21)) * 1000));
  } else if (!emaBull && !aboveVwap) {
    signalType = "sell";
    marketBias = "bearish";
    confidence = 65 + Math.min(20, Math.round(((ema21 - ema9) / Math.max(1, ema21)) * 1000));
  } else {
    signalType = "neutral";
    marketBias = "sideways";
    confidence = 50;
    warnings.push("EMA e VWAP em direções contrárias — mercado indeciso.");
  }

  // Stop / Gain
  const sl = params.stopLossPoints;
  const tp = params.takeProfitPoints;
  let stopLoss: number;
  let takeProfit: number;
  let entryZoneLow: number;
  let entryZoneHigh: number;

  if (signalType === "buy") {
    entryZoneLow = currentPrice - 50;
    entryZoneHigh = currentPrice + 50;
    stopLoss = currentPrice - sl;
    takeProfit = currentPrice + tp;
  } else if (signalType === "sell") {
    entryZoneLow = currentPrice - 50;
    entryZoneHigh = currentPrice + 50;
    stopLoss = currentPrice + sl;
    takeProfit = currentPrice - tp;
  } else {
    entryZoneLow = currentPrice - 100;
    entryZoneHigh = currentPrice + 100;
    stopLoss = currentPrice - sl;
    takeProfit = currentPrice + tp;
  }

  const riskLevel: TechnicalSignal["riskLevel"] =
    confidence >= 70 ? "low" : confidence >= 50 ? "medium" : "high";

  const suggestedContracts = (() => {
    const base = params.preferredContracts;
    if (signalType === "avoid" || signalType === "neutral") return Math.max(1, Math.floor(base / 2));
    if (params.riskProfile === "conservative") return Math.max(1, Math.floor(base * 0.7));
    if (params.riskProfile === "aggressive") return base;
    return base;
  })();

  // Próxima hora cheia
  const validUntilDate = new Date(Date.now() + 60 * 60 * 1000);
  const validUntil = `${String(validUntilDate.getHours()).padStart(2, "0")}:${String(validUntilDate.getMinutes()).padStart(2, "0")}`;

  // Suporte/resistência baseados em high/low recentes
  const recentHigh = Math.max(...candles.slice(-20).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-20).map((c) => c.low));
  const keyLevels = [
    `Resistência recente: ${recentHigh.toFixed(0)}`,
    `VWAP: ${vwapValue.toFixed(0)}`,
    `Suporte recente: ${recentLow.toFixed(0)}`,
  ];

  const reasoning = [
    `Análise técnica determinística (sem IA).`,
    `EMA9 = ${ema9.toFixed(0)}, EMA21 = ${ema21.toFixed(0)} → tendência ${emaBull ? "ALTA" : "BAIXA"}.`,
    `Preço atual ${currentPrice.toFixed(0)} ${aboveVwap ? "acima" : "abaixo"} da VWAP (${vwapValue.toFixed(0)}).`,
    `RSI ${rsiValue.toFixed(0)} → ${overbought ? "sobrecompra" : oversold ? "sobrevenda" : "neutro"}.`,
    `Sinal: ${signalType.toUpperCase()} com confiança ${confidence}%.`,
  ].join(" ");

  const strategyExplanation = (() => {
    if (signalType === "buy") {
      return `Estratégia: continuação de alta. EMA9 (${ema9.toFixed(0)}) > EMA21 (${ema21.toFixed(0)}) confirma tendência altista, e preço acima da VWAP (${vwapValue.toFixed(0)}) mostra fluxo comprador. Entrada na zona ${entryZoneLow.toFixed(0)}-${entryZoneHigh.toFixed(0)}, stop em ${stopLoss.toFixed(0)} (${sl} pts), alvo em ${takeProfit.toFixed(0)} (${tp} pts). R/R = 1:${(tp / sl).toFixed(2)}.`;
    }
    if (signalType === "sell") {
      return `Estratégia: continuação de baixa. EMA9 (${ema9.toFixed(0)}) < EMA21 (${ema21.toFixed(0)}) confirma tendência baixista, e preço abaixo da VWAP (${vwapValue.toFixed(0)}) mostra fluxo vendedor. Entrada na zona ${entryZoneLow.toFixed(0)}-${entryZoneHigh.toFixed(0)}, stop em ${stopLoss.toFixed(0)} (${sl} pts), alvo em ${takeProfit.toFixed(0)} (${tp} pts). R/R = 1:${(tp / sl).toFixed(2)}.`;
    }
    if (signalType === "avoid") {
      return `Estratégia: NÃO operar agora. ${warnings.join(" ")} Aguarde RSI normalizar e VWAP alinhar com EMA9.`;
    }
    return `Estratégia: aguardar. EMA9 e VWAP em direções opostas indicam indecisão. Confirme uma direção dominante antes de entrar.`;
  })();

  return {
    signalType,
    confidence: Math.min(100, Math.max(0, confidence)),
    entryZoneLow,
    entryZoneHigh,
    stopLoss,
    takeProfit,
    riskLevel,
    reasoning,
    strategyExplanation,
    keyLevels,
    marketBias,
    suggestedContracts,
    validUntil,
    warnings,
    indicators: {
      ema9,
      ema21,
      vwap: vwapValue,
      rsi: rsiValue,
      currentPrice,
      high: recentHigh,
      low: recentLow,
    },
  };
}

/**
 * Fallback de última instância: usa apenas o horário do mercado.
 * Não tem dados de preço.
 */
export function generateFallbackSignal(
  now: Date,
  params: { preferredContracts: number }
): TechnicalSignal {
  const hour = now.getHours();
  const isPreMarket = hour < 9 || (hour === 9 && now.getMinutes() < 0);
  const isOpening = hour === 9 && now.getMinutes() < 30;
  const isLunch = hour >= 12 && hour < 13;
  const isClosing = hour >= 16 && hour < 17;
  const isAfterHours = hour >= 18 || hour < 9;

  let reasoning: string;
  let warnings: string[];

  if (isAfterHours) {
    reasoning = "Mercado fechado. Operações de Mini Índice ocorrem das 9h às 18h (horário B3).";
    warnings = ["Fora do horário de pregão."];
  } else if (isPreMarket) {
    reasoning = "Pré-abertura. Aguarde o leilão de abertura para ter dados confiáveis.";
    warnings = ["Pré-mercado — sem liquidez confiável."];
  } else if (isOpening) {
    reasoning = "Primeiros 30 minutos do pregão. Volatilidade elevada — método operacional recomenda aguardar estabilização.";
    warnings = ["Volatilidade alta de abertura."];
  } else if (isLunch) {
    reasoning = "Horário de almoço. Liquidez reduzida — evite novas entradas até as 13h.";
    warnings = ["Liquidez reduzida no almoço."];
  } else if (isClosing) {
    reasoning = "Próximo do fechamento. Risco de reversão — opere com cautela ou encerre posições.";
    warnings = ["Próximo do fechamento."];
  } else {
    reasoning = "Dados de mercado indisponíveis no momento (Yahoo Finance offline?). Tente novamente em alguns segundos.";
    warnings = ["Dados de mercado indisponíveis."];
  }

  return {
    signalType: "avoid",
    confidence: 30,
    entryZoneLow: 0,
    entryZoneHigh: 0,
    stopLoss: 0,
    takeProfit: 0,
    riskLevel: "high",
    reasoning,
    strategyExplanation: reasoning,
    keyLevels: [],
    marketBias: "sideways",
    suggestedContracts: 0,
    validUntil: `${String(hour).padStart(2, "0")}:${String(now.getMinutes() + 30).padStart(2, "0")}`,
    warnings,
    indicators: {
      ema9: 0,
      ema21: 0,
      vwap: 0,
      rsi: 50,
      currentPrice: 0,
      high: 0,
      low: 0,
    },
  };
}
