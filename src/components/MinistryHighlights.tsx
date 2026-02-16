"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MINISTRIES,
  labelToKey,
  getMinistry,
  type MinistryDef,
} from "@/config/ministries";
import { todayStringJST, formatTimeJST } from "@/lib/dateUtils";
import { useFilter } from "./FilterContext";

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
  ministryKey: string;
  def: MinistryDef;
  items: Item[];
  summaryPoints: string[];
}

const ITEMS_PER_PAGE = 5;

/* ─── アコーディオンセクション ─── */

function AccordionSection({
  group,
  isOpen,
  onToggle,
}: {
  group: MinistryGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE);
  const { def, items, summaryPoints } = group;
  const displayItems = items.slice(0, showCount);
  const hasMore = items.length > showCount;
  const displayPoints = summaryPoints.slice(0, 3);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        style={{ borderLeft: `4px solid ${def.color}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-white px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: def.color }}
          >
            {def.shortLabel}
          </span>
          <span className="font-semibold text-sm">{def.label}</span>
          <span className="text-xs text-gray-400">{items.length}件</span>
        </div>
        <span
          className={`text-gray-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          &#x25BC;
        </span>
      </button>

      {isOpen && (
        <div>
          {displayPoints.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
              <ul className="space-y-0.5">
                {displayPoints.map((point) => (
                  <li
                    key={point}
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
              const timeStr = item.publishedAt ? formatTimeJST(new Date(item.publishedAt)) : "--:--";
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
              さらに{Math.min(ITEMS_PER_PAGE, items.length - showCount)}
              件を表示
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── メインコンポーネント ─── */

export default function MinistryHighlights() {
  const { selectedMinistries } = useFilter();
  const [groups, setGroups] = useState<MinistryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // ministryKey → boolean（今日の表示では初期値を全て true に設定）
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  const toggle = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayStringJST();
    const params = new URLSearchParams({ date: today, limit: "200" });
    if (selectedMinistries.length > 0) {
      params.set("ministry", selectedMinistries.join(","));
    }

    try {
      const itemsRes = await fetch(`/api/items-json?${params}`);
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const summaryData: { ministrySummaries?: Record<string, { points: string[] }> } = {};

      // 1. items を ministryKey でグルーピング
      const byKey: Record<string, Item[]> = {};
      for (const item of itemsData.items || []) {
        const mk = labelToKey(item.ministry);
        if (!byKey[mk]) byKey[mk] = [];
        byKey[mk].push(item);
      }

      // 2. ministrySummaries (API は label キー) → key で引く
      const ministrySummaries: Record<string, { points: string[] }> =
        summaryData.ministrySummaries || {};

      // 3. MINISTRIES 定義順に、データがあるものだけ結果に含める
      //    （件数降順でソートも維持）
      const result: MinistryGroup[] = MINISTRIES.filter(
        (m) => byKey[m.key] && byKey[m.key].length > 0,
      )
        .map((m) => ({
          ministryKey: m.key,
          def: m,
          items: byKey[m.key],
          summaryPoints:
            ministrySummaries[m.label]?.points || [],
        }))
        .sort((a, b) => b.items.length - a.items.length);

      // 未登録省庁がDBにあった場合もフォールバックで追加
      for (const [mk, items] of Object.entries(byKey)) {
        if (!result.some((g) => g.ministryKey === mk)) {
          const def = getMinistry(mk);
          result.push({
            ministryKey: mk,
            def,
            items,
            summaryPoints:
              ministrySummaries[def.label]?.points || [],
          });
        }
      }

      setGroups(result);

      // 初回ロード時は全てのセクションを開いた状態にする（今日の表示のみ）
      if (!isInitialized) {
        const initialOpen: Record<string, boolean> = {};
        for (const g of result) {
          initialOpen[g.ministryKey] = true;
        }
        setOpenSections(initialOpen);
        setIsInitialized(true);
      }
    } catch (e) {
      console.error("Failed to fetch ministry highlights:", e);
    }
    setLoading(false);
  }, [selectedMinistries, isInitialized]);

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
          key={group.ministryKey}
          group={group}
          isOpen={!!openSections[group.ministryKey]}
          onToggle={() => toggle(group.ministryKey)}
        />
      ))}
    </div>
  );
}
