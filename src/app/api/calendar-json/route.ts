import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

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
    
    // 月でフィルタリング
    let filteredItems = items;
    if (month) {
      filteredItems = items.filter((item: any) => {
        const itemDate = new Date(item.published_at);
        const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;
        return itemMonth === month;
      });
    }
    
    // 日付ごとにグループ化
    const calendar: Record<string, { count: number; ministries: string[] }> = {};
    
    for (const item of filteredItems) {
      const itemDate = new Date(item.published_at);
      const dateKey = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}`;
      
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
