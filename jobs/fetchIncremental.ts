/**
 * Incremental RSS fetch job
 * Scheduled at 10:00 and 15:00 JST
 *
 * Usage:
 *   npx tsx jobs/fetchIncremental.ts          # run once
 *   npx tsx jobs/fetchIncremental.ts --cron   # run on schedule
 */

import cron from "node-cron";

async function runFetch() {
  console.log(`[${new Date().toISOString()}] Starting incremental fetch...`);

  try {
    // Dynamic import to handle ESM Prisma client
    const { getScriptPrisma } = await import("../scripts/db.js");
    const prisma = await getScriptPrisma();

    const ministriesData = await import("../src/config/ministries.json", {
      with: { type: "json" },
    });
    const ministries = ministriesData.default;

    const RssParser = (await import("rss-parser")).default;
    const parser = new RssParser({ timeout: 15000 });
    const { createHash } = await import("crypto");
    const { v4: uuidv4 } = await import("uuid");

    let totalNew = 0;
    let totalUpdated = 0;

    for (const ministry of ministries) {
      for (const source of ministry.sources) {
        try {
          const feed = await parser.parseURL(source.url);

          for (const entry of feed.items || []) {
            const url = entry.link || "";
            if (!url) continue;

            const title = entry.title || "(無題)";
            const published = entry.pubDate
              ? new Date(entry.pubDate)
              : new Date();
            const contentText =
              entry.contentSnippet || entry.content || null;
            const summaryRaw =
              entry.summary || entry.contentSnippet || null;

            const hash = createHash("md5")
              .update(`${url}|${title}|${contentText || ""}`)
              .digest("hex");

            const existing = await prisma.item.findFirst({
              where: { url, ministry: ministry.ministry },
            });

            if (!existing) {
              await prisma.item.create({
                data: {
                  id: uuidv4(),
                  ministry: ministry.ministry,
                  sourceName: source.name,
                  url,
                  title,
                  publishedAt: published,
                  fetchedAt: new Date(),
                  contentHash: hash,
                  summaryRaw,
                  contentText,
                  updatedFlag: false,
                },
              });
              totalNew++;
            } else if (existing.contentHash !== hash) {
              await prisma.item.update({
                where: { id: existing.id },
                data: {
                  title,
                  contentHash: hash,
                  summaryRaw,
                  contentText,
                  updatedFlag: true,
                  fetchedAt: new Date(),
                },
              });
              totalUpdated++;
            }
          }

          // Polite delay between sources
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          console.error(
            `  Error fetching ${ministry.ministry}/${source.name}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    // Log result
    await prisma.fetchLog.create({
      data: {
        id: uuidv4(),
        startedAt: new Date(),
        finishedAt: new Date(),
        itemsNew: totalNew,
        itemsUpdated: totalUpdated,
        errors: 0,
      },
    });

    console.log(
      `[${new Date().toISOString()}] Fetch complete: ${totalNew} new, ${totalUpdated} updated`
    );
  } catch (err) {
    console.error("Fetch job failed:", err);
  }
}

const args = process.argv.slice(2);

if (args.includes("--cron")) {
  console.log("Starting incremental fetch scheduler (10:00, 15:00 JST)...");

  // 10:00 JST = 01:00 UTC, 15:00 JST = 06:00 UTC
  cron.schedule("0 1 * * *", runFetch, { timezone: "Asia/Tokyo" });
  cron.schedule("0 6 * * *", runFetch, { timezone: "Asia/Tokyo" });

  // Also run once immediately
  runFetch();
} else {
  runFetch().then(() => process.exit(0));
}
