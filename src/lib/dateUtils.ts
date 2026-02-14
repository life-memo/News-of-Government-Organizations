/**
 * Asia/Tokyo timezone utilities
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Get current Date adjusted to JST */
export function nowJST(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/** Format a date as YYYY-MM-DD in JST */
export function toDateStringJST(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return jst.toISOString().split("T")[0];
}

/** Date → "YYYY-MM-DD"（JST基準・ゼロ埋め）。全箇所でこの関数を使う */
export function toYMD(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" → Date（JST正午）。不正な場合は null を返す */
export function parseYMD(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00+09:00`);
  if (isNaN(d.getTime())) return null;
  // 日付がパース後に変わっていないか確認（例: 02-30 → 03-02 の防止）
  const [year, month, day] = ymd.split("-").map(Number);
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

/** Get today's date string in JST */
export function todayStringJST(): string {
  return toDateStringJST(new Date());
}

/** Get start and end of a JST day as UTC Dates */
export function dayRangeJST(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00+09:00`);
  const end = new Date(`${dateStr}T23:59:59.999+09:00`);
  return { start, end };
}

/** Format date for display: "2026年2月14日（土）" */
export function formatDateDisplay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = weekdays[d.getDay()];
  return `${year}年${month}月${day}日（${dow}）`;
}

/** Format a UTC Date to HH:MM in JST */
export function formatTimeJST(date: Date): string {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return `${String(jst.getUTCHours()).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

/** Get year and month from today in JST */
export function currentYearMonthJST(): { year: number; month: number } {
  const jst = nowJST();
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
  };
}

/** Short ministry name mapping */
export function getShortName(ministry: string): string {
  const map: Record<string, string> = {
    内閣府: "内閣",
    法務省: "法務",
    経済産業省: "経産",
    国土交通省: "国交",
    防衛省: "防衛",
    外務省: "外務",
    総務省: "総務",
    厚生労働省: "厚労",
    文部科学省: "文科",
    農林水産省: "農水",
  };
  return map[ministry] || ministry.slice(0, 2);
}

/** Simple topic extraction: frequent keywords from titles */
export function extractTopics(titles: string[]): string[] {
  const stopWords = new Set([
    "について", "に関する", "における", "に係る", "及び", "等",
    "令和", "年度", "お知らせ", "開催", "公表", "公開", "発表",
    "結果", "概要", "報告",
  ]);

  const wordCount: Record<string, number> = {};
  for (const title of titles) {
    const matches = title.match(
      /[\u30A0-\u30FF]{2,}|[\u4E00-\u9FFF]{2,}|[A-Za-z]{3,}/g
    );
    if (matches) {
      for (const word of matches) {
        if (!stopWords.has(word) && word.length >= 2) {
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      }
    }
  }

  return Object.entries(wordCount)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}
