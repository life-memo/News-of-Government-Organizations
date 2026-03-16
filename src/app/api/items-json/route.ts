import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYY-MM-DD"（JST）をUTCの区間 [start, end) に変換 */
function jstDateToUTCRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // JSONファイルを読み込み
    const jsonPath = path.join(process.cwd(), 'public/data/items.json');

    if (!fs.existsSync(jsonPath)) {
      return NextResponse.json({ items: [], total: 0 });
    }

    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    let items = JSON.parse(jsonData);

    // フィルタリング
    const date = searchParams.get('date');
    const ministry = searchParams.get('ministry');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const search = searchParams.get('search');

    // 日付フィルタ（JST基準）
    if (date) {
      const { start, end } = jstDateToUTCRange(date);
      items = items.filter((item: any) => {
        const itemDate = new Date(item.published_at);
        return itemDate >= start && itemDate < end;
      });
    } else if (from || to) {
      const fromDate = from ? jstDateToUTCRange(from).start : null;
      const toDate = to ? jstDateToUTCRange(to).end : null;
      items = items.filter((item: any) => {
        const itemDate = new Date(item.published_at);
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate >= toDate) return false;
        return true;
      });
    }

    // 省庁フィルタ
    if (ministry) {
      const ministries = ministry.split(',').map((m: string) => m.trim());
      items = items.filter((item: any) => ministries.includes(item.ministry));
    }

    // 検索フィルタ
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter((item: any) =>
        item.title.toLowerCase().includes(searchLower)
      );
    }

    // ページネーション
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const total = items.length;
    const paginatedItems = items.slice(offset, offset + limit);

    return NextResponse.json({
      items: paginatedItems,
      total,
      page,
      limit,
      hasMore: offset + limit < total
    });
  } catch (error) {
    console.error('Error reading items:', error);
    return NextResponse.json({ error: 'Failed to load items' }, { status: 500 });
  }
}
