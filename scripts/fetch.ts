/**
 * RSS取得スクリプト
 * 各省庁のRSSフィードを取得し、DBに保存する
 *
 * 実行: npx tsx scripts/fetch.ts
 * cronで定期実行推奨: 15分〜1時間ごと
 */

import "dotenv/config";
import RssParser from "rss-parser";
import { createHash } from "crypto";
import { getScriptPrisma } from "./db.js";
import ministriesData from "../src/config/ministries.json";

interface SourceConfig {
  name: string;
  url: string;
  type: string;
}

interface MinistryConfig {
  key: string;
  ministry: string;
  short: string;
  color: string;
  siteUrl: string;
  sources: SourceConfig[];
}

const MINISTRIES: MinistryConfig[] = ministriesData as MinistryConfig[];
const FETCH_TIMEOUT_MS = 15000;
const FETCH_DELAY_MS = 1000;
const USER_AGENT =
  "GovNewsDashboard/1.0 (+https://github.com/gov-news-dashboard)";

const rssParser = new RssParser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
  },
  requestOptions: {
    // @ts-expect-error rss-parser accepts this
    timeout: FETCH_TIMEOUT_MS,
  },
});

/* ─── ユーティリティ ─── */

const DANGEROUS_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

function normalizeUrl(rawUrl: string | undefined | null, baseSiteUrl: string): string | null {
  if (!rawUrl) return null;
  const cleaned = rawUrl.trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  try {
    const resolved = new URL(cleaned, baseSiteUrl).toString();
    for (const scheme of DANGEROUS_SCHEMES) {
      if (resolved.toLowerCase().startsWith(scheme)) return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPublishedAt(entry: Record<string, any>): Date | null {
  const candidates = [entry.isoDate, entry.pubDate, entry.published, entry.updated, entry["dc:date"], entry.date];
  for (const raw of candidates) {
    if (!raw || typeof raw !== "string") continue;
    const d = new Date(raw.trim());
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function detectContentKind(contentType: string, bodyPrefix: string): "feed" | "html" | "unknown" {
  const ct = contentType.toLowerCase();
  if (ct.includes("xml") || ct.includes("rss") || ct.includes("atom") || ct.includes("rdf")) return "feed";
  if (ct.includes("html")) return "html";
  const prefix = bodyPrefix.trimStart().toLowerCase();
  if (prefix.startsWith("<?xml") || prefix.startsWith("<rss") || prefix.startsWith("<feed") || prefix.startsWith("<rdf")) return "feed";
  if (prefix.startsWith("<!doctype html") || prefix.startsWith("<html")) return "html";
  return "unknown";
}

function discoverFeedUrls(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const linkRe = /<link[^>]+rel\s*=\s*["']alternate["'][^>]*>/gi;
  for (const m of html.matchAll(linkRe)) {
    const tag = m[0];
    if (/type\s*=\s*["'](application\/(rss|atom)\+xml|text\/xml|application\/xml)["']/i.test(tag)) {
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        const resolved = normalizeUrl(hrefMatch[1], baseUrl);
        if (resolved) urls.add(resolved);
      }
    }
  }
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

function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

function generateHash(title: string, url: string, publishedAt: string): string {
  return createHash("sha256").update(`${title}||${url}||${publishedAt}`).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── フィード処理 ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;

async function processFeed(feedUrl: string, ministry: MinistryConfig, sourceName: string) {
  let newItems = 0;
  let updatedItems = 0;

  const feed = await rssParser.parseURL(feedUrl);
  for (const item of feed.items || []) {
    try {
      const title = item.title?.trim() || "(タイトルなし)";
      const rawUrl = item.link?.trim() || "";
      const url = normalizeUrl(rawUrl, ministry.siteUrl);
      if (!url) continue;

      const publishedAt = extractPublishedAt(item);
      const dateEstimated = !publishedAt;
      const effectiveDate = publishedAt || new Date();

      const summaryRaw = stripHtml(item.contentSnippet || item.content || item.summary);
      const contentText = stripHtml(item["content:encoded"] || item.content);
      const hash = generateHash(title, url, effectiveDate.toISOString());

      const existing = await prisma.item.findUnique({ where: { hash } });
      if (existing) {
        const sameUrlItem = await prisma.item.findFirst({ where: { url, ministry: ministry.ministry } });
        if (sameUrlItem && (sameUrlItem.title !== title || sameUrlItem.summaryRaw !== summaryRaw)) {
          await prisma.item.update({ where: { id: sameUrlItem.id }, data: { title, summaryRaw, contentText, updatedFlag: true } });
          updatedItems++;
        }
        continue;
      }

      await prisma.item.create({
        data: {
          ministry: ministry.ministry, sourceName, title, url,
          publishedAt: effectiveDate, summaryRaw: summaryRaw || null,
          contentText: contentText || null, hash, dateEstimated,
        },
      });
      newItems++;
    } catch (itemError: unknown) {
      const msg = itemError instanceof Error ? itemError.message : String(itemError);
      console.error(`  アイテムエラー: ${msg}`);
    }
  }

  return { newItems, updatedItems };
}

async function fetchSource(ministry: MinistryConfig, source: SourceConfig) {
  const errors: string[] = [];
  let totalNew = 0;
  let totalUpdated = 0;
  const startTime = Date.now();

  try {
    console.log(`  取得中: ${ministry.ministry} - ${source.name} (${source.url})`);

    if (source.type === "rss-discovery") {
      const res = await globalThis.fetch(source.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await res.text();
      const kind = detectContentKind(res.headers.get("content-type") || "", body.slice(0, 200));

      let feedUrls: string[] = [];
      if (kind === "html") {
        feedUrls = discoverFeedUrls(body, source.url);
        console.log(`  -> HTML検出、${feedUrls.length}件のフィードURL発見`);
      } else if (kind === "feed") {
        feedUrls = [source.url];
      }

      for (const feedUrl of feedUrls) {
        try {
          const result = await processFeed(feedUrl, ministry, source.name);
          totalNew += result.newItems;
          totalUpdated += result.updatedItems;
        } catch (e: unknown) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
        await sleep(500);
      }
    } else {
      const res = await globalThis.fetch(source.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await res.text();
      const kind = detectContentKind(res.headers.get("content-type") || "", body.slice(0, 200));

      if (kind === "html") {
        const feedUrls = discoverFeedUrls(body, source.url);
        console.log(`  -> HTML返却、${feedUrls.length}件のフィードURL発見`);
        for (const feedUrl of feedUrls) {
          try {
            const result = await processFeed(feedUrl, ministry, source.name);
            totalNew += result.newItems;
            totalUpdated += result.updatedItems;
          } catch { /* skip */ }
          await sleep(500);
        }
      } else {
        const result = await processFeed(source.url, ministry, source.name);
        totalNew += result.newItems;
        totalUpdated += result.updatedItems;
      }
    }

    console.log(`  -> 新規: ${totalNew}, 更新: ${totalUpdated}`);
    const duration = Date.now() - startTime;
    await prisma.fetchLog.create({
      data: { ministry: ministry.ministry, sourceName: source.name, sourceUrl: source.url, status: "success", itemCount: totalNew + totalUpdated, duration },
    });
    await prisma.source.upsert({
      where: { ministry_name: { ministry: ministry.ministry, name: source.name } },
      update: { lastFetchedAt: new Date(), lastError: null, url: source.url },
      create: { ministry: ministry.ministry, name: source.name, url: source.url, type: source.type, lastFetchedAt: new Date() },
    });
  } catch (fetchError: unknown) {
    const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
    errors.push(`フィード取得エラー: ${msg}`);
    console.error(`  ✗ エラー: ${ministry.ministry} - ${source.name}: ${msg}`);
    const duration = Date.now() - startTime;
    await prisma.fetchLog.create({
      data: { ministry: ministry.ministry, sourceName: source.name, sourceUrl: source.url, status: "error", error: msg, duration },
    });
    await prisma.source.upsert({
      where: { ministry_name: { ministry: ministry.ministry, name: source.name } },
      update: { lastError: msg, url: source.url },
      create: { ministry: ministry.ministry, name: source.name, url: source.url, type: source.type, lastError: msg },
    });
  }

  return { newItems: totalNew, updatedItems: totalUpdated, errors };
}

async function main() {
  prisma = await getScriptPrisma();

  console.log("=== 省庁RSS取得開始 ===");
  console.log(`対象省庁: ${MINISTRIES.length} 省庁`);
  console.log(`開始時刻: ${new Date().toISOString()}`);
  console.log("");

  let totalNew = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const ministry of MINISTRIES) {
    console.log(`[${ministry.ministry}]`);
    for (const source of ministry.sources) {
      const result = await fetchSource(ministry, source);
      totalNew += result.newItems;
      totalUpdated += result.updatedItems;
      totalErrors += result.errors.length;
      await sleep(FETCH_DELAY_MS);
    }
    console.log("");
  }

  console.log("=== 取得完了 ===");
  console.log(`新規: ${totalNew}, 更新: ${totalUpdated}, エラー: ${totalErrors}`);
  console.log(`終了時刻: ${new Date().toISOString()}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命的エラー:", e);
  process.exit(1);
});
