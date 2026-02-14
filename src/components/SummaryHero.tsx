"use client";

import { useState, useEffect } from "react";
import { todayStringJST, formatDateDisplay } from "@/lib/dateUtils";

interface SummaryData {
  date: string;
  totalItems: number;
  ministryCount: number;
  points: string[];
  topics: string[];
}

export default function SummaryHero() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = todayStringJST();
    fetch(`/api/summary?date=${today}`)
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6 animate-pulse">
        <div className="h-6 bg-blue-500 rounded w-48 mb-3" />
        <div className="h-4 bg-blue-500 rounded w-32 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-blue-500 rounded w-full" />
          <div className="h-3 bg-blue-500 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const displayPoints = data.points.slice(0, 3);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold">{formatDateDisplay(data.date)}</h2>
          <p className="text-blue-100 text-sm mt-0.5">本日の概況</p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-2xl font-bold">{data.totalItems}</div>
            <div className="text-blue-200 text-xs">件</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.ministryCount}</div>
            <div className="text-blue-200 text-xs">省庁</div>
          </div>
        </div>
      </div>

      {displayPoints.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {displayPoints.map((point, i) => (
            <li key={i} className="text-sm text-blue-50 flex gap-2">
              <span className="text-blue-300 flex-shrink-0">&#x25B8;</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      )}

      {data.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-blue-500">
          {data.topics.map((topic) => (
            <span
              key={topic}
              className="bg-blue-500/50 text-blue-50 text-xs px-2 py-0.5 rounded-full"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
