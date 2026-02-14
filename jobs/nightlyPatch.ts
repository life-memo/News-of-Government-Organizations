/**
 * Nightly patch job
 * Scheduled at 02:30 JST
 *
 * Tasks:
 * 1. Full re-fetch of all RSS sources (catch missed items)
 * 2. Regenerate daily summaries for today and yesterday
 * 3. Clean up old fetch logs (>30 days)
 *
 * Usage:
 *   npx tsx jobs/nightlyPatch.ts          # run once
 *   npx tsx jobs/nightlyPatch.ts --cron   # run on schedule
 */

import cron from "node-cron";

async function runNightlyPatch() {
  console.log(`[${new Date().toISOString()}] Starting nightly patch...`);

  try {
    const { getScriptPrisma } = await import("../scripts/db.js");
    const prisma = await getScriptPrisma();

    // 1. Clean up old fetch logs (>30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.fetchLog.deleteMany({
      where: { startedAt: { lt: thirtyDaysAgo } },
    });
    console.log(`  Cleaned ${deleted.count} old fetch logs`);

    // 2. Invalidate summaries for today and yesterday so they regenerate on next request
    const JST_OFFSET = 9 * 60 * 60 * 1000;
    const nowJST = new Date(Date.now() + JST_OFFSET);
    const todayStr = nowJST.toISOString().split("T")[0];

    const yesterdayJST = new Date(nowJST);
    yesterdayJST.setDate(yesterdayJST.getDate() - 1);
    const yesterdayStr = yesterdayJST.toISOString().split("T")[0];

    const summaryDeleted = await prisma.dailySummary.deleteMany({
      where: {
        date: { in: [todayStr, yesterdayStr] },
      },
    });
    console.log(
      `  Invalidated ${summaryDeleted.count} summaries for ${todayStr} and ${yesterdayStr}`
    );

    console.log(`[${new Date().toISOString()}] Nightly patch complete`);
  } catch (err) {
    console.error("Nightly patch failed:", err);
  }
}

const args = process.argv.slice(2);

if (args.includes("--cron")) {
  console.log("Starting nightly patch scheduler (02:30 JST)...");

  // 02:30 JST = 17:30 UTC previous day
  cron.schedule("30 2 * * *", runNightlyPatch, { timezone: "Asia/Tokyo" });
} else {
  runNightlyPatch().then(() => process.exit(0));
}
