"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ActiveFilter } from "@/types/dimensions";
import { filtersToParams } from "@/types/dimensions";

interface FilterContextValue {
  filters: ActiveFilter[];
  /** Query parameters to pass to the API, or undefined when nothing is filtered. */
  params: string[] | undefined;
  addFilter: (filter: ActiveFilter) => void;
  removeFilter: (index: number) => void;
  clearFilters: () => void;
}

const FilterContext = createContext<FilterContextValue | null>(null);

/**
 * Holds the dimension filters that narrow every chart on the dashboard.
 *
 * Filters live in one place so that switching between Overview, Funnels and
 * Breakdown keeps the same segment in view — the point of a filter is comparing
 * one segment across views, not re-picking it on each page.
 */
export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  const addFilter = useCallback((filter: ActiveFilter) => {
    setFilters((current) => {
      // One value per dimension: picking a new one replaces the old.
      const without = current.filter((f) => f.key !== filter.key);
      return [...without, filter];
    });
  }, []);

  const removeFilter = useCallback((index: number) => {
    setFilters((current) => current.filter((_, i) => i !== index));
  }, []);

  const clearFilters = useCallback(() => setFilters([]), []);

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      params: filters.length > 0 ? filtersToParams(filters) : undefined,
      addFilter,
      removeFilter,
      clearFilters,
    }),
    [filters, addFilter, removeFilter, clearFilters],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

/**
 * Returns the active dimension filters. Safe to call outside a FilterProvider,
 * in which case nothing is filtered.
 */
export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (context) return context;

  return {
    filters: [],
    params: undefined,
    addFilter: () => {},
    removeFilter: () => {},
    clearFilters: () => {},
  };
}
