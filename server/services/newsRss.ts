/**
 * newsRss.ts — Busca notícias do mercado brasileiro via Google News RSS.
 * Sem dependência externa: parser regex simples (RSS é XML, mas a estrutura é estável).
 */

const NEWS_URL =
  "https://news.google.com/rss/search?q=Ibovespa+OR+%22Mini+%C3%8Dndice%22+OR+B3+OR+%22mercado+financeiro%22&hl=pt-BR&gl=BR&ceid=BR:pt-419";

const TIMEOUT_MS = 8000;

export type NewsItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

/**
 * Decodifica entidades HTML básicas (RSS vem com &amp;, &quot;, etc).
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Parser RSS leve. Não usa biblioteca externa para evitar bundle bloat.
 */
export function parseRss(xml: string, max = 10): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < max) {
    const block = m[1] ?? "";
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() ?? "";
    const sourceRaw =
      block.match(/<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/)?.[1]?.trim() ?? "";
    if (!title) continue;
    items.push({
      title: decodeEntities(title),
      link,
      pubDate,
      source: decodeEntities(sourceRaw),
    });
  }
  return items;
}

let cached: { fetchedAt: number; items: NewsItem[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function fetchMarketNews(): Promise<NewsItem[]> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.items;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(NEWS_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IanniniDayTrade/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!res.ok) {
      console.warn(`[newsRss] HTTP ${res.status} from Google News`);
      return cached?.items ?? [];
    }
    const xml = await res.text();
    const items = parseRss(xml, 10);
    cached = { fetchedAt: Date.now(), items };
    return items;
  } catch (err) {
    console.warn("[newsRss] Failed to fetch:", err);
    return cached?.items ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Filtra notícias das últimas 24h e formata para incluir no prompt do LLM.
 */
export function formatNewsForPrompt(items: NewsItem[]): string {
  if (items.length === 0) return "NOTÍCIAS: nenhuma notícia disponível.";
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = items.filter((it) => {
    if (!it.pubDate) return true;
    const t = new Date(it.pubDate).getTime();
    return Number.isFinite(t) ? t >= cutoff : true;
  });
  const slice = recent.slice(0, 8);
  if (slice.length === 0) return "NOTÍCIAS: nenhuma das últimas 24h.";
  return `NOTÍCIAS DAS ÚLTIMAS 24H:\n${slice.map((n, i) => `  ${i + 1}. ${n.title}${n.source ? ` (${n.source})` : ""}`).join("\n")}`;
}
