"use client";

import { useState, useEffect, useCallback } from "react";
import ministriesData from "@/config/ministries.json";
import { todayStringJST, getShortName, formatTimeJST } from "@/lib/dateUtils";
import { useFilter } from "./FilterContext";

interface MinistryConfig {
  ministry: string;
  color: string;
}

const MINISTRIES: MinistryConfig[] = ministriesData as MinistryConfig[];
const MINISTRY_COLOR_MAP: Record<string, string> = Object.fromEntries(
  MINISTRIES.map((m) => [m.ministry, m.color])
);

interface Item {
  id: string;
  ministry: string;
  sourceName: string;
  title: string;
  url: string;
  publishedAt: string;
  updatedFlag: boolean;
}

interface MinistryGroup {
  ministry: string;
  items: Item[];
  summary: { points: string[] };
}

const ITEMS_PER_PAGE = 5;

function AccordionSection({
  group,
  defaultOpen,
}: {
  group: MinistryGroup;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE);
  const color = MINISTRY_COLOR_MAP[group.ministry] || "#6b7280";
  const displayItems = group.items.slice(0, showCount);
  const hasMore = group.items.length > showCount;
  const displayPoints = (group.summary?.points || []).slice(0, 3);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-white px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: color }}
          >
            {getShortName(group.ministry)}
          </span>
          <span className="font-semibold text-sm">{group.ministry}</span>
          <span className="text-xs text-gray-400">{group.items.length}件</span>
        </div>
        <span
          className={`text-gray-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          &#x25BC;
        </span>
      </button>

      <div className={`accordion-content ${isOpen ? "open" : ""}`}>
        <div>
          {displayPoints.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <ul className="space-y-0.5">
                {displayPoints.map((point, i) => (
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

          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {displayItems.map((item) => {
              const timeStr = formatTimeJST(new Date(item.publishedAt));
              return (
                <div key={item.id} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-0.5 flex-shrink-0 font-mono w-10">
                      {timeStr}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-900 hover:text-blue-600 transition-colors line-clamp-2"
                      >
                        {item.title}
                        <span className="inline-block ml-1 text-gray-300 text-xs">
                          &#x2197;
                        </span>
                      </a>
                      {item.updatedFlag && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1">
                          更新
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setShowCount((c) => c + ITEMS_PER_PAGE)}
              className="w-full py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
            >
              さらに{Math.min(ITEMS_PER_PAGE, group.items.length - showCount)}
              件を表示
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MinistryHighlights() {
  const { selectedMinistries } = useFilter();
  const [groups, setGroups] = useState<MinistryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayStringJST();
    const params = new URLSearchParams({ date: today, limit: "200" });
    if (selectedMinistries.length > 0) {
      params.set("ministry", selectedMinistries.join(","));
    }

    try {
      const [itemsRes, summaryRes] = await Promise.all([
        fetch(`/api/items?${params}`),
        fetch(`/api/summary?date=${today}`),
      ]);
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const summaryData = summaryRes.ok ? await summaryRes.json() : {};

      const byMinistry: Record<string, Item[]> = {};
      for (const item of itemsData.items || []) {
        if (!byMinistry[item.ministry]) byMinistry[item.ministry] = [];
        byMinistry[item.ministry].push(item);
      }

      const ministrySummaries: Record<string, { points: string[] }> =
        summaryData.ministrySummaries || {};

      const result: MinistryGroup[] = Object.entries(byMinistry)
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([ministry, items]) => ({
          ministry,
          items,
          summary: ministrySummaries[ministry] || { points: [] },
        }));

      setGroups(result);
    } catch (e) {
      console.error("Failed to fetch ministry highlights:", e);
    }
    setLoading(false);
  }, [selectedMinistries]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400 text-sm mb-6">
        本日の新着情報はまだありません
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-6">
      <h2 className="text-sm font-semibold text-gray-600 px-1">
        本日の省庁別ハイライト
      </h2>
      {groups.map((group) => (
        <AccordionSection
          key={group.ministry}
          group={group}
          defaultOpen={true}
        />
      ))}
    </div>
  );
}
