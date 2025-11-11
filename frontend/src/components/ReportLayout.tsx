import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import FilterBar, { type FilterValues } from "./FilterBar";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: (
    value: number | string,
    row: Record<string, any>
  ) => string | number;
}

interface ReportLayoutProps {
  title: string;
  fetchData: (
    startDate?: string,
    endDate?: string,
    filters?: FilterValues
  ) => Promise<{ data: Record<string, any>[] }>;
  columns: Column[];
  needsDateRange?: boolean;
  ChartComponent?: React.ComponentType<{
    data: Record<string, any>[];
    filters?: FilterValues;
  }>;
  enableCache?: boolean;
  cacheKey?: string;
  // Filter configuration
  enabledFilters?: Array<"itemType" | "sortOrder" | "viewMode" | "category">;
  showCategoryDropdown?: boolean;
  defaultFilters?: FilterValues;
}

export default function ReportLayout({
  title,
  fetchData,
  columns,
  needsDateRange = true,
  ChartComponent,
  enableCache = false,
  cacheKey = "report_cache",
  enabledFilters = [],
  showCategoryDropdown = false,
  defaultFilters = {},
}: ReportLayoutProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    itemType: "all",
    sortOrder: "top",
    viewMode: "item",
    selectedCategory: "all",
    ...defaultFilters,
  });

  // Get dates from global context
  const { startDate, endDate } = useDateRange();

  // Cache helper functions
  const CACHE_DATE_KEY = `${cacheKey}_date`;
  const CACHE_DATA_KEY = `${cacheKey}_data`;

  const isCacheValid = () => {
    if (!enableCache) return false;
    const cachedDate = localStorage.getItem(CACHE_DATE_KEY);
    if (!cachedDate) return false;
    const today = new Date().toDateString();
    return cachedDate === today;
  };

  const loadFromCache = () => {
    if (!isCacheValid()) return null;
    try {
      const cached = localStorage.getItem(CACHE_DATA_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  const saveToCache = (data: Record<string, any>[]) => {
    if (!enableCache) return;
    try {
      localStorage.setItem(CACHE_DATA_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_DATE_KEY, new Date().toDateString());
    } catch (e) {
      console.warn("Failed to cache data:", e);
    }
  };

  const loadData = async (force = false) => {
    // Try to load from cache first (if not forced refresh)
    if (!force && enableCache) {
      const cached = loadFromCache();
      if (cached && cached.length > 0) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const response = needsDateRange
        ? await fetchData(startDate, endDate, filters)
        : await fetchData(undefined, undefined, filters);
      setData(response.data);
      saveToCache(response.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reload data when dates or filters change
  useEffect(() => {
    loadData();
  }, [
    startDate,
    endDate,
    filters.itemType,
    filters.sortOrder,
    filters.viewMode,
    filters.selectedCategory,
  ]);

  // Apply filters to data for display
  const filteredData = data.filter((row) => {
    // Filter by category if in item mode
    if (
      filters.viewMode === "item" &&
      filters.selectedCategory &&
      filters.selectedCategory !== "all"
    ) {
      if (row.category !== filters.selectedCategory) return false;
    }
    return true;
  });

  // Sort data based on sortOrder
  const sortedData =
    filters.sortOrder === "top" ? filteredData : [...filteredData].reverse();

  return (
    <div className="p-6">
      {/* Header with title and optional refresh button */}
      {enableCache && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      )}

      {loading && <p className="text-gray-600">Loading...</p>}

      {error && <p className="text-red-600 bg-red-50 p-3 rounded">{error}</p>}

      {/* Chart with filters - appears before table */}
      {!loading && !error && data.length > 0 && ChartComponent && (
        <div className="mb-6">
          {/* Render FilterBar if filters are enabled */}
          {enabledFilters.length > 0 && (
            <div className="mb-4 p-4 bg-white rounded-lg">
              <FilterBar
                filters={filters}
                onFilterChange={setFilters}
                enabledFilters={enabledFilters}
                showCategoryDropdown={showCategoryDropdown}
              />
            </div>
          )}
          <ChartComponent data={filteredData} filters={filters} />
        </div>
      )}

      {!loading && !error && data.length > 0 && columns.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-gray-300 px-4 py-2 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-gray-300 px-4 py-2 ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.format
                        ? col.format(row[col.key], row)
                        : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-sm text-gray-600">
            Total rows: {filteredData.length}
          </div>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-500">No data for this period</p>
      )}
    </div>
  );
}
