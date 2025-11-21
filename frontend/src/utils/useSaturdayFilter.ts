import { useState } from "react";
import { GAME_DAY_DATES_2025, isSaturday } from "./gamedays";
import type { FilterValues } from "../components/FilterBar";

/**
 * Custom hook to manage Saturday game day filtering
 * Shared across Sales Per Hour, Labor Percent, and Item Heatmap reports
 */
export const useSaturdayFilter = (startDate: string, endDate: string) => {
  const [filters, setFilters] = useState<FilterValues>({
    saturdayFilter: "all",
  });

  /**
   * Calculate which dates to exclude based on the current filter selection
   * @returns Array of date strings in YYYY-MM-DD format to exclude from queries
   */
  const getExcludeDates = (): string[] => {
    if (filters.saturdayFilter === "gamedays") {
      // Only show game days - exclude all non-game Saturdays
      const start = new Date(startDate);
      const end = new Date(endDate);
      const excludeDates: string[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (isSaturday(dateStr) && !GAME_DAY_DATES_2025.includes(dateStr)) {
          excludeDates.push(dateStr);
        }
      }
      return excludeDates;
    } else if (filters.saturdayFilter === "non-game") {
      // Exclude game days
      return GAME_DAY_DATES_2025.filter(date => {
        return date >= startDate && date <= endDate;
      });
    }
    // "all" - no exclusions
    return [];
  };

  return {
    filters,
    setFilters,
    getExcludeDates,
  };
};