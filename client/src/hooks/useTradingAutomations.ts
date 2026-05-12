/**
 * useTradingAutomations
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook centralizado de automações inteligentes de Day Trade.
 * Detecta eventos técnicos e de horário e emite alertas sonoros + toasts ricos.
 *
 * Automações implementadas:
 * 1. Cruzamento EMA9 × EMA21 (sinal de tendência)
 * 2. RSI saindo de sobrecompra (>70) ou sobrevenda (<30)
 * 3. Sugestão de pausa após N perdas consecutivas
 * 4. Sugestão de encerrar operações após meta atingida
 * 5. Alertas de horário crítico (abertura 9h, almoço 12h-13h, fechamento 17h)
 */

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { audioEngine as sharedAudioEngine } from "@/lib/tradingAudio";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AutomationConfig {
  emaCrossEnabled: boolean;
  rsiAlertsEnabled: boolean;
  pauseSuggestionEnabled: boolean;
  pauseAfterLosses: number;          // padrão: 3
  goalAlertEnabled: boolean;
  dailyGoal: number;                 // R$
  criticalHoursEnabled: boolean;
}

export interface MarketIndicators {
  ema9: number[];
  ema21: number[];
  rsi: number;
  currentPrice: number;
}

export interface DailySummaryData {
  totalPnlBrl: number;
  lossesCount: number;
  winsCount: number;
  streak: number;
  streakType: "win" | "loss" | null;
}

const DEFAULT_CONFIG: AutomationConfig = {
  emaCrossEnabled: true,
  rsiAlertsEnabled: true,
  pauseSuggestionEnabled: true,
  pauseAfterLosses: 3,
  goalAlertEnabled: true,
  dailyGoal: 2000,
  criticalHoursEnabled: true,
};

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

/** Calcula RSI de 14 períodos a partir de um array de fechamentos */
export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

/** Retorna o último valor de uma EMA */
export function getLastEMA(values: number[]): number {
  return values[values.length - 1] ?? 0;
}

/** Detecta cruzamento de EMA9 × EMA21 */
export function detectEMACross(
  ema9: number[],
  ema21: number[]
): "bullish" | "bearish" | null {
  if (ema9.length < 2 || ema21.length < 2) return null;
  const ema9Prev = ema9[ema9.length - 2] ?? 0;
  const ema9Curr = ema9[ema9.length - 1] ?? 0;
  const ema21Prev = ema21[ema21.length - 2] ?? 0;
  const ema21Curr = ema21[ema21.length - 1] ?? 0;
  // Cruzamento para cima: EMA9 estava abaixo e agora está acima
  if (ema9Prev <= ema21Prev && ema9Curr > ema21Curr) return "bullish";
  // Cruzamento para baixo: EMA9 estava acima e agora está abaixo
  if (ema9Prev >= ema21Prev && ema9Curr < ema21Curr) return "bearish";
  return null;
}

/** Verifica se o horário atual é crítico para operações */
export function getCriticalHourWarning(now: Date): string | null {
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMin = h * 60 + m;

  if (totalMin >= 9 * 60 && totalMin <= 9 * 60 + 30) {
    return "⚠️ Abertura de mercado — alta volatilidade. Aguarde os primeiros 15 minutos antes de operar.";
  }
  if (totalMin >= 12 * 60 && totalMin <= 13 * 60) {
    return "🍽️ Horário de almoço — liquidez reduzida. Evite novas entradas entre 12h e 13h.";
  }
  if (totalMin >= 16 * 60 + 30 && totalMin <= 17 * 60 + 30) {
    return "🔔 Pré-fechamento — movimentos bruscos possíveis. Reduza exposição e monitore stops.";
  }
  if (totalMin >= 17 * 60 + 30) {
    return "🔴 Mercado fechando — encerre posições abertas antes das 17h55.";
  }
  return null;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useTradingAutomations(
  config: Partial<AutomationConfig> = {}
) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const audioEngine = useRef(sharedAudioEngine);

  // Refs para evitar alertas duplicados na mesma sessão
  const lastEmaCross = useRef<"bullish" | "bearish" | null>(null);
  const lastRsiZone = useRef<"overbought" | "oversold" | "neutral">("neutral");
  const pauseSuggested = useRef(false);
  const goalAlerted = useRef(false);
  const criticalHourAlerted = useRef<string | null>(null);

  // ── 1. Alertas de horário crítico ─────────────────────────────────────────
  useEffect(() => {
    if (!cfg.criticalHoursEnabled) return;

    const checkHour = () => {
      const warning = getCriticalHourWarning(new Date());
      if (warning && warning !== criticalHourAlerted.current) {
        criticalHourAlerted.current = warning;
        audioEngine.current.play("alert_generic");
        toast.warning(warning, {
          duration: 15000,
          style: {
            background: "oklch(0.15 0.02 60)",
            border: "1px solid oklch(0.5 0.15 60)",
            color: "oklch(0.9 0.1 60)",
          },
        });
      }
    };

    checkHour(); // verificar imediatamente
    const interval = setInterval(checkHour, 60_000); // a cada minuto
    return () => clearInterval(interval);
  }, [cfg.criticalHoursEnabled]);

  // ── 2. Verificar cruzamento EMA e RSI (chamado pelo gráfico) ──────────────
  const checkIndicators = useCallback(
    (indicators: MarketIndicators) => {
      const { ema9, ema21, rsi } = indicators;

      // EMA Cross
      if (cfg.emaCrossEnabled && ema9.length >= 2 && ema21.length >= 2) {
        const cross = detectEMACross(ema9, ema21);
        if (cross && cross !== lastEmaCross.current) {
          lastEmaCross.current = cross;
          const isBullish = cross === "bullish";
          audioEngine.current.play(isBullish ? "vwap_cross_up" : "vwap_cross_down");
          toast(
            isBullish
              ? "📈 EMA9 cruzou acima da EMA21"
              : "📉 EMA9 cruzou abaixo da EMA21",
            {
              description: isBullish
                ? `Sinal de tendência de ALTA confirmado. EMA9: ${getLastEMA(ema9).toFixed(0)} > EMA21: ${getLastEMA(ema21).toFixed(0)}`
                : `Sinal de tendência de BAIXA confirmado. EMA9: ${getLastEMA(ema9).toFixed(0)} < EMA21: ${getLastEMA(ema21).toFixed(0)}`,
              duration: 8000,
              style: {
                background: isBullish
                  ? "oklch(0.12 0.02 145)"
                  : "oklch(0.12 0.02 15)",
                border: `1px solid ${isBullish ? "oklch(0.45 0.18 145)" : "oklch(0.45 0.18 15)"}`,
                color: "oklch(0.9 0.05 240)",
              },
            }
          );
        }
      }

      // RSI
      if (cfg.rsiAlertsEnabled) {
        const currentZone: "overbought" | "oversold" | "neutral" =
          rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";

        if (currentZone !== "neutral" && currentZone !== lastRsiZone.current) {
          lastRsiZone.current = currentZone;
          const isOverbought = currentZone === "overbought";
          audioEngine.current.play(isOverbought ? "stop_loss" : "take_profit");
          toast(
            isOverbought
              ? `⚠️ RSI em Sobrecompra: ${rsi}`
              : `⚠️ RSI em Sobrevenda: ${rsi}`,
            {
              description: isOverbought
                ? "Mercado sobrecomprado — possível reversão de baixa. Evite novas compras."
                : "Mercado sobrevendido — possível reversão de alta. Evite novas vendas.",
              duration: 10000,
              style: {
                background: isOverbought
                  ? "oklch(0.13 0.02 60)"
                  : "oklch(0.12 0.02 240)",
                border: `1px solid oklch(0.5 0.15 60)`,
                color: "oklch(0.9 0.05 240)",
              },
            }
          );
        } else if (currentZone === "neutral" && lastRsiZone.current !== "neutral") {
          lastRsiZone.current = "neutral";
        }
      }
    },
    [cfg.emaCrossEnabled, cfg.rsiAlertsEnabled]
  );

  // ── 3. Verificar P&L diário (chamado pelo painel de resumo) ───────────────
  const checkDailySummary = useCallback(
    (summary: DailySummaryData) => {
      // Sugestão de pausa após N perdas consecutivas
      if (
        cfg.pauseSuggestionEnabled &&
        !pauseSuggested.current &&
        summary.streakType === "loss" &&
        summary.streak >= cfg.pauseAfterLosses
      ) {
        pauseSuggested.current = true;
        audioEngine.current.play("stop_loss");
        toast.error(
          `🛑 ${summary.streak} perdas consecutivas — Sugestão de Pausa`,
          {
            description: `Você registrou ${summary.streak} operações perdedoras seguidas. Recomendamos pausar por 30 minutos, revisar o contexto de mercado e retornar com foco renovado.`,
            duration: 20000,
          }
        );
      }

      // Resetar sugestão de pausa quando houver um ganho
      if (summary.streakType === "win") {
        pauseSuggested.current = false;
      }

      // Alerta de meta atingida
      if (
        cfg.goalAlertEnabled &&
        !goalAlerted.current &&
        summary.totalPnlBrl >= cfg.dailyGoal
      ) {
        goalAlerted.current = true;
        audioEngine.current.play("take_profit");
        toast.success(
          `🎯 Meta diária atingida! R$ ${summary.totalPnlBrl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          {
            description: `Parabéns! Você atingiu sua meta de R$ ${cfg.dailyGoal.toLocaleString("pt-BR")}. Considere encerrar as operações do dia para proteger o lucro.`,
            duration: 30000,
          }
        );
      }

      // Resetar alerta de meta no início do dia
      if (summary.totalPnlBrl < 0) {
        goalAlerted.current = false;
      }
    },
    [cfg.pauseSuggestionEnabled, cfg.pauseAfterLosses, cfg.goalAlertEnabled, cfg.dailyGoal]
  );

  // Resetar refs no início de cada dia
  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => {
      lastEmaCross.current = null;
      lastRsiZone.current = "neutral";
      pauseSuggested.current = false;
      goalAlerted.current = false;
      criticalHourAlerted.current = null;
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, []);

  return { checkIndicators, checkDailySummary };
}
