"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDateDisplay, formatTimeJST } from "@/lib/dateUtils";
import { labelToKey, getMinistryByLabel, type MinistryDef } from "@/config/ministries";

interface Item {
  id: string;
  ministry: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string;
  summaryRaw: string | null;
  updatedFlag: boolean;
}

interface DaySummary {
  points: string[];
}

interface DayPanelProps {
  date: string | null;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 5;

export default function DayPanel({ date, onClose }: DayPanelProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCount, setShowCount] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setShowCount({});

    Promise.all([
      fetch(`/api/items?date=${date}&limit=200`).then((r) =>
        r.ok ? r.json() : { items: [] }
      ),
      fetch(`/api/daily-summary?date=${date}`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([itemsData, summaryData]) => {
        setItems(itemsData?.items || []);
        setSummary(summaryData?.points ? summaryData : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  if (!date) return null;

  const isOpen = !!date;

  // Group by ministryKey
  const byKey: Record<string, { def: MinistryDef; items: Item[] }> = {};
  for (const item of items) {
    const mk = labelToKey(item.ministry);
    if (!byKey[mk]) byKey[mk] = { def: getMinistryByLabel(item.ministry), items: [] };
    byKey[mk].items.push(item);
  }

  const sections = Object.values(byKey).sort(
    (a, b) => b.items.length - a.items.length
  );

  const getVisible = (key: string) =>
    showCount[key] || ITEMS_PER_PAGE;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`day-panel-overlay ${isOpen ? "open" : ""} md:hidden`}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`day-panel ${isOpen ? "open" : ""} bg-white rounded-lg border border-gray-200`}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-sm">{formatDateDisplay(date)}</h3>
            <p className="text-xs text-gray-400">
              {items.length}件 / {sections.length}省庁
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/date/${date}`}
              className="text-xs text-blue-600 hover:text-blue-800"
              title="詳細ページ"
            >
              &#x2197; 詳細
            </Link>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              &#x2715;
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            この日の新着情報はありません
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Summary */}
            {summary && summary.points && summary.points.length > 0 && (
              <div className="px-4 py-3 bg-blue-50">
                <ul className="space-y-1">
                  {summary.points.slice(0, 3).map((point, i) => (
                    <li
                      key={i}
                      className="text-xs text-blue-800 flex gap-1.5"
                    >
                      <span className="text-blue-400 flex-shrink-0">
                        &#x25B8;
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ministry sections */}
            {sections.map((section) => {
              const { def, items: sItems } = section;
              const visible = getVisible(def.key);
              const displayItems = sItems.slice(0, visible);
              const hasMore = sItems.length > visible;

              return (
                <div key={def.key}>
                  <div
                    className="px-4 py-2 flex items-center gap-2 bg-gray-50"
                    style={{ borderLeft: `3px solid ${def.color}` }}
                  >
                    <span
                      className="text-[10px] text-white px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: def.color }}
                    >
                      {def.shortLabel}
                    </span>
                    <span className="text-xs font-medium text-gray-700">
                      {def.label}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {sItems.length}件
                    </span>
                  </div>

                  {displayItems.map((item) => {
                    const timeStr = formatTimeJST(new Date(item.publishedAt));
                    return (
                      <div key={item.id} className="px-4 py-2">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] text-gray-400 mt-1 flex-shrink-0 font-mono">
                            {timeStr}
                          </span>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-800 hover:text-blue-600 transition-colors line-clamp-2 flex-1"
                          >
                            {item.title}
                            {item.updatedFlag && (
                              <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1">
                                更新
                              </span>
                            )}
                          </a>
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && (
                    <button
                      onClick={() =>
                        setShowCount((prev) => ({
                          ...prev,
                          [def.key]: (prev[def.key] || ITEMS_PER_PAGE) + ITEMS_PER_PAGE,
                        }))
                      }
                      className="w-full py-1.5 text-[10px] text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      +{Math.min(ITEMS_PER_PAGE, sItems.length - visible)}
                      件を表示
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
