import { NextRequest, NextResponse } from "next/server";
import { getDailySummary } from "@/lib/summary";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");
  const ministry = searchParams.get("ministry");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date parameter required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  try {
    const summary = await getDailySummary(date, ministry);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("API /api/daily-summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
