import { describe, it, expect } from "vitest";
import { parseRss, formatNewsForPrompt } from "./services/newsRss";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Google News</title>
  <item>
    <title><![CDATA[Ibovespa fecha em alta após decisão do Fed]]></title>
    <link>https://news.google.com/articles/abc</link>
    <pubDate>Wed, 14 May 2026 12:00:00 GMT</pubDate>
    <source url="https://valor.globo.com">Valor Econômico</source>
  </item>
  <item>
    <title>Mini Índice (WIN) atinge 130.000 pontos</title>
    <link>https://news.google.com/articles/def</link>
    <pubDate>Wed, 14 May 2026 09:30:00 GMT</pubDate>
    <source url="https://infomoney.com.br">InfoMoney</source>
  </item>
  <item>
    <title>B3 lança novo produto de hedge</title>
    <link>https://news.google.com/articles/ghi</link>
    <pubDate>Tue, 13 May 2026 18:00:00 GMT</pubDate>
    <source>Estadão</source>
  </item>
</channel>
</rss>`;

describe("newsRss.parseRss", () => {
  it("extrai títulos, links e fontes de RSS válido", () => {
    const items = parseRss(SAMPLE_RSS);
    expect(items).toHaveLength(3);
    expect(items[0]?.title).toBe("Ibovespa fecha em alta após decisão do Fed");
    expect(items[0]?.link).toBe("https://news.google.com/articles/abc");
    expect(items[0]?.source).toBe("Valor Econômico");
    expect(items[1]?.title).toContain("Mini Índice");
    expect(items[2]?.source).toBe("Estadão");
  });

  it("respeita parâmetro max", () => {
    const items = parseRss(SAMPLE_RSS, 2);
    expect(items).toHaveLength(2);
  });

  it("retorna array vazio para XML vazio", () => {
    expect(parseRss("")).toHaveLength(0);
    expect(parseRss("<rss></rss>")).toHaveLength(0);
  });

  it("decodifica entidades HTML", () => {
    const xml = `<rss><channel><item><title>Petr&amp;Co &quot;ganha&quot;</title></item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0]?.title).toBe('Petr&Co "ganha"');
  });
});

describe("newsRss.formatNewsForPrompt", () => {
  it("retorna mensagem amigável quando vazio", () => {
    expect(formatNewsForPrompt([])).toContain("nenhuma notícia");
  });

  it("formata até 8 notícias", () => {
    const items = parseRss(SAMPLE_RSS);
    const recent = items.map((i) => ({ ...i, pubDate: new Date().toUTCString() }));
    const out = formatNewsForPrompt(recent);
    expect(out).toContain("Ibovespa");
    expect(out).toContain("Mini Índice");
    expect(out).toContain("(Valor Econômico)");
  });

  it("filtra notícias com mais de 24h", () => {
    const old = [{ title: "Antiga", link: "", pubDate: "Mon, 01 Jan 2020 00:00:00 GMT", source: "X" }];
    expect(formatNewsForPrompt(old)).toContain("nenhuma das últimas 24h");
  });
});
