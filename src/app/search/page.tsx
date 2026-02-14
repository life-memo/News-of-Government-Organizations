"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ministriesData from "@/config/ministries.json";

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
  summaryRaw: string | null;
  updatedFlag: boolean;
}

interface SearchResult {
  items: Item[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") || "";
  const initialMinistry = searchParams.get("ministry") || "";
  const initialSort = searchParams.get("sort") || "desc";

  const [query, setQuery] = useState(initialQ);
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>(
    initialMinistry ? initialMinistry.split(",") : []
  );
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(
    async (p: number = 1) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (selectedMinistries.length > 0)
        params.set("ministry", selectedMinistries.join(","));
      params.set("sort", sort);
      params.set("page", p.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/items?${params}`);
      const json = await res.json();
      setResult(json);
      setPage(p);
      setLoading(false);

      const urlParams = new URLSearchParams();
      if (query.trim()) urlParams.set("q", query.trim());
      if (selectedMinistries.length > 0)
        urlParams.set("ministry", selectedMinistries.join(","));
      if (sort !== "desc") urlParams.set("sort", sort);
      router.replace(`/search?${urlParams}`, { scroll: false });
    },
    [query, selectedMinistries, sort, router]
  );

  useEffect(() => {
    doSearch(1);
  }, [doSearch]);

  const toggleMinistry = (ministry: string) => {
    setSelectedMinistries((prev) =>
      prev.includes(ministry)
        ? prev.filter((m) => m !== ministry)
        : [...prev, ministry]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(1);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">検索</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="キーワードを入力..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            検索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">省庁:</span>
          {MINISTRIES.map((m) => {
            const active =
              selectedMinistries.length === 0 ||
              selectedMinistries.includes(m.ministry);
            return (
              <button
                key={m.ministry}
                onClick={() => toggleMinistry(m.ministry)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                  active ? "text-white" : "bg-gray-100 text-gray-400"
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
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              全表示
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">並び替え:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-xs"
            >
              <option value="desc">新しい順</option>
              <option value="asc">古い順</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          検索中...
        </div>
      ) : result ? (
        <>
          <div className="text-sm text-gray-500 mb-3">
            {result.total}件の結果
            {result.totalPages > 1 && `（ページ ${page}/${result.totalPages}）`}
          </div>

          {result.items.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
              該当する新着情報が見つかりませんでした
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {result.items.map((item) => {
                const dt = new Date(item.publishedAt);
                const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                const timeStr = `${String(dt.getUTCHours()).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
                const color = MINISTRY_COLOR_MAP[item.ministry] || "#6b7280";

                return (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <span
                          className="text-[10px] text-white px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: color }}
                        >
                          {getShortName(item.ministry)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
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
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                          <a
                            href={`/date/${dateStr}`}
                            className="hover:text-blue-600"
                          >
                            {dateStr}
                          </a>
                          <span>{timeStr}</span>
                          <span>{item.sourceName}</span>
                          {item.updatedFlag && (
                            <span className="bg-yellow-100 text-yellow-700 px-1 rounded">
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
          )}

          {result.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => doSearch(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                前へ
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-500">
                {page} / {result.totalPages}
              </span>
              <button
                onClick={() => doSearch(page + 1)}
                disabled={page >= result.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >
                次へ
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={<div className="text-center py-12 text-gray-400">読み込み中...</div>}
    >
      <SearchContent />
    </Suspense>
  );
}
