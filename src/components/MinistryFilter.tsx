"use client";

import { MINISTRIES } from "@/config/ministries";
import { useFilter } from "./FilterContext";

export default function MinistryFilter() {
  const { selectedMinistries, toggleMinistry, clearMinistries } = useFilter();

  return (
    <div className="flex flex-wrap gap-1.5">
      {MINISTRIES.map((m) => {
        const active =
          selectedMinistries.length === 0 ||
          selectedMinistries.includes(m.label);
        return (
          <button
            key={m.key}
            onClick={() => toggleMinistry(m.label)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
              active ? "text-white shadow-sm" : "bg-gray-100 text-gray-400"
            }`}
            style={active ? { backgroundColor: m.color } : {}}
          >
            {m.shortLabel}
          </button>
        );
      })}
      {selectedMinistries.length > 0 && (
        <button
          onClick={clearMinistries}
          className="px-2.5 py-1 rounded-full text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          全表示
        </button>
      )}
    </div>
  );
}
