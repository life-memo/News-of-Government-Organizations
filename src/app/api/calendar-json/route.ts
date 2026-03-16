import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJSTDateKey(published_at: string): string {
  const jst = new Date(new Date(published_at).getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // YYYY-MM format

    // JSONファイルを読み込み
    const jsonPath = path.join(process.cwd(), 'public/data/items.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({});
    }

    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const items = JSON.parse(jsonData);

    // 月でフィルタリング（JST基準）
    let filteredItems = items;
    if (month) {
      filteredItems = items.filter((item: any) => {
        return toJSTDateKey(item.published_at).startsWith(month);
      });
    }

    // 日付ごとにグループ化（JST基準）
    const calendar: Record<string, { count: number; ministries: string[] }> = {};

    for (const item of filteredItems) {
      const dateKey = toJSTDateKey(item.published_at);

      if (!calendar[dateKey]) {
        calendar[dateKey] = { count: 0, ministries: [] };
      }

      calendar[dateKey].count++;

      if (!calendar[dateKey].ministries.includes(item.ministry)) {
        calendar[dateKey].ministries.push(item.ministry);
      }
    }

    return NextResponse.json(calendar);
  } catch (error) {
    console.error('Error reading calendar data:', error);
    return NextResponse.json({ error: 'Failed to load calendar data' }, { status: 500 });
  }
}
