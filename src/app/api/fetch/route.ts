import { NextResponse } from "next/server";
import { createHash } from "crypto";
import RssParser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { MINISTRIES, FETCH_TIMEOUT_MS, USER_AGENT, FETCH_DELAY_MS } from "@/lib/constants";
import type { MinistryConfig, SourceConfig } from "@/lib/constants";
import {
  normalizeUrl,
  extractPublishedAt,
  detectContentKind,
  discoverFeedUrls,
  stripHtml,
} from "@/lib/feedUtils";

/**
 * POST /api/fetch
 * 全省庁のRSS/Atomを取得してDBに保存する。
 */

const rssParser = new RssParser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
  },
});

function generateHash(title: string, url: string, publishedAt: string): string {
  return createHash("sha256")
    .update(`${title}||${url}||${publishedAt}`)
    .digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 単一フィードURLをパースして記事を処理する */
async function processFeed(
  feedUrl: string,
  ministry: MinistryConfig,
  sourceName: string,
): Promise<{ newItems: number; updatedItems: number }> {
  let newItems = 0;
  let updatedItems = 0;

  const feed = await rssParser.parseURL(feedUrl);

  for (const item of feed.items || []) {
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
      // コンテンツ変更チェック（同URL）
      const sameUrlItem = await prisma.item.findFirst({
        where: { url, ministry: ministry.ministry },
      });
      if (
        sameUrlItem &&
        (sameUrlItem.title !== title || sameUrlItem.summaryRaw !== summaryRaw)
      ) {
        await prisma.item.update({
          where: { id: sameUrlItem.id },
          data: { title, summaryRaw, contentText, updatedFlag: true },
        });
        updatedItems++;
      }
      continue;
    }

    await prisma.item.create({
      data: {
        ministry: ministry.ministry,
        sourceName,
        title,
        url,
        publishedAt: effectiveDate,
        summaryRaw: summaryRaw || null,
        contentText: contentText || null,
        hash,
        dateEstimated,
      },
    });
    newItems++;
  }

  return { newItems, updatedItems };
}

/** ソースを取得し、HTML判定・RSSディスカバリー・フィードパースを行う */
async function fetchSource(
  ministry: MinistryConfig,
  source: SourceConfig,
): Promise<{ newItems: number; updatedItems: number; error?: string }> {
  const startTime = Date.now();
  let totalNew = 0;
  let totalUpdated = 0;

  try {
    // rss-discovery タイプ: HTMLからフィードURLを探して各フィードを処理
    if (source.type === "rss-discovery") {
      const res = await fetch(source.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await res.text();
      const kind = detectContentKind(res.headers.get("content-type") || "", body.slice(0, 200));

      let feedUrls: string[] = [];
      if (kind === "html") {
        feedUrls = discoverFeedUrls(body, source.url);
      } else if (kind === "feed") {
        // 実は直接フィードだった
        feedUrls = [source.url];
      }

      for (const feedUrl of feedUrls) {
        try {
          const result = await processFeed(feedUrl, ministry, source.name);
          totalNew += result.newItems;
          totalUpdated += result.updatedItems;
        } catch {
          // 個別フィードのエラーは無視して続行
        }
        await sleep(500);
      }
    } else {
      // 通常の rss/atom ソース
      // まず Content-Type をチェック（HTML 返却のフォールバック対応）
      const res = await fetch(source.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const body = await res.text();
      const kind = detectContentKind(res.headers.get("content-type") || "", body.slice(0, 200));

      if (kind === "html") {
        // HTML が返ってきた場合: RSS ディスカバリーにフォールバック
        const feedUrls = discoverFeedUrls(body, source.url);
        for (const feedUrl of feedUrls) {
          try {
            const result = await processFeed(feedUrl, ministry, source.name);
            totalNew += result.newItems;
            totalUpdated += result.updatedItems;
          } catch {
            // skip individual feed errors
          }
          await sleep(500);
        }
      } else {
        // 正常なフィード
        const result = await processFeed(source.url, ministry, source.name);
        totalNew += result.newItems;
        totalUpdated += result.updatedItems;
      }
    }

    const duration = Date.now() - startTime;
    await prisma.fetchLog.create({
      data: {
        ministry: ministry.ministry,
        sourceName: source.name,
        sourceUrl: source.url,
        status: "success",
        itemCount: totalNew + totalUpdated,
        duration,
      },
    });

    await prisma.source.upsert({
      where: { ministry_name: { ministry: ministry.ministry, name: source.name } },
      update: { lastFetchedAt: new Date(), lastError: null, url: source.url },
      create: {
        ministry: ministry.ministry,
        name: source.name,
        url: source.url,
        type: source.type,
        lastFetchedAt: new Date(),
      },
    });

    return { newItems: totalNew, updatedItems: totalUpdated };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    await prisma.fetchLog.create({
      data: {
        ministry: ministry.ministry,
        sourceName: source.name,
        sourceUrl: source.url,
        status: "error",
        error: msg,
        duration,
      },
    });

    return { newItems: 0, updatedItems: 0, error: msg };
  }
}

export async function POST() {
  const results: Array<{
    ministry: string;
    source: string;
    newItems: number;
    updatedItems: number;
    error?: string;
  }> = [];

  for (const ministry of MINISTRIES) {
    for (const source of ministry.sources) {
      const result = await fetchSource(ministry, source);
      results.push({
        ministry: ministry.ministry,
        source: source.name,
        newItems: result.newItems,
        updatedItems: result.updatedItems,
        error: result.error,
      });
      await sleep(FETCH_DELAY_MS);
    }
  }

  const totalNew = results.reduce((s, r) => s + r.newItems, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updatedItems, 0);
  const totalErrors = results.filter((r) => r.error).length;

  return NextResponse.json({
    success: true,
    totalNew,
    totalUpdated,
    totalErrors,
    results,
    fetchedAt: new Date().toISOString(),
  });
}
