import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getItemsByRevenue } from "../utils/api";
import { getCategoryColor } from "../utils/categoryColors";
import { formatCurrency, formatNumber } from "../utils/formatters";
import CategoryDropdown from "./CategoryDropdown";

const columns = [
  { key: "item_name", label: "Item", align: "left" as const },
  { key: "category", label: "Category", align: "left" as const },
  {
    key: "units_sold",
    label: "Units",
    align: "right" as const,
    format: (val: number) => formatNumber(val, 0),
  },
  {
    key: "revenue",
    label: "Revenue",
    align: "right" as const,
    format: (val: number) => formatCurrency(val, 0),
  },
];

// Simple CSS bar chart
const RevenueChart = ({
  data,
  sortOrder,
  setSortOrder,
  selectedCategory,
  setSelectedCategory
}: {
  data: Record<string, any>[],
  sortOrder: 'top' | 'bottom',
  setSortOrder: (order: 'top' | 'bottom') => void,
  selectedCategory: string,
  setSelectedCategory: (category: string) => void
}) => {
  // Get top 10 or bottom 10 based on sort order
  const displayData = sortOrder === 'top'
    ? data.slice(0, 10)
    : data.slice(-10).reverse();

  const maxRevenue = Math.max(...displayData.map((item) => item.revenue));

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title, toggle, and category dropdown all in one line */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
        gap: "16px",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
            Items by Revenue
          </h3>

          {/* Top/Bottom toggle */}
          <div style={{ display: "flex", gap: "4px", backgroundColor: "#F3F4F6", padding: "4px", borderRadius: "6px" }}>
            <button
              onClick={() => setSortOrder('top')}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: sortOrder === 'top' ? "#3B82F6" : "transparent",
                color: sortOrder === 'top' ? "#FFFFFF" : "#6B7280",
              }}
            >
              Top 10
            </button>
            <button
              onClick={() => setSortOrder('bottom')}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: sortOrder === 'bottom' ? "#3B82F6" : "transparent",
                color: sortOrder === 'bottom' ? "#FFFFFF" : "#6B7280",
              }}
            >
              Bottom 10
            </button>
          </div>
        </div>

        {/* Category dropdown */}
        <CategoryDropdown
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayData.map((item, index) => {
          const widthPercent = (item.revenue / maxRevenue) * 100;
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div
                style={{
                  width: "120px",
                  fontSize: "14px",
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.item_name}
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  borderRadius: "4px",
                  height: "32px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${widthPercent}%`,
                    height: "100%",
                    backgroundColor: getCategoryColor(item.category),
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "8px",
                    transition: "width 0.3s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "white",
                    }}
                  >
                    {formatCurrency(item.revenue, 0)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function ItemsByRevenue() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<'top' | 'bottom'>('top');

  const { startDate, endDate } = useDateRange();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getItemsByRevenue(startDate, endDate);
      setData(response.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  // Filter data by selected category
  const filteredData = selectedCategory === "all"
    ? data
    : data.filter(item => item.category === selectedCategory);

  // Sort data based on sortOrder (reverse for bottom 10 in table)
  const sortedData = sortOrder === 'top'
    ? filteredData
    : [...filteredData].reverse();

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>;
  }

  if (data.length === 0) {
    return <div className="p-6 text-gray-500">No data for this period</div>;
  }

  return (
    <div>
      {/* Chart with inline controls */}
      <RevenueChart
        data={filteredData}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      {/* Data table */}
      <div className="mt-6 overflow-x-auto">
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
                    {col.format ? col.format(row[col.key]) : row[col.key]}
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
    </div>
  );
}