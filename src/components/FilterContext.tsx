"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface FilterState {
  selectedMinistries: string[];
  toggleMinistry: (ministry: string) => void;
  clearMinistries: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [selectedMinistries, setSelectedMinistries] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleMinistry = useCallback((ministry: string) => {
    setSelectedMinistries((prev) =>
      prev.includes(ministry)
        ? prev.filter((m) => m !== ministry)
        : [...prev, ministry]
    );
  }, []);

  const clearMinistries = useCallback(() => {
    setSelectedMinistries([]);
  }, []);

  return (
    <FilterContext.Provider
      value={{
        selectedMinistries,
        toggleMinistry,
        clearMinistries,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within FilterProvider");
  return ctx;
}
