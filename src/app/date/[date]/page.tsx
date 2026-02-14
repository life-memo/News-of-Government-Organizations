import { prisma } from "@/lib/prisma";
import { getDailySummary } from "@/lib/summary";
import Link from "next/link";
import ministriesData from "@/config/ministries.json";

interface MinistryConfig {
  ministry: string;
  color: string;
}

const MINISTRIES: MinistryConfig[] = ministriesData as MinistryConfig[];
const MINISTRY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  MINISTRIES.map((m) => [m.ministry, m.color])
);

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function DateDetailPage({ params }: PageProps) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return (
      <div className="text-center py-20 text-gray-500">
        無効な日付です。形式: YYYY-MM-DD
      </div>
    );
  }

  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  const items = await prisma.item.findMany({
    where: {
      publishedAt: { gte: startOfDay, lte: endOfDay },
    },
    orderBy: { publishedAt: "desc" },
  });

  // Group by ministry
  const byMinistry: Record<string, typeof items> = {};
  for (const item of items) {
    if (!byMinistry[item.ministry]) byMinistry[item.ministry] = [];
    byMinistry[item.ministry].push(item);
  }

  // Get summaries
  const overallSummary = await getDailySummary(date);
  const ministrySummaries: Record<string, { points: string[] }> = {};
  for (const ministry of Object.keys(byMinistry)) {
    ministrySummaries[ministry] = await getDailySummary(date, ministry);
  }

  // Date navigation
  const d = new Date(date);
  const prevDate = new Date(d);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(d);
  nextDate.setDate(nextDate.getDate() + 1);
  const fmt = (dt: Date) => dt.toISOString().split("T")[0];

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const displayDate = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/date/${fmt(prevDate)}`}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
          >
            &larr;
          </Link>
          <h1 className="text-xl font-bold">{displayDate}</h1>
          <Link
            href={`/date/${fmt(nextDate)}`}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
          >
            &rarr;
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>合計 {items.length} 件</span>
          <span>/ {Object.keys(byMinistry).length} 省庁</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          この日の新着情報はありません
        </div>
      ) : (
        <>
          {/* Overall summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-sm font-semibold text-blue-800 mb-2">
              この日の全体要約
            </h2>
            <ul className="space-y-1">
              {overallSummary.points.map((point, i) => (
                <li key={i} className="text-sm text-blue-900 flex gap-2">
                  <span className="text-blue-400 flex-shrink-0">-</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* By ministry */}
          <div className="space-y-4">
            {Object.entries(byMinistry)
              .sort(([, a], [, b]) => b.length - a.length)
              .map(([ministry, ministryItems]) => {
                const color = MINISTRY_COLOR_MAP[ministry] || "#6b7280";
                const summary = ministrySummaries[ministry];

                return (
                  <div
                    key={ministry}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <h2 className="font-semibold text-base">{ministry}</h2>
                      <span className="text-sm text-gray-500">
                        {ministryItems.length}件
                      </span>
                    </div>

                    {summary && summary.points.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <ul className="space-y-0.5">
                          {summary.points.map((point, i) => (
                            <li
                              key={i}
                              className="text-xs text-gray-600 flex gap-1.5"
                            >
                              <span className="text-gray-400 flex-shrink-0">-</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="divide-y divide-gray-100">
                      {ministryItems.map((item) => {
                        const time = new Date(item.publishedAt);
                        const timeStr = `${String(time.getUTCHours()).padStart(2, "0")}:${String(time.getUTCMinutes()).padStart(2, "0")}`;

                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="text-xs text-gray-400 mt-0.5 flex-shrink-0 font-mono w-10">
                                {timeStr}
                              </span>
                              <div className="flex-1 min-w-0">
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                                >
                                  {item.title}
                                  <span className="inline-block ml-1 text-gray-300 text-xs">
                                    &#x2197;
                                  </span>
                                </a>
                                {item.summaryRaw && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                    {item.summaryRaw}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-gray-400">
                                    {item.sourceName}
                                  </span>
                                  {item.updatedFlag && (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded">
                                      更新
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
