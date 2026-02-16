import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayRangeJST } from "@/lib/dateUtils";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");
  const ministry = searchParams.get("ministry");
  const q = searchParams.get("q");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sort = searchParams.get("sort") || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Date filter (JST)
  if (date) {
    const { start, end } = dayRangeJST(date);
    where.publishedAt = { gte: start, lte: end };
    where.dateEstimated = false; // 日付指定時は確実な日時のみ
  } else if (from || to) {
    where.publishedAt = {};
    if (from) {
      const { start } = dayRangeJST(from);
      where.publishedAt.gte = start;
    }
    if (to) {
      const { end } = dayRangeJST(to);
      where.publishedAt.lte = end;
    }
    where.dateEstimated = false; // 日付範囲指定時は確実な日時のみ
  }

  // Ministry filter
  if (ministry) {
    const ministries = ministry.split(",").map((m) => m.trim());
    if (ministries.length === 1) {
      where.ministry = ministries[0];
    } else {
      where.ministry = { in: ministries };
    }
  }

  // Keyword search
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { summaryRaw: { contains: q } },
      { contentText: { contains: q } },
    ];
  }

  try {
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        orderBy: { publishedAt: sort === "asc" ? "asc" : "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.item.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("API /api/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
