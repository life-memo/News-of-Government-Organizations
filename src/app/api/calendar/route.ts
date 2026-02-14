import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * カレンダー用: 月ごとの日別・省庁別件数を返す
 * GET /api/calendar?year=2026&month=2&ministry=経済産業省,外務省
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);
  const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString(), 10);
  const ministryFilter = searchParams.get("ministry");

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    publishedAt: { gte: startDate, lte: endDate },
  };

  if (ministryFilter) {
    const ministries = ministryFilter.split(",").map((m) => m.trim());
    if (ministries.length === 1) {
      where.ministry = ministries[0];
    } else {
      where.ministry = { in: ministries };
    }
  }

  try {
    const items = await prisma.item.findMany({
      where,
      select: {
        publishedAt: true,
        ministry: true,
      },
    });

    // Aggregate by date and ministry
    const dateMap: Record<string, Record<string, number>> = {};

    for (const item of items) {
      const dateKey = item.publishedAt.toISOString().split("T")[0];
      if (!dateMap[dateKey]) dateMap[dateKey] = {};
      dateMap[dateKey][item.ministry] = (dateMap[dateKey][item.ministry] || 0) + 1;
    }

    // Transform to array
    const days = Object.entries(dateMap).map(([date, ministries]) => {
      const total = Object.values(ministries).reduce((a, b) => a + b, 0);
      return {
        date,
        total,
        ministries,
      };
    });

    days.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ year, month, days });
  } catch (error) {
    console.error("API /api/calendar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
