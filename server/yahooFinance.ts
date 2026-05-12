/**
 * yahooFinance.ts — Helper independente para Yahoo Finance API
 * Substitui callDataApi("YahooFinance/...") sem dependência Manus.
 * Usa a API pública do Yahoo Finance v8 via fetch.
 */

const YF_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const YF_BASE_V7 = "https://query1.finance.yahoo.com/v7/finance/quote";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; IanniniDayTrade/1.0)",
  "Accept": "application/json",
};

export type YFChartResult = {
  chart: {
    result: Array<{
      meta: {
        symbol: string;
        longName?: string;
        exchangeName?: string;
        currency?: string;
        regularMarketPrice: number;
        regularMarketDayHigh: number;
        regularMarketDayLow: number;
        regularMarketVolume: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
          close: (number | null)[];
          volume: (number | null)[];
        }>;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
};

/**
 * Busca dados de gráfico para um símbolo
 */
export async function getStockChart(params: {
  symbol: string;
  interval?: string;
  range?: string;
  region?: string;
  includeAdjustedClose?: boolean;
}): Promise<YFChartResult> {
  const { symbol, interval = "5m", range = "1d", region = "BR" } = params;
  const url = new URL(`${YF_BASE}/${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", interval);
  url.searchParams.set("range", range);
  url.searchParams.set("region", region);
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,split");

  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`Yahoo Finance error ${res.status} for ${symbol}`);
  return res.json() as Promise<YFChartResult>;
}

/**
 * Extrai métricas resumidas de um resultado de chart
 */
export function extractQuoteMeta(result: YFChartResult) {
  const r = result?.chart?.result?.[0];
  if (!r) return null;
  const meta = r.meta;
  const quotes = r.indicators?.quote?.[0];
  const closes = (quotes?.close ?? []).filter((v): v is number => v !== null);
  const prevClose = closes[closes.length - 2] ?? meta?.previousClose ?? meta?.chartPreviousClose;
  const currentPrice = meta?.regularMarketPrice ?? closes[closes.length - 1];
  const change = prevClose && currentPrice ? currentPrice - prevClose : 0;
  const changePct = prevClose && prevClose !== 0 ? (change / prevClose) * 100 : 0;
  return {
    symbol: meta.symbol,
    name: meta.longName ?? meta.symbol,
    price: currentPrice ?? 0,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    high: meta.regularMarketDayHigh ?? 0,
    low: meta.regularMarketDayLow ?? 0,
    volume: meta.regularMarketVolume ?? 0,
    prevClose: prevClose ?? 0,
  };
}
