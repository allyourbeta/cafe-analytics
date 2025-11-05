import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: (value: number | string) => string;
}

interface ReportLayoutProps {
  title: string;
  fetchData: (
    startDate?: string,
    endDate?: string
  ) => Promise<{ data: Record<string, any>[] }>;
  columns: Column[];
  needsDateRange?: boolean;
  ChartComponent?: React.ComponentType<{ data: Record<string, any>[] }>;
  enableCache?: boolean; // New prop to enable caching
  cacheKey?: string; // Unique key for this report's cache
}

export default function ReportLayout({
  title,
  fetchData,
  columns,
  needsDateRange = true,
  ChartComponent,
  enableCache = false,
  cacheKey = "report_cache",
}: ReportLayoutProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        ? await fetchData(startDate, endDate)
        : await fetchData();
      setData(response.data);
      saveToCache(response.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Reload data when dates change
  useEffect(() => {
    loadData();
  }, [startDate, endDate]); // Refresh when global dates change

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

      {/* Chart - appears before table */}
      {!loading && !error && data.length > 0 && ChartComponent && (
        <div className="mb-6">
          <ChartComponent data={data} />
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
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-gray-300 px-4 py-2 ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.format ? col.format(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-sm text-gray-600">
            Total rows: {data.length}
          </div>
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-gray-500">No data for this period</p>
      )}
    </div>
  );
}