// Cheerio-based DOM helpers for extracting page signals.

import * as cheerio from "cheerio";

export interface HeadData {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogUrl: string | null;
  ogType: string | null;
  twitterCard: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  noindex: boolean;
  noindexHeader: boolean;
  hreflangTags: Array<{ lang: string; href: string }>;
  charset: string | null;
  viewport: string | null;
}

export interface PageStructure {
  h1s: string[];
  h2s: string[];
  h3s: string[];
  h4s: string[];
  paragraphs: string[];
  orderedLists: number; // count of <ol>
  tables: number; // count of <table>
  images: number; // count of <img>
  videos: number; // count of <video> + YouTube iframes
  externalLinks: string[];
  internalLinks: string[];
  wordCount: number;
  bodyText: string;
}

/** Parse HTML and extract HEAD metadata. */
export function parseHead(
  html: string,
  xRobotsTag?: string | string[]
): HeadData {
  const $ = cheerio.load(html);
  const head = $("head");

  const title = head.find("title").first().text().trim() || null;
  const metaDescription =
    head
      .find('meta[name="description"]')
      .attr("content")
      ?.trim() ?? null;
  const canonical = head.find('link[rel="canonical"]').attr("href")?.trim() ?? null;
  const ogTitle =
    head.find('meta[property="og:title"]').attr("content")?.trim() ?? null;
  const ogDescription =
    head.find('meta[property="og:description"]').attr("content")?.trim() ?? null;
  const ogImage =
    head.find('meta[property="og:image"]').attr("content")?.trim() ?? null;
  const ogUrl =
    head.find('meta[property="og:url"]').attr("content")?.trim() ?? null;
  const ogType =
    head.find('meta[property="og:type"]').attr("content")?.trim() ?? null;
  const twitterCard =
    head.find('meta[name="twitter:card"]').attr("content")?.trim() ?? null;
  const twitterTitle =
    head.find('meta[name="twitter:title"]').attr("content")?.trim() ?? null;
  const twitterDescription =
    head.find('meta[name="twitter:description"]').attr("content")?.trim() ?? null;

  // Check noindex from meta tags
  const robotsMeta = head
    .find('meta[name="robots"]')
    .attr("content")
    ?.toLowerCase() ?? "";
  let noindex = robotsMeta.includes("noindex");

  // Check X-Robots-Tag header
  let noindexHeader = false;
  if (xRobotsTag) {
    const tags = Array.isArray(xRobotsTag) ? xRobotsTag : [xRobotsTag];
    noindexHeader = tags.some((t) => t.toLowerCase().includes("noindex"));
    if (noindexHeader) noindex = true;
  }

  const hreflangTags: Array<{ lang: string; href: string }> = [];
  head.find('link[rel="alternate"][hreflang]').each((_, el) => {
    const lang = $(el).attr("hreflang") ?? "";
    const href = $(el).attr("href") ?? "";
    if (lang && href) hreflangTags.push({ lang, href });
  });

  const charset =
    head.find('meta[charset]').attr("charset")?.trim() ??
    head.find('meta[http-equiv="Content-Type"]').attr("content")?.match(/charset=([^;]+)/i)?.[1]?.trim() ??
    null;

  const viewport =
    head.find('meta[name="viewport"]').attr("content")?.trim() ?? null;

  return {
    title,
    metaDescription,
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType,
    twitterCard,
    twitterTitle,
    twitterDescription,
    noindex,
    noindexHeader,
    hreflangTags,
    charset,
    viewport,
  };
}

/** Extract page structure: headings, paragraphs, links, word count, body text. */
export function parseBody(html: string, baseUrl: string): PageStructure {
  const $ = cheerio.load(html);
  const body = $("body");

  const h1s: string[] = [];
  const h2s: string[] = [];
  const h3s: string[] = [];
  const h4s: string[] = [];
  body.find("h1").each((_, el) => { h1s.push($(el).text().trim()); });
  body.find("h2").each((_, el) => { h2s.push($(el).text().trim()); });
  body.find("h3").each((_, el) => { h3s.push($(el).text().trim()); });
  body.find("h4").each((_, el) => { h4s.push($(el).text().trim()); });

  const paragraphs: string[] = [];
  body.find("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  const orderedLists = body.find("ol").length;
  const tables = body.find("table").length;
  const images = body.find("img").length;

  let videos = body.find("video").length;
  body.find("iframe").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    if (src.includes("youtube") || src.includes("youtu.be") || src.includes("vimeo")) {
      videos++;
    }
  });

  let baseParsed: URL | null = null;
  try { baseParsed = new URL(baseUrl); } catch { /* ignore */ }

  const externalLinks: string[] = [];
  const internalLinks: string[] = [];
  body.find("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    if (href.startsWith("http")) {
      try {
        const linkUrl = new URL(href);
        if (baseParsed && linkUrl.hostname !== baseParsed.hostname) {
          externalLinks.push(href);
        } else {
          internalLinks.push(href);
        }
      } catch { /* ignore invalid */ }
    } else {
      internalLinks.push(href);
    }
  });

  // Strip scripts/styles/nav from body text
  body.find("script, style, nav, header, footer, .nav, .menu").remove();
  const bodyText = body.text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    h1s,
    h2s,
    h3s,
    h4s,
    paragraphs,
    orderedLists,
    tables,
    images,
    videos,
    externalLinks,
    internalLinks,
    wordCount,
    bodyText,
  };
}

/** Extract all JSON-LD script blocks from HTML as raw strings. */
export function extractJsonLdBlocks(html: string): string[] {
  const $ = cheerio.load(html);
  const blocks: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) blocks.push(content.trim());
  });
  return blocks;
}

/** Simple Levenshtein distance between two strings. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
