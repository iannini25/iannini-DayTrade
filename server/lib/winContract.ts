/**
 * winContract.ts — Resolução dinâmica do contrato WIN ativo da B3.
 *
 * Mini Índice (WIN) tem vencimento bimestral: nos meses pares (FEV, ABR, JUN, AGO, OUT, DEZ),
 * na quarta-feira mais próxima do dia 15. Códigos:
 *   Fevereiro = G, Abril = J, Junho = M, Agosto = Q, Outubro = V, Dezembro = Z
 * Formato: WIN + letra + 2 dígitos do ano (ex.: WINM26 = junho/2026).
 *
 * NOTA importante: Yahoo Finance NÃO fornece dados por contrato individual da B3 —
 * usamos `WIN=F` (continuous) para preço. Este módulo serve apenas para EXIBIÇÃO
 * do código correto e cálculo de dias até o vencimento. Para dados por contrato
 * real seria preciso migrar para B3 direto ou um provedor pago (futuro).
 */

const MONTH_CODES: Record<number, string> = {
  2: "G", // fevereiro
  4: "J", // abril
  6: "M", // junho
  8: "Q", // agosto
  10: "V", // outubro
  12: "Z", // dezembro
};

const EXPIRY_MONTHS = [2, 4, 6, 8, 10, 12];

/**
 * Quarta-feira mais próxima do dia 15 de um dado mês/ano.
 * "Mais próxima" = se 15 cai num dia, encontra a quarta-feira na mesma semana
 * (preferindo a quarta-feira anterior se 15 for quinta/sexta/sáb/dom,
 *  e a quarta-feira posterior se 15 for dom/seg/ter — usamos a regra B3
 *  oficial: quarta-feira que cai entre os dias 12 e 18).
 */
export function getExpiryDate(year: number, month: number): Date {
  // Busca a quarta-feira (day=3, dom=0) entre 12 e 18
  for (let d = 12; d <= 18; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    if (date.getUTCDay() === 3) {
      return date;
    }
  }
  // Fallback: dia 15 (não deveria acontecer)
  return new Date(Date.UTC(year, month - 1, 15));
}

export type WinContract = {
  /** Código completo: ex. "WINM26" */
  symbol: string;
  /** Símbolo Yahoo Finance para buscar dados (sempre "WIN=F" enquanto não migramos) */
  yahooSymbol: string;
  /** Data de vencimento UTC */
  expiry: Date;
  /** Mês de vencimento (2,4,6,8,10,12) */
  expiryMonth: number;
  /** Ano de vencimento */
  expiryYear: number;
  /** Letra do mês no padrão B3 */
  monthCode: string;
  /** Dias corridos até o vencimento (negativo se já passou) */
  daysToExpiry: number;
  /** Se está em "rollover zone" (5 dias úteis ou menos até o vencimento) */
  nearExpiry: boolean;
};

/**
 * Resolve o contrato WIN ativo para uma data específica.
 * Avança automaticamente para o próximo se a data atual passou do vencimento.
 */
export function resolveActiveWinContract(now: Date = new Date()): WinContract {
  const year = now.getUTCFullYear();

  // Encontra o primeiro mês de vencimento >= mês atual cuja data de vencimento
  // ainda não passou
  const candidates: Array<{ month: number; year: number; expiry: Date }> = [];
  for (let yearOffset = 0; yearOffset <= 1; yearOffset++) {
    const y = year + yearOffset;
    for (const m of EXPIRY_MONTHS) {
      const expiry = getExpiryDate(y, m);
      // Adiciona 23:59:59 ao vencimento — contrato é válido até o fim do dia
      const expiryEnd = new Date(expiry.getTime() + 24 * 60 * 60 * 1000 - 1);
      if (expiryEnd >= now) {
        candidates.push({ month: m, year: y, expiry });
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error("Não foi possível resolver o contrato WIN ativo");
  }
  const active = candidates[0]!;
  const letter = MONTH_CODES[active.month]!;
  const yy = String(active.year).slice(-2);
  const daysToExpiry = Math.floor(
    (active.expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  return {
    symbol: `WIN${letter}${yy}`,
    yahooSymbol: "WIN=F",
    expiry: active.expiry,
    expiryMonth: active.month,
    expiryYear: active.year,
    monthCode: letter,
    daysToExpiry,
    nearExpiry: daysToExpiry <= 5,
  };
}

/**
 * Helper conveniente para retornar só o código do contrato ativo.
 */
export function getActiveWinSymbol(now: Date = new Date()): string {
  return resolveActiveWinContract(now).symbol;
}
