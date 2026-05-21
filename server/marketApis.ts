/**
 * marketApis.ts — Fontes alternativas de cotação (anti rate-limit do Yahoo).
 *
 * - AwesomeAPI:       USD/BRL em tempo real, sem chave.
 * - API B3 SMAL11:    proxy oficial para SMLL (iShares Small Cap ETF).
 *
 * Todas as funções são defensivas: retornam null em qualquer falha,
 * nunca lançam — o chamador segue com Yahoo como fallback.
 */

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IanniniDayTrade/1.0",
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const TIMEOUT_MS = 5000;

export type UsdBrlQuote = {
  price: number;
  change: number;
  changePct: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  prevClose: number;
  marketTime: number; // unix seconds
  source: "awesomeapi";
};

/**
 * USD/BRL via AwesomeAPI. ~200ms de latência, sem chave.
 * https://economia.awesomeapi.com.br/last/USD-BRL
 */
export async function getUsdBrlAwesome(): Promise<UsdBrlQuote | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/last/USD-BRL", {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[marketApis] AwesomeAPI USD/BRL HTTP ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    const usd = data?.USDBRL;
    if (!usd) return null;

    const bid = parseFloat(usd.bid);
    const ask = parseFloat(usd.ask);
    const high = parseFloat(usd.high);
    const low = parseFloat(usd.low);
    const pctChange = parseFloat(usd.pctChange);
    const varBid = parseFloat(usd.varBid);
    if (!Number.isFinite(bid) || bid <= 0) return null;

    const prevClose = bid - (Number.isFinite(varBid) ? varBid : 0);
    const ts = usd.timestamp ? Number(usd.timestamp) : Math.floor(Date.now() / 1000);

    return {
      price: bid,
      change: Number.isFinite(varBid) ? Math.round(varBid * 10000) / 10000 : 0,
      changePct: Number.isFinite(pctChange) ? Math.round(pctChange * 100) / 100 : 0,
      bid,
      ask: Number.isFinite(ask) ? ask : bid,
      high: Number.isFinite(high) ? high : bid,
      low: Number.isFinite(low) ? low : bid,
      prevClose: Math.round(prevClose * 10000) / 10000,
      marketTime: ts,
      source: "awesomeapi",
    };
  } catch (err) {
    console.warn("[marketApis] AwesomeAPI falhou:", (err as Error)?.message ?? err);
    return null;
  }
}

export type SmallCapQuote = {
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  prevClose: number;
  marketTime: number; // unix seconds
  source: "b3-smal11";
};

/**
 * SMLL via API B3 — usa SMAL11 (ETF iShares) como proxy.
 * https://cotacao.b3.com.br/mds/api/v1/InstrumentQuotation/SMAL11
 */
export async function getSmallCapB3(): Promise<SmallCapQuote | null> {
  try {
    const res = await fetch(
      "https://cotacao.b3.com.br/mds/api/v1/InstrumentQuotation/SMAL11",
      {
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
    if (!res.ok) {
      console.warn(`[marketApis] B3 SMAL11 HTTP ${res.status}`);
      return null;
    }
    const data: any = await res.json();
    // Aceitar formato Trad[0] (típico) e também SctyQtn direto na raiz
    const trad =
      data?.Trad?.[0]?.scty?.SctyQtn ??
      data?.SctyQtn ??
      null;
    if (!trad) return null;

    const price = Number(trad.curPrc);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prcFlcn = Number(trad.prcFlcn ?? 0);
    const changePctRaw = Number.isFinite(prcFlcn) ? prcFlcn * 100 : 0;
    const prevClose =
      Number.isFinite(prcFlcn) && prcFlcn !== -1
        ? price / (1 + prcFlcn)
        : price;
    const change = price - prevClose;

    return {
      price,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePctRaw * 100) / 100,
      high: Number(trad.maxPric) || price,
      low: Number(trad.minPric) || price,
      prevClose: Math.round(prevClose * 100) / 100,
      marketTime: Math.floor(Date.now() / 1000),
      source: "b3-smal11",
    };
  } catch (err) {
    console.warn("[marketApis] B3 SMAL11 falhou:", (err as Error)?.message ?? err);
    return null;
  }
}
