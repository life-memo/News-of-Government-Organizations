/**
 * GitHub Pages 静的エクスポート用: API ルートの代わりに
 * public/data/items.json を直接読み込んでフィルタリングする
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function toJSTDateKey(published_at: string): string {
  const jst = new Date(new Date(published_at).getTime() + JST_OFFSET_MS);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
}

// ブラウザ側のキャッシュ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedItems: any[] | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAllItems(): Promise<any[]> {
  if (cachedItems) return cachedItems;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const res = await fetch(`${base}/data/items.json`);
    if (!res.ok) return [];
    cachedItems = await res.json();
    return cachedItems ?? [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ItemsResult {
  items: any[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function fetchItemsJson(params: {
  date?: string;
  ministry?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ItemsResult> {
  const { date, ministry, search, page = 1, limit = 50 } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = await loadAllItems();

  if (date) {
    items = items.filter((item) => toJSTDateKey(item.published_at) === date);
  }

  if (ministry) {
    const ministries = ministry.split(",").map((m) => m.trim());
    items = items.filter((item) => ministries.includes(item.ministry));
  }

  if (search) {
    const sl = search.toLowerCase();
    items = items.filter((item) => item.title.toLowerCase().includes(sl));
  }

  const total = items.length;
  const offset = (page - 1) * limit;
  const paginatedItems = items.slice(offset, offset + limit);

  return { items: paginatedItems, total, page, limit, hasMore: offset + limit < total };
}

export type CalendarResult = Record<string, { count: number; ministries: string[] }>;

export async function fetchCalendarJson(month: string): Promise<CalendarResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[] = await loadAllItems();

  if (month) {
    items = items.filter((item) => toJSTDateKey(item.published_at).startsWith(month));
  }

  const calendar: CalendarResult = {};
  for (const item of items) {
    const dateKey = toJSTDateKey(item.published_at);
    if (!calendar[dateKey]) calendar[dateKey] = { count: 0, ministries: [] };
    calendar[dateKey].count++;
    if (!calendar[dateKey].ministries.includes(item.ministry)) {
      calendar[dateKey].ministries.push(item.ministry);
    }
  }

  return calendar;
}

/** ビルド時に items.json から全日付を取得（generateStaticParams 用） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAllDatesFromItems(items: any[]): string[] {
  const dates = new Set(items.map((item) => toJSTDateKey(item.published_at)));
  return [...dates];
}
