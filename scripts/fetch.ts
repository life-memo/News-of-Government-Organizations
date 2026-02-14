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
  ministry: string;
  color: string;
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
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
  },
  requestOptions: {
    // @ts-expect-error rss-parser accepts this
    timeout: FETCH_TIMEOUT_MS,
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

function parseDate(dateStr: string | undefined): { date: Date; estimated: boolean } {
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return { date: parsed, estimated: false };
    }
  }
  return { date: new Date(), estimated: true };
}

function stripHtml(html: string | undefined): string | undefined {
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

async function fetchSource(
  ministry: string,
  source: SourceConfig
): Promise<{ newItems: number; updatedItems: number; errors: string[] }> {
  const errors: string[] = [];
  let newItems = 0;
  let updatedItems = 0;
  const startTime = Date.now();

  try {
    console.log(`  取得中: ${ministry} - ${source.name} (${source.url})`);

    const feed = await rssParser.parseURL(source.url);
    const items = feed.items || [];

    console.log(`  -> ${items.length} 件取得`);

    for (const item of items) {
      try {
        const title = item.title?.trim() || "(タイトルなし)";
        const url = item.link?.trim() || "";
        if (!url) continue;

        const { date: publishedAt, estimated } = parseDate(
          item.pubDate || item.isoDate
        );
        const summaryRaw = stripHtml(item.contentSnippet || item.content || item.summary);
        const contentText = stripHtml(item["content:encoded"] || item.content);
        const hash = generateHash(title, url, publishedAt.toISOString());

        // Check for existing item by hash (exact duplicate)
        const existing = await prisma.item.findUnique({ where: { hash } });

        if (existing) {
          // Check if content changed for same URL
          const sameUrlItem = await prisma.item.findFirst({
            where: { url, ministry },
          });
          if (
            sameUrlItem &&
            (sameUrlItem.title !== title ||
              sameUrlItem.summaryRaw !== summaryRaw)
          ) {
            await prisma.item.update({
              where: { id: sameUrlItem.id },
              data: {
                title,
                summaryRaw,
                contentText,
                updatedFlag: true,
              },
            });
            updatedItems++;
          }
          continue;
        }

        await prisma.item.create({
          data: {
            ministry,
            sourceName: source.name,
            title,
            url,
            publishedAt,
            summaryRaw: summaryRaw || null,
            contentText: contentText || null,
            hash,
            dateEstimated: estimated,
          },
        });
        newItems++;
      } catch (itemError: unknown) {
        const msg =
          itemError instanceof Error ? itemError.message : String(itemError);
        errors.push(`アイテム処理エラー: ${msg}`);
      }
    }

    const duration = Date.now() - startTime;
    await prisma.fetchLog.create({
      data: {
        ministry,
        sourceName: source.name,
        sourceUrl: source.url,
        status: "success",
        itemCount: items.length,
        duration,
      },
    });

    // Update source record
    await prisma.source.upsert({
      where: { ministry_name: { ministry, name: source.name } },
      update: { lastFetchedAt: new Date(), lastError: null, url: source.url },
      create: {
        ministry,
        name: source.name,
        url: source.url,
        type: source.type,
        lastFetchedAt: new Date(),
      },
    });
  } catch (fetchError: unknown) {
    const msg =
      fetchError instanceof Error ? fetchError.message : String(fetchError);
    errors.push(`フィード取得エラー: ${msg}`);
    console.error(`  ✗ エラー: ${ministry} - ${source.name}: ${msg}`);

    const duration = Date.now() - startTime;
    await prisma.fetchLog.create({
      data: {
        ministry,
        sourceName: source.name,
        sourceUrl: source.url,
        status: "error",
        error: msg,
        duration,
      },
    });

    await prisma.source.upsert({
      where: { ministry_name: { ministry, name: source.name } },
      update: { lastError: msg, url: source.url },
      create: {
        ministry,
        name: source.name,
        url: source.url,
        type: source.type,
        lastError: msg,
      },
    });
  }

  return { newItems, updatedItems, errors };
}

async function main() {
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
      const result = await fetchSource(ministry.ministry, source);
      totalNew += result.newItems;
      totalUpdated += result.updatedItems;
      totalErrors += result.errors.length;

      if (result.newItems > 0 || result.updatedItems > 0) {
        console.log(
          `  -> 新規: ${result.newItems}, 更新: ${result.updatedItems}`
        );
      }

      // Be polite: delay between requests
      await sleep(FETCH_DELAY_MS);
    }
    console.log("");
  }

  console.log("=== 取得完了 ===");
  console.log(`新規: ${totalNew}, 更新: ${totalUpdated}, エラー: ${totalErrors}`);
  console.log(`終了時刻: ${new Date().toISOString()}`);
}

main()
  .catch((e) => {
    console.error("致命的エラー:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
