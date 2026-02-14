"use client";

import { FilterProvider, useFilter } from "@/components/FilterContext";
import MinistryFilter from "@/components/MinistryFilter";
import SummaryHero from "@/components/SummaryHero";
import MinistryHighlights from "@/components/MinistryHighlights";
import Calendar from "@/components/Calendar";
import { useRouter } from "next/navigation";

function SearchBar() {
  const { searchQuery, setSearchQuery } = useFilter();
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
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
  );
}

function DashboardContent() {
  return (
    <div>
      {/* Summary Hero: today's overview */}
      <SummaryHero />

      {/* Filters bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <SearchBar />
        </div>
        <MinistryFilter />
      </div>

      {/* Ministry Highlights: accordion per ministry */}
      <MinistryHighlights />

      {/* Calendar with DayPanel */}
      <Calendar />
    </div>
  );
}

export default function HomePage() {
  return (
    <FilterProvider>
      <DashboardContent />
    </FilterProvider>
  );
}
