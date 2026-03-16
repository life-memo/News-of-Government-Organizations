"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MINISTRIES,
  labelToKey,
  getMinistry,
  type MinistryDef,
} from "@/config/ministries";
import { todayStringJST, extractTopics } from "@/lib/dateUtils";
import { useFilter } from "./FilterContext";
import { fetchItemsJson } from "@/lib/staticData";

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
}

const SUMMARY_LIMIT = 5;

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
  const [showAll, setShowAll] = useState(false);
  const { def, items } = group;
  const topics = extractTopics(items.map((i) => i.title));
  const displayItems = showAll ? items : items.slice(0, SUMMARY_LIMIT);
  const hasMore = items.length > SUMMARY_LIMIT;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        style={{ borderLeft: `4px solid ${def.color}` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-xs text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0"
              style={{ backgroundColor: def.color }}
            >
              {def.shortLabel}
            </span>
            <span className="font-semibold text-sm flex-shrink-0">{def.label}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{items.length}件</span>
            {!isOpen && topics.length > 0 && (
              <span className="text-xs text-gray-400 truncate hidden sm:block">
                — {topics.slice(0, 3).join("・")}
              </span>
            )}
          </div>
          <span
            className={`text-gray-400 text-xs transition-transform flex-shrink-0 ml-2 ${isOpen ? "rotate-180" : ""}`}
          >
            &#x25BC;
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {/* トピックサマリー */}
          {topics.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                主なトピック：{topics.join("・")}
              </p>
            </div>
          )}

          {/* 記事リスト（タイトルのみ・コンパクト） */}
          <ul className="divide-y divide-gray-100">
            {displayItems.map((item) => (
              <li key={item.id} className="px-4 py-2">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-800 hover:text-blue-600 transition-colors line-clamp-2 block"
                >
                  {item.title}
                  {item.updatedFlag && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1">
                      更新
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>

          {hasMore && !showAll && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
              className="w-full py-2 text-xs text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-100"
            >
              他{items.length - SUMMARY_LIMIT}件を表示
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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  const toggle = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = todayStringJST();

    try {
      const itemsData = await fetchItemsJson({
        date: today,
        limit: 200,
        ministry: selectedMinistries.length > 0 ? selectedMinistries.join(",") : undefined,
      });

      const byKey: Record<string, Item[]> = {};
      for (const item of itemsData.items || []) {
        const mk = labelToKey(item.ministry);
        if (!byKey[mk]) byKey[mk] = [];
        byKey[mk].push(item);
      }

      const result: MinistryGroup[] = MINISTRIES.filter(
        (m) => byKey[m.key] && byKey[m.key].length > 0,
      )
        .map((m) => ({
          ministryKey: m.key,
          def: m,
          items: byKey[m.key],
        }))
        .sort((a, b) => b.items.length - a.items.length);

      for (const [mk, items] of Object.entries(byKey)) {
        if (!result.some((g) => g.ministryKey === mk)) {
          result.push({ ministryKey: mk, def: getMinistry(mk), items });
        }
      }

      setGroups(result);

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
