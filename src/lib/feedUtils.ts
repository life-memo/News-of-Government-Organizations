/**
 * RSS/Atom フィード取得・パースのユーティリティ
 */

/* ─── URL正規化 ─── */

const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

/**
 * URL を正規化する。相対URL→絶対URL変換、HTMLエンティティのデコード、危険スキーム除外。
 * 不正な URL は null を返す。
 */
export function normalizeUrl(
  rawUrl: string | undefined | null,
  baseSiteUrl: string,
): string | null {
  if (!rawUrl) return null;
  let cleaned = rawUrl
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

  try {
    const resolved = new URL(cleaned, baseSiteUrl).toString();
    const lower = resolved.toLowerCase();
    for (const scheme of DANGEROUS_SCHEMES) {
      if (lower.startsWith(scheme)) return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

/* ─── 日時抽出 ─── */

/**
 * フィードエントリから published_at を抽出する。
 * 複数のフィールドを候補として順番にトライし、パースできたら返す。
 * パースできない場合は null（date_estimated=true 相当）。
 */
export function extractPublishedAt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entry: Record<string, any>,
): Date | null {
  const candidates: (string | undefined)[] = [
    entry.isoDate,
    entry.pubDate,
    entry.published,
    entry.updated,
    entry["dc:date"],
    entry.date,
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const d = new Date(raw.trim());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/* ─── HTML / フィード判定 ─── */

/**
 * レスポンスのContent-Typeと本文先頭から「フィード(XML)」か「HTML」か判定する。
 */
export function detectContentKind(
  contentType: string,
  bodyPrefix: string,
): "feed" | "html" | "unknown" {
  const ct = contentType.toLowerCase();
  if (
    ct.includes("xml") ||
    ct.includes("rss") ||
    ct.includes("atom") ||
    ct.includes("rdf")
  ) {
    return "feed";
  }
  if (ct.includes("html")) return "html";

  // Content-Type が曖昧な場合は本文先頭で判定
  const prefix = bodyPrefix.trimStart().toLowerCase();
  if (
    prefix.startsWith("<?xml") ||
    prefix.startsWith("<rss") ||
    prefix.startsWith("<feed") ||
    prefix.startsWith("<rdf")
  ) {
    return "feed";
  }
  if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html")) {
    return "html";
  }
  return "unknown";
}

/**
 * HTMLページからRSS/Atom フィードのURLを抽出する（RSS ディスカバリー）。
 * <link rel="alternate" type="application/rss+xml" href="..."> などを探す。
 * また <a href="...rdf"> <a href="...xml"> なども拾う。
 */
export function discoverFeedUrls(
  html: string,
  baseUrl: string,
): string[] {
  const urls = new Set<string>();

  // <link rel="alternate" ...> の type が RSS/Atom のもの
  const linkRe =
    /<link[^>]+rel\s*=\s*["']alternate["'][^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    if (
      /type\s*=\s*["'](application\/(rss|atom)\+xml|text\/xml|application\/xml)["']/i.test(
        tag,
      )
    ) {
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        const resolved = normalizeUrl(hrefMatch[1], baseUrl);
        if (resolved) urls.add(resolved);
      }
    }
  }

  // <a href="..."> で .rdf / .xml / .atom を含むリンク
  const anchorRe = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(anchorRe)) {
    const href = m[1];
    if (/\.(rdf|xml|atom)(\?|$)/i.test(href)) {
      const resolved = normalizeUrl(href, baseUrl);
      if (resolved) urls.add(resolved);
    }
  }

  return [...urls];
}

/* ─── HTML strip ─── */

export function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
