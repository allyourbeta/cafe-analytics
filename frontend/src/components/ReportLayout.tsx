import { useState, useEffect } from 'react';

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (value: number | string) => string;
}

interface ReportLayoutProps {
  title: string;
  fetchData: (startDate?: string, endDate?: string) => Promise<{ data: Record<string, any>[] }>;
  columns: Column[];
  needsDateRange?: boolean;
}

export default function ReportLayout({
  title,
  fetchData,
  columns,
  needsDateRange = true
}: ReportLayoutProps) {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('2024-08-01');
  const [endDate, setEndDate] = useState('2024-10-23');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = needsDateRange
        ? await fetchData(startDate, endDate)
        : await fetchData();
      setData(response.data);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // Only run on mount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>

      {needsDateRange && (
        <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
          >
            Load
          </button>
        </form>
      )}

      {loading && <p className="text-gray-600">Loading...</p>}

      {error && <p className="text-red-600 bg-red-50 p-3 rounded">{error}</p>}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                {columns.map(col => (
                  <th
                    key={col.key}
                    className={`border border-gray-300 px-4 py-2 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
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
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={`border border-gray-300 px-4 py-2 ${
                        col.align === 'right' ? 'text-right' : 'text-left'
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