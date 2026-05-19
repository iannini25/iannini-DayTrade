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
 * Sequência de símbolos para o Mini Índice WIN. Yahoo não tem dados por
 * contrato individual (WINM26.SA costuma vir vazio), então tentamos do mais
 * específico ao mais genérico até obter timestamps válidos.
 */
export const WIN_SYMBOL_FALLBACKS = ["WIN=F", "^BVSP"];

function hasValidData(r: YFChartResult): boolean {
  const result = r?.chart?.result?.[0];
  return !!result && Array.isArray(result.timestamp) && result.timestamp.length > 0;
}

async function fetchChart(
  symbol: string,
  interval: string,
  range: string,
  region: string
): Promise<YFChartResult> {
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
 * Busca dados de gráfico para um símbolo. Se for um símbolo WIN
 * (WIN=F, WINM26, etc.), tenta a cadeia de fallback automaticamente.
 * O símbolo efetivamente usado fica em `result.chart.result[0].meta.symbol`.
 */
export async function getStockChart(params: {
  symbol: string;
  interval?: string;
  range?: string;
  region?: string;
  includeAdjustedClose?: boolean;
}): Promise<YFChartResult & { resolvedSymbol?: string }> {
  const { symbol, interval = "5m", range = "1d", region = "BR" } = params;

  const isWin = /^WIN/i.test(symbol) || symbol === "WIN=F";
  const candidates = isWin
    ? Array.from(new Set([symbol, ...WIN_SYMBOL_FALLBACKS]))
    : [symbol];

  let lastErr: unknown = null;
  for (const sym of candidates) {
    try {
      const data = await fetchChart(sym, interval, range, region);
      if (hasValidData(data)) {
        return { ...data, resolvedSymbol: sym };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  // Nenhum candidato retornou dados válidos
  if (candidates.length === 1 && lastErr) throw lastErr;
  throw new Error(
    `Yahoo Finance: nenhum símbolo retornou dados (tentados: ${candidates.join(", ")})`
  );
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
  if (!currentPrice || currentPrice === 0) {
    console.warn(`[yahooFinance] extractQuoteMeta: price=0 para ${meta?.symbol ?? "?"} (sem regularMarketPrice nem closes)`);
  }
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
