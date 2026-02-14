/**
 * 要約生成モジュール
 *
 * LLM実装は差し替え可能。MVPではダミー実装を提供し、
 * OPENAI_API_KEY が設定されていればOpenAI APIを利用する。
 *
 * 将来拡張:
 * - Claude API対応
 * - 重要度スコア自動付与
 * - カテゴリ自動分類
 */

import { createHash } from "crypto";
import { prisma } from "./prisma";

export interface SummaryInput {
  title: string;
  summaryRaw: string | null;
  contentText: string | null;
}

export interface SummaryResult {
  points: string[]; // 箇条書き配列
}

// --- Summary Provider Interface ---
export interface SummaryProvider {
  generateSummary(
    items: SummaryInput[],
    context: { ministry?: string; date: string }
  ): Promise<SummaryResult>;
}

// --- Dummy Provider (MVP default) ---
class DummySummaryProvider implements SummaryProvider {
  async generateSummary(
    items: SummaryInput[],
    context: { ministry?: string; date: string }
  ): Promise<SummaryResult> {
    const prefix = context.ministry
      ? `${context.ministry}の`
      : "全省庁の";
    const count = items.length;

    if (count === 0) {
      return { points: [`${prefix}新着情報はありません。`] };
    }

    // Summarize by picking top titles
    const titles = items.slice(0, 5).map((it) => it.title);
    const points = [
      `${prefix}新着情報 ${count}件（${context.date}）`,
      ...titles.map((t) => t),
    ];

    return { points: points.slice(0, 5) };
  }
}

// --- OpenAI Provider ---
class OpenAISummaryProvider implements SummaryProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateSummary(
    items: SummaryInput[],
    context: { ministry?: string; date: string }
  ): Promise<SummaryResult> {
    if (items.length === 0) {
      const prefix = context.ministry ? `${context.ministry}の` : "全省庁の";
      return { points: [`${prefix}新着情報はありません。`] };
    }

    const scope = context.ministry
      ? `${context.ministry}（${context.date}）`
      : `全省庁（${context.date}）`;

    const itemTexts = items
      .map((it, i) => {
        const parts = [`${i + 1}. タイトル: ${it.title}`];
        if (it.summaryRaw) parts.push(`   概要: ${it.summaryRaw.slice(0, 200)}`);
        return parts.join("\n");
      })
      .join("\n");

    const prompt = `以下は${scope}の新着情報一覧です。内容を日本語で要約してください。

要件:
- 箇条書きで最大5点
- 各点は1〜2文で簡潔に
- 類似する内容は統合して言及
- 重要な施策・発表を優先

新着情報:
${itemTexts}

JSON形式で回答してください: {"points": ["要約1", "要約2", ...]}`;

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "あなたは日本の省庁ニュースの要約を行うアシスタントです。簡潔で正確な日本語で回答してください。必ずJSON形式で回答してください。",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error: ${response.status}`);
        // Fallback to dummy
        return new DummySummaryProvider().generateSummary(items, context);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return { points: parsed.points || [] };
      }
    } catch (e) {
      console.error("OpenAI summary error:", e);
    }

    // Fallback to dummy
    return new DummySummaryProvider().generateSummary(items, context);
  }
}

// --- Provider Factory ---
function getSummaryProvider(): SummaryProvider {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return new OpenAISummaryProvider(openaiKey);
  }
  return new DummySummaryProvider();
}

// --- Helper: compute items hash for cache invalidation ---
function computeItemsHash(items: SummaryInput[]): string {
  const content = items.map((i) => `${i.title}|${i.summaryRaw || ""}`).join("||");
  return createHash("md5").update(content).digest("hex");
}

// --- Public API ---

/**
 * 日次要約を取得（キャッシュ優先）
 * データが更新されていれば再生成する
 */
export async function getDailySummary(
  date: string,
  ministry?: string | null
): Promise<SummaryResult> {
  // Get items for this date + ministry
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const items = await prisma.item.findMany({
    where: {
      publishedAt: { gte: startOfDay, lte: endOfDay },
      ...(ministry ? { ministry } : {}),
    },
    select: {
      title: true,
      summaryRaw: true,
      contentText: true,
    },
    orderBy: { publishedAt: "desc" },
  });

  const itemsHash = computeItemsHash(items);

  // Check cache
  const cached = await prisma.dailySummary.findUnique({
    where: {
      date_ministry: {
        date,
        ministry: ministry || "ALL",
      },
    },
  });

  if (cached && cached.itemsHash === itemsHash) {
    try {
      return JSON.parse(cached.summary) as SummaryResult;
    } catch {
      // Corrupted cache, regenerate
    }
  }

  // Generate new summary
  const provider = getSummaryProvider();
  const result = await provider.generateSummary(items, {
    ministry: ministry || undefined,
    date,
  });

  // Cache it
  await prisma.dailySummary.upsert({
    where: {
      date_ministry: {
        date,
        ministry: ministry || "ALL",
      },
    },
    update: {
      summary: JSON.stringify(result),
      itemCount: items.length,
      itemsHash,
      generatedAt: new Date(),
    },
    create: {
      date,
      ministry: ministry || "ALL",
      summary: JSON.stringify(result),
      itemCount: items.length,
      itemsHash,
    },
  });

  return result;
}
