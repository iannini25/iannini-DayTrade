/**
 * b3Api.ts — Integração com a API pública de cotações da B3.
 *
 * Endpoints (não-documentados oficialmente, usados pelo site cotacao.b3.com.br):
 *   - DerivativeQuotation/WIN          → lista de contratos WIN e vencimentos
 *   - InstrumentQuotation/{symbol}     → cotação detalhada de um contrato
 *
 * IMPORTANTE: a B3 pode bloquear requisições server-side (geo/rate-limit/headers).
 * TODAS as funções aqui são defensivas: retornam null em qualquer falha, nunca
 * lançam. O chamador deve ter fallback (Yahoo) — nunca quebrar o que funciona.
 */

import { resolveActiveWinContract } from "./lib/winContract";

const B3_BASE = "https://cotacao.b3.com.br/mds/api/v1";
const TIMEOUT_MS = 7000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://www.b3.com.br/",
  Origin: "https://www.b3.com.br",
};

async function b3Fetch(path: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${B3_BASE}/${path}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[b3Api] HTTP ${res.status} em ${path}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[b3Api] falha em ${path}:`, (err as Error)?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type B3Contract = {
  symbol: string;
  description?: string;
  maturity?: string;
};

/**
 * Lista contratos WIN disponíveis na B3. Retorna [] em falha.
 */
export async function getB3WinContracts(): Promise<B3Contract[]> {
  const data = await b3Fetch("DerivativeQuotation/WIN");
  if (!data) return [];
  try {
    // Estrutura típica: { Scty: { ... }, ... } ou lista de instrumentos.
    // O site da B3 retorna em "Scty" / "InstrmtInf". Tentamos múltiplos formatos.
    const list: any[] =
      data?.Scty ??
      data?.instruments ??
      data?.InstrmtInf ??
      (Array.isArray(data) ? data : []);
    return list
      .map((it: any) => ({
        symbol: it?.symb ?? it?.cd ?? it?.symbol ?? "",
        description: it?.desc ?? it?.AsstSummry?.desc,
        maturity: it?.mtrtyCode ?? it?.matrtyCode ?? it?.maturity,
      }))
      .filter((c) => c.symbol);
  } catch {
    return [];
  }
}

export type B3Quote = {
  symbol: string;
  price: number;
  open: number;
  min: number;
  max: number;
  prevClose: number;
  changePercent: number;
  volume: number;
  vwap: number;
  bid?: number;
  ask?: number;
  marketTime?: string; // ISO
  raw?: unknown; // payload bruto para inspeção/debug
};

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cotação detalhada de um contrato WIN. Retorna null em qualquer falha.
 */
export async function getB3WinQuote(symbol: string): Promise<B3Quote | null> {
  const data = await b3Fetch(`InstrumentQuotation/${encodeURIComponent(symbol)}`);
  if (!data) return null;
  try {
    // Formato do site B3: { SctyQtn: {...}, BizSts: {...}, SctyId/Asset: {...} }
    const q = data?.SctyQtn ?? data?.Trad?.[0]?.scty?.SctyQtn ?? data;
    const price = num(q?.curPrc ?? q?.lastPric ?? q?.prc);
    if (price <= 0) return null;

    const open = num(q?.opngPric ?? q?.openPric);
    const min = num(q?.minPric ?? q?.lowPric);
    const max = num(q?.maxPric ?? q?.highPric);
    const prevClose = num(q?.prvsDayAdjstmntPric ?? q?.prevClsPric ?? q?.refPric);
    const changePercent =
      q?.oscnPctg !== undefined
        ? num(q.oscnPctg)
        : prevClose > 0
          ? ((price - prevClose) / prevClose) * 100
          : 0;
    const volume = num(q?.tradQty ?? q?.qtyTraded ?? q?.vol);
    const vwap = num(q?.avrgPric ?? q?.vwap) || price;

    return {
      symbol,
      price,
      open,
      min,
      max,
      prevClose,
      changePercent: Math.round(changePercent * 100) / 100,
      volume,
      vwap,
      bid: num(data?.BstBid?.prc) || undefined,
      ask: num(data?.BstAsk?.prc) || undefined,
      marketTime: new Date().toISOString(),
      raw: data,
    };
  } catch {
    return null;
  }
}

/**
 * Contrato WIN ativo + tentativa de cotação B3.
 * Sempre retorna o símbolo (resolvido localmente, confiável); a cotação
 * pode vir null se a B3 estiver inacessível.
 */
export async function getActiveWinContract(): Promise<{
  symbol: string;
  expiry: string;
  daysToExpiry: number;
  nearExpiry: boolean;
  quote: B3Quote | null;
}> {
  const c = resolveActiveWinContract();
  const quote = await getB3WinQuote(c.symbol).catch(() => null);
  return {
    symbol: c.symbol,
    expiry: c.expiry.toISOString(),
    daysToExpiry: c.daysToExpiry,
    nearExpiry: c.nearExpiry,
    quote,
  };
}
