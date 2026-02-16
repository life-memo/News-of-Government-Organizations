/**
 * 既存DBデータのバックフィルスクリプト
 * - URL正規化の再適用
 * - dateEstimated フラグの適切な設定
 * 
 * 実行: npx tsx scripts/backfill.ts
 */

import "dotenv/config";
import { getScriptPrisma } from "./db.js";
import ministriesData from "../src/config/ministries.json";

interface MinistryConfig {
  key: string;
  ministry: string;
  short: string;
  color: string;
  siteUrl: string;
  sources: Array<{ name: string; url: string; type: string }>;
}

const MINISTRIES: MinistryConfig[] = ministriesData as MinistryConfig[];

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

function getMinistryConfig(ministryLabel: string): MinistryConfig | undefined {
  return MINISTRIES.find((m) => m.ministry === ministryLabel);
}

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = await getScriptPrisma();

  console.log("=== 既存DBデータのバックフィル開始 ===");
  console.log(`開始時刻: ${new Date().toISOString()}`);
  console.log("");

  let totalProcessed = 0;
  let totalUpdated = 0;

  // 全アイテムを取得
  const allItems = await prisma.item.findMany({
    orderBy: { createdAt: "asc" },
  });

  console.log(`処理対象: ${allItems.length} 件`);
  console.log("");

  for (const item of allItems) {
    totalProcessed++;
    let needsUpdate = false;
    const updates: Record<string, unknown> = {};

    // 1. URL正規化の再適用
    const ministryConfig = getMinistryConfig(item.ministry);
    if (ministryConfig) {
      const normalizedUrl = normalizeUrl(item.url, ministryConfig.siteUrl);
      if (normalizedUrl && normalizedUrl !== item.url) {
        updates.url = normalizedUrl;
        needsUpdate = true;
        console.log(`  [${item.id}] URL正規化: ${item.url.slice(0, 50)}... → ${normalizedUrl.slice(0, 50)}...`);
      }
    }

    // 2. dateEstimated フラグの検証
    // - publishedAt が null の場合は削除（本来発生しないはず）
    // - dateEstimated が未設定の場合は false に設定
    if (!item.publishedAt) {
      console.log(`  [${item.id}] published_at が null のため削除: ${item.title.slice(0, 50)}...`);
      await prisma.item.delete({ where: { id: item.id } });
      continue;
    }

    if (item.dateEstimated === null || item.dateEstimated === undefined) {
      updates.dateEstimated = false;
      needsUpdate = true;
      console.log(`  [${item.id}] dateEstimated を false に設定`);
    }

    // 3. 更新が必要な場合のみ実行
    if (needsUpdate) {
      await prisma.item.update({
        where: { id: item.id },
        data: updates,
      });
      totalUpdated++;
    }

    if (totalProcessed % 100 === 0) {
      console.log(`進捗: ${totalProcessed} / ${allItems.length} 件処理済み`);
    }
  }

  console.log("");
  console.log("=== バックフィル完了 ===");
  console.log(`処理件数: ${totalProcessed}`);
  console.log(`更新件数: ${totalUpdated}`);
  console.log(`終了時刻: ${new Date().toISOString()}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("致命的エラー:", e);
  process.exit(1);
});
