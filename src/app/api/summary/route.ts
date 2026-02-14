import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDailySummary } from "@/lib/summary";
import { dayRangeJST, todayStringJST, extractTopics } from "@/lib/dateUtils";

/**
 * GET /api/summary?date=YYYY-MM-DD
 * Returns combined summary: overall points, ministry summaries, stats, topics
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date") || todayStringJST();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  try {
    const { start, end } = dayRangeJST(date);

    const items = await prisma.item.findMany({
      where: {
        publishedAt: { gte: start, lte: end },
      },
      select: {
        title: true,
        ministry: true,
        summaryRaw: true,
        contentText: true,
      },
      orderBy: { publishedAt: "desc" },
    });

    // Stats
    const ministrySet = new Set(items.map((i) => i.ministry));

    // Overall summary
    const overallSummary = await getDailySummary(date);

    // Per-ministry summaries
    const ministrySummaries: Record<string, { points: string[] }> = {};
    for (const ministry of ministrySet) {
      ministrySummaries[ministry] = await getDailySummary(date, ministry);
    }

    // Topic extraction
    const topics = extractTopics(items.map((i) => i.title));

    return NextResponse.json({
      date,
      totalItems: items.length,
      ministryCount: ministrySet.size,
      points: overallSummary.points,
      ministrySummaries,
      topics,
    });
  } catch (error) {
    console.error("API /api/summary error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
