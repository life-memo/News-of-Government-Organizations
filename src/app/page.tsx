"use client";

import { useState, useEffect, useCallback } from "react";
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

interface CalendarDay {
  date: string;
  total: number;
  ministries: Record<string, number>;
}

interface CalendarData {
  year: number;
  month: number;
  days: CalendarDay[];
}

function getShortName(ministry: string): string {
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

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });
    if (selectedMinistries.length > 0) {
      params.set("ministry", selectedMinistries.join(","));
    }
    const res = await fetch(`/api/calendar?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [year, month, selectedMinistries]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const toggleMinistry = (ministry: string) => {
    setSelectedMinistries((prev) =>
      prev.includes(ministry)
        ? prev.filter((m) => m !== ministry)
        : [...prev, ministry]
    );
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  };

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const dayMap = new Map<string, CalendarDay>();
  if (data?.days) {
    for (const d of data.days) {
      dayMap.set(d.date, d);
    }
  }

  const cells: Array<{ day: number | null; date: string | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, date: dateStr });
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="キーワード検索..."
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              検索
            </button>
          </form>

          <div className="h-6 w-px bg-gray-300" />

          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            >
              &larr;
            </button>
            <span className="font-semibold text-sm min-w-[100px] text-center">
              {year}年{month}月
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            >
              &rarr;
            </button>
            <button
              onClick={goToday}
              className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors"
            >
              今日
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {MINISTRIES.map((m) => {
            const active =
              selectedMinistries.length === 0 ||
              selectedMinistries.includes(m.ministry);
            return (
              <button
                key={m.ministry}
                onClick={() => toggleMinistry(m.ministry)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  active
                    ? "text-white shadow-sm"
                    : "bg-gray-100 text-gray-400"
                }`}
                style={active ? { backgroundColor: m.color } : {}}
              >
                {getShortName(m.ministry)}
              </button>
            );
          })}
          {selectedMinistries.length > 0 && (
            <button
              onClick={() => setSelectedMinistries([])}
              className="px-2.5 py-1 rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              全表示
            </button>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {["日", "月", "火", "水", "木", "金", "土"].map((dow) => (
            <div
              key={dow}
              className="py-2 text-center text-xs font-medium text-gray-500 bg-gray-50"
            >
              {dow}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              if (cell.day === null) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50"
                  />
                );
              }

              const dayData = cell.date ? dayMap.get(cell.date) : null;
              const isToday = cell.date === todayStr;

              return (
                <Link
                  key={cell.date}
                  href={`/date/${cell.date}`}
                  className={`min-h-[100px] border-b border-r border-gray-100 p-1.5 hover:bg-blue-50 transition-colors block ${
                    isToday ? "bg-blue-50/50 ring-2 ring-blue-400 ring-inset" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span
                      className={`text-sm ${
                        isToday
                          ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          : "text-gray-700"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {dayData && dayData.total > 0 && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                        {dayData.total}
                      </span>
                    )}
                  </div>

                  {dayData && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {Object.entries(dayData.ministries).map(
                        ([ministry, count]) => (
                          <span
                            key={ministry}
                            className="text-white text-[10px] px-1 py-0.5 rounded leading-tight"
                            style={{
                              backgroundColor:
                                MINISTRY_COLOR_MAP[ministry] || "#6b7280",
                            }}
                            title={`${ministry}: ${count}件`}
                          >
                            {getShortName(ministry)}
                            {count > 1 && count}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
