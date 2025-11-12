import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/**
 * Filter types used across report components
 */
export interface ReportFilters {
  viewMode: "item" | "category";
  sortOrder: "top" | "bottom";
  itemType: "all" | "purchased" | "house-made";
  selectedCategory: string;
}

/**
 * Default filter values - sensible defaults for all reports
 */
const defaultFilters: ReportFilters = {
  viewMode: "item",
  sortOrder: "top",
  itemType: "all",
  selectedCategory: "all",
};

interface ReportFiltersContextType {
  filters: ReportFilters;
  updateFilter: <K extends keyof ReportFilters>(
    key: K,
    value: ReportFilters[K]
  ) => void;
  updateFilters: (filters: Partial<ReportFilters>) => void;
  resetFilters: () => void;
}

const ReportFiltersContext = createContext<
  ReportFiltersContextType | undefined
>(undefined);

/**
 * Provider component for report filters
 *
 * Manages filter state centrally and persists to sessionStorage.
 * This eliminates prop drilling and ensures consistent filter behavior
 * across all report components.
 *
 * Usage:
 *   Wrap your app/router with <ReportFiltersProvider>
 *   Then use the useReportFilters() hook in any component
 */
export const ReportFiltersProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from sessionStorage if available, otherwise use defaults
  const [filters, setFilters] = useState<ReportFilters>(() => {
    try {
      const saved = sessionStorage.getItem("cafeReportFilters");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle new filter keys
        return { ...defaultFilters, ...parsed };
      }
    } catch (e) {
      console.error("Error loading saved filters:", e);
    }
    return defaultFilters;
  });

  /**
   * Update a single filter value
   */
  const updateFilter = useCallback(
    <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
      setFilters((prev) => {
        const updated = { ...prev, [key]: value };

        // Persist to sessionStorage
        try {
          sessionStorage.setItem("cafeReportFilters", JSON.stringify(updated));
        } catch (e) {
          console.error("Error saving filters:", e);
        }

        return updated;
      });
    },
    []
  );

  /**
   * Update multiple filters at once
   */
  const updateFilters = useCallback((updates: Partial<ReportFilters>) => {
    setFilters((prev) => {
      const updated = { ...prev, ...updates };

      // Persist to sessionStorage
      try {
        sessionStorage.setItem("cafeReportFilters", JSON.stringify(updated));
      } catch (e) {
        console.error("Error saving filters:", e);
      }

      return updated;
    });
  }, []);

  /**
   * Reset all filters to defaults
   */
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);

    // Clear from sessionStorage
    try {
      sessionStorage.removeItem("cafeReportFilters");
    } catch (e) {
      console.error("Error clearing filters:", e);
    }
  }, []);

  return (
    <ReportFiltersContext.Provider
      value={{ filters, updateFilter, updateFilters, resetFilters }}
    >
      {children}
    </ReportFiltersContext.Provider>
  );
};

/**
 * Hook to access report filters
 *
 * Returns the current filter state and methods to update it.
 *
 * Example:
 *   const { filters, updateFilter } = useReportFilters();
 *   <button onClick={() => updateFilter('viewMode', 'category')}>
 *     View Categories
 *   </button>
 */
export const useReportFilters = () => {
  const context = useContext(ReportFiltersContext);
  if (!context) {
    throw new Error(
      "useReportFilters must be used within ReportFiltersProvider"
    );
  }
  return context;
};

/**
 * Optional: Hook with per-component overrides
 *
 * Some components may want to use the global filters but override
 * specific values. This hook allows that while still syncing updates
 * back to the global state.
 *
 * Example:
 *   // Use global filters, but force itemType to 'purchased'
 *   const { filters, updateFilter } = useReportFilters({
 *     itemType: 'purchased'
 *   });
 */
export const useReportFiltersWithOverrides = (
  overrides?: Partial<ReportFilters>
) => {
  const { filters: globalFilters, updateFilter, updateFilters, resetFilters } =
    useReportFilters();

  const filters = {
    ...globalFilters,
    ...overrides,
  };

  return { filters, updateFilter, updateFilters, resetFilters };
};