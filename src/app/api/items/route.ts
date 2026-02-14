import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date"); // "2026-02-13"
  const ministry = searchParams.get("ministry"); // comma-separated
  const q = searchParams.get("q"); // keyword search
  const from = searchParams.get("from"); // "2026-02-01"
  const to = searchParams.get("to"); // "2026-02-28"
  const sort = searchParams.get("sort") || "desc"; // "asc" | "desc"
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Date filter
  if (date) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    where.publishedAt = { gte: startOfDay, lte: endOfDay };
  } else if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.publishedAt.lte = new Date(`${to}T23:59:59.999Z`);
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

  // Keyword search (title + summaryRaw)
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
