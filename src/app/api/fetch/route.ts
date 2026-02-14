import { NextResponse } from "next/server";
import { createHash } from "crypto";
import RssParser from "rss-parser";
import { prisma } from "@/lib/prisma";
import { MINISTRIES, FETCH_TIMEOUT_MS, USER_AGENT, FETCH_DELAY_MS } from "@/lib/constants";

/**
 * 手動フェッチ用API
 * POST /api/fetch
 *
 * Vercel Scheduled Functions / cron / 手動トリガーで利用
 * Authorization: Bearer <CRON_SECRET> でセキュリティ確保（本番向け）
 */

const rssParser = new RssParser({
  timeout: FETCH_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml",
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
      const startTime = Date.now();
      let newItems = 0;
      let updatedItems = 0;

      try {
        const feed = await rssParser.parseURL(source.url);
        const items = feed.items || [];

        for (const item of items) {
          const title = item.title?.trim() || "(タイトルなし)";
          const url = item.link?.trim() || "";
          if (!url) continue;

          const { date: publishedAt, estimated } = parseDate(
            item.pubDate || item.isoDate
          );
          const summaryRaw = stripHtml(item.contentSnippet || item.content || item.summary);
          const contentText = stripHtml(item["content:encoded"] || item.content);
          const hash = generateHash(title, url, publishedAt.toISOString());

          const existing = await prisma.item.findUnique({ where: { hash } });

          if (existing) {
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
        }

        const duration = Date.now() - startTime;
        await prisma.fetchLog.create({
          data: {
            ministry: ministry.ministry,
            sourceName: source.name,
            sourceUrl: source.url,
            status: "success",
            itemCount: items.length,
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

        results.push({
          ministry: ministry.ministry,
          source: source.name,
          newItems: 0,
          updatedItems: 0,
          error: msg,
        });
        continue;
      }

      results.push({
        ministry: ministry.ministry,
        source: source.name,
        newItems,
        updatedItems,
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
