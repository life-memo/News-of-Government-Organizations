"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MINISTRIES, labelToKey, getMinistry } from "@/config/ministries";
import {
  formatDateDisplay,
  formatTimeJST,
  parseYMD,
} from "@/lib/dateUtils";

interface Item {
  id: string;
  ministry: string;
  source_name: string;
  title: string;
  url: string;
  published_at: string;
}

export default function DateDetailPage() {
  const params = useParams();
  const date = params?.date as string;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!date) return;

    const parsed = parseYMD(date);
    if (!parsed) {
      setError(true);
      setLoading(false);
      return;
    }

    fetch(`/api/items-json?date=${date}&limit=500`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [date]);

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-500 mt-4">読み込み中...</p>
      </div>
    );
  }

  if (error || !date) {
    return (
      <div className="text-center py-20 text-gray-500">
        無効な日付です。形式: YYYY-MM-DD
      </div>
    );
  }

  // Group by ministry
  const byKey: Record<string, { def: any; items: Item[] }> = {};
  for (const item of items) {
    const mk = labelToKey(item.ministry);
    if (!byKey[mk]) {
      byKey[mk] = { def: getMinistry(mk), items: [] };
    }
    byKey[mk].items.push(item);
  }

  const sections = Object.values(byKey).sort(
    (a, b) => b.items.length - a.items.length
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mb-3"
        >
          ← トップに戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {formatDateDisplay(date)}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {items.length}件の新着情報
        </p>
      </div>

      {items.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          この日の新着情報はありません
        </div>
      )}

      {/* Ministry sections */}
      <div className="space-y-6">
        {sections.map(({ def, items: ministryItems }) => (
          <div
            key={def.key}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden"
          >
            <div
              className="px-4 py-3 font-semibold text-sm flex items-center gap-2"
              style={{ borderLeft: `4px solid ${def.color}` }}
            >
              <span
                className="text-xs text-white px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: def.color }}
              >
                {def.shortLabel}
              </span>
              <span>{def.label}</span>
              <span className="text-xs text-gray-400">
                {ministryItems.length}件
              </span>
            </div>

            <ul className="divide-y divide-gray-100">
              {ministryItems.map((item) => (
                <li key={item.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 mt-0.5 min-w-[3rem]">
                      {item.published_at
                        ? formatTimeJST(new Date(item.published_at))
                        : "--:--"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline line-clamp-2"
                      >
                        {item.title}
                      </a>
                      <div className="text-xs text-gray-400 mt-1">
                        {item.source_name}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
