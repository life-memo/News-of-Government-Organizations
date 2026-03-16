"use client";

import { useState, useEffect, useCallback } from "react";
import { getMinistryByLabel } from "@/config/ministries";
import { currentYearMonthJST, todayStringJST } from "@/lib/dateUtils";
import { useFilter } from "./FilterContext";
import DayPanel from "./DayPanel";
import { fetchCalendarJson } from "@/lib/staticData";

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

export default function Calendar() {
  const { selectedMinistries } = useFilter();
  const { year: initYear, month: initMonth } = currentYearMonthJST();
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    });
    if (selectedMinistries.length > 0) {
      params.set("ministry", selectedMinistries.join(","));
    }
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      {
        const calendarData = await fetchCalendarJson(monthStr);
        
        // 日付ごとのデータを変換
        const days: CalendarDay[] = [];
        for (const [dateKey, dayData] of Object.entries(calendarData)) {
          if (typeof dayData === 'object' && dayData !== null && 'count' in dayData) {
            const ministries: Record<string, number> = {};
            for (const ministry of (dayData as any).ministries) {
              ministries[ministry] = 1;
            }
            days.push({
              date: dateKey,
              total: (dayData as any).count,
              ministries
            });
          }
        }
        
        setData({ year, month, days });
      }
    } catch (e) {
      console.error("Failed to fetch calendar:", e);
    }
    setLoading(false);
  }, [year, month, selectedMinistries]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const goToday = () => {
    const { year: y, month: m } = currentYearMonthJST();
    setYear(y);
    setMonth(m);
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
  const startDow = firstDay.getDay();
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

  const todayStr = todayStringJST();

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-600 px-1">
          カレンダー
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm"
          >
            &larr;
          </button>
          <span className="font-semibold text-sm min-w-[100px] text-center">
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors text-sm"
          >
            &rarr;
          </button>
          <button
            onClick={goToday}
            className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs hover:bg-gray-200 transition-colors"
          >
            今日
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
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
                        className="min-h-[90px] border-b border-r border-gray-100 bg-gray-50/50"
                      />
                    );
                  }

                  const dayData = cell.date ? dayMap.get(cell.date) : null;
                  const isToday = cell.date === todayStr;
                  const isSelected = cell.date === selectedDate;

                  return (
                    <button
                      key={cell.date}
                      onClick={() =>
                        setSelectedDate(
                          selectedDate === cell.date ? null : cell.date
                        )
                      }
                      className={`min-h-[90px] border-b border-r border-gray-100 p-1.5 hover:bg-blue-50 transition-colors text-left ${
                        isToday
                          ? "bg-blue-50/50 ring-2 ring-blue-400 ring-inset"
                          : ""
                      } ${isSelected ? "bg-blue-100/60 ring-2 ring-blue-500 ring-inset" : ""}`}
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
                            ([ministry, count]) => {
                              const def = getMinistryByLabel(ministry);
                              return (
                                <span
                                  key={def.key}
                                  className="text-white text-[10px] px-1 py-0.5 rounded leading-tight"
                                  style={{
                                    backgroundColor: def.color,
                                  }}
                                  title={`${def.label}: ${count}件`}
                                >
                                  {def.shortLabel}
                                  {(count as number) > 1 && count}
                                </span>
                              );
                            }
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Day Panel - desktop: side panel */}
        {selectedDate && (
          <div className="hidden md:block w-[400px] flex-shrink-0">
            <DayPanel
              date={selectedDate}
              onClose={() => setSelectedDate(null)}
            />
          </div>
        )}
      </div>

      {/* Day Panel - mobile: slide-in */}
      <div className="md:hidden">
        <DayPanel
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      </div>
    </div>
  );
}
