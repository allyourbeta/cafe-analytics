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
}

export default function ReportLayout({
  title,
  fetchData,
  columns,
  needsDateRange = true,
  ChartComponent,
}: ReportLayoutProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get dates from global context
  const { startDate, endDate } = useDateRange();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = needsDateRange
        ? await fetchData(startDate, endDate)
        : await fetchData();
      setData(response.data);
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
      {/* Date range info removed - controlled by global date picker */}

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
                      {col.format ? col.format(row[col.key]) : row[col.key]}
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
