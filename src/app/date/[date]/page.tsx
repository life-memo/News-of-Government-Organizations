import { prisma } from "@/lib/prisma";
import { getDailySummary } from "@/lib/summary";
import Link from "next/link";
import { MINISTRIES, labelToKey, getMinistry } from "@/config/ministries";
import {
  dayRangeJST,
  formatDateDisplay,
  formatTimeJST,
} from "@/lib/dateUtils";

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

  const { start, end } = dayRangeJST(date);

  const items = await prisma.item.findMany({
    where: {
      publishedAt: { gte: start, lte: end },
    },
    orderBy: { publishedAt: "desc" },
  });

  // Group by ministryKey
  const byKey: Record<string, typeof items> = {};
  for (const item of items) {
    const mk = labelToKey(item.ministry);
    if (!byKey[mk]) byKey[mk] = [];
    byKey[mk].push(item);
  }

  // Get summaries (API uses label)
  const overallSummary = await getDailySummary(date);
  const ministrySummaries: Record<string, { points: string[] }> = {};
  for (const mk of Object.keys(byKey)) {
    const def = getMinistry(mk);
    ministrySummaries[mk] = await getDailySummary(date, def.label);
  }

  // Build sorted section list: registered ministries first (by count desc), then unknown
  const sections = MINISTRIES.filter((m) => byKey[m.key]?.length)
    .map((m) => ({ key: m.key, def: m, items: byKey[m.key] }))
    .sort((a, b) => b.items.length - a.items.length);

  for (const [mk, mkItems] of Object.entries(byKey)) {
    if (!sections.some((s) => s.key === mk)) {
      sections.push({ key: mk, def: getMinistry(mk), items: mkItems });
    }
  }

  // Date navigation
  const d = new Date(`${date}T12:00:00+09:00`);
  const prevDate = new Date(d);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(d);
  nextDate.setDate(nextDate.getDate() + 1);
  const fmt = (dt: Date) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

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
          <h1 className="text-xl font-bold">{formatDateDisplay(date)}</h1>
          <Link
            href={`/date/${fmt(nextDate)}`}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-500"
          >
            &rarr;
          </Link>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>合計 {items.length} 件</span>
          <span>/ {sections.length} 省庁</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          この日の新着情報はありません
        </div>
      ) : (
        <>
          {/* Overall summary */}
          {overallSummary.points.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h2 className="text-sm font-semibold text-blue-800 mb-2">
                この日の全体要約
              </h2>
              <ul className="space-y-1">
                {overallSummary.points.slice(0, 3).map((point, i) => (
                  <li key={i} className="text-sm text-blue-900 flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">
                      &#x25B8;
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* By ministry */}
          <div className="space-y-4">
            {sections.map((section) => {
                const { def, items: sectionItems } = section;
                const summary = ministrySummaries[section.key];

                return (
                  <div
                    key={section.key}
                    className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ borderLeft: `4px solid ${def.color}` }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs text-white px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: def.color }}
                        >
                          {def.shortLabel}
                        </span>
                        <h2 className="font-semibold text-base">{def.label}</h2>
                      </div>
                      <span className="text-sm text-gray-500">
                        {sectionItems.length}件
                      </span>
                    </div>

                    {summary && summary.points.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <ul className="space-y-0.5">
                          {summary.points.slice(0, 3).map((point) => (
                            <li
                              key={point}
                              className="text-xs text-gray-600 flex gap-1.5"
                            >
                              <span className="text-gray-400 flex-shrink-0">
                                -
                              </span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="divide-y divide-gray-100">
                      {sectionItems.map((item) => {
                        const timeStr = formatTimeJST(
                          new Date(item.publishedAt)
                        );

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
