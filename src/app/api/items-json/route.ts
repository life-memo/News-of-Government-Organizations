import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

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
    
    // 日付フィルタ
    if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      items = items.filter((item: any) => {
        const itemDate = new Date(item.published_at);
        return itemDate >= targetDate && itemDate < nextDate;
      });
    } else if (from || to) {
      items = items.filter((item: any) => {
        const itemDate = new Date(item.published_at);
        if (from && itemDate < new Date(from)) return false;
        if (to) {
          const toDate = new Date(to);
          toDate.setDate(toDate.getDate() + 1);
          if (itemDate >= toDate) return false;
        }
        return true;
      });
    }
    
    // 省庁フィルタ
    if (ministry) {
      const ministries = ministry.split(',').map(m => m.trim());
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
