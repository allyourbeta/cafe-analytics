import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getItemsByRevenue, getCategoriesByRevenue } from "../utils/api";
import { getCategoryColor, getCategoryDisplayName } from "../utils/categoryColors";
import { formatCurrency, formatNumber } from "../utils/formatters";
import CategoryDropdown from "./CategoryDropdown";

const columns = [
  {
    key: "item_name",
    label: "Item",
    align: "left" as const,
    format: (val: string, row: any) => row.item_id ? `${row.item_id} - ${val}` : val
  },
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
  setSelectedCategory,
  viewMode,
  setViewMode
}: {
  data: Record<string, any>[],
  sortOrder: 'top' | 'bottom',
  setSortOrder: (order: 'top' | 'bottom') => void,
  selectedCategory: string,
  setSelectedCategory: (category: string) => void,
  viewMode: 'item' | 'category',
  setViewMode: (mode: 'item' | 'category') => void
}) => {
  // In category mode, show all categories (no top/bottom split)
  // In item mode, show top 10 or bottom 10
  const displayData = viewMode === 'category'
    ? data  // Show all categories
    : sortOrder === 'top'
    ? data.slice(0, 10)
    : data.slice(-10).reverse();

  const maxRevenue = Math.max(...displayData.map((item) => item.revenue));

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title, view mode toggle, top/bottom toggle, and category dropdown */}
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

          {/* View Mode Toggle (By Item / By Category) */}
          <div style={{ display: "flex", gap: "4px", backgroundColor: "#F3F4F6", padding: "4px", borderRadius: "6px" }}>
            <button
              onClick={() => setViewMode('item')}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: viewMode === 'item' ? "#10B981" : "transparent",
                color: viewMode === 'item' ? "#FFFFFF" : "#6B7280",
              }}
            >
              By Item
            </button>
            <button
              onClick={() => setViewMode('category')}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: viewMode === 'category' ? "#10B981" : "transparent",
                color: viewMode === 'category' ? "#FFFFFF" : "#6B7280",
              }}
            >
              By Category
            </button>
          </div>

          {/* Top/Bottom toggle - only show in item mode */}
          {viewMode === 'item' && (
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
          )}
        </div>

        {/* Category dropdown - only enabled in item mode */}
        <div style={{ opacity: viewMode === 'category' ? 0.5 : 1 }}>
          <CategoryDropdown
            value={selectedCategory}
            onChange={setSelectedCategory}
            disabled={viewMode === 'category'}
          />
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayData.map((item, index) => {
          const widthPercent = (item.revenue / maxRevenue) * 100;
          const displayName = viewMode === 'category'
            ? getCategoryDisplayName(item.category)
            : item.item_name;
          const barColor = viewMode === 'category'
            ? getCategoryColor(item.category)
            : getCategoryColor(item.category);

          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div
                style={{
                  width: "160px",
                  fontSize: "14px",
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
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
                    backgroundColor: barColor,
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
  const [categoryData, setCategoryData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<'top' | 'bottom'>('top');
  const [viewMode, setViewMode] = useState<'item' | 'category'>('item');

  const { startDate, endDate } = useDateRange();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both item and category data
      const [itemResponse, categoryResponse] = await Promise.all([
        getItemsByRevenue(startDate, endDate),
        getCategoriesByRevenue(startDate, endDate)
      ]);
      setData(itemResponse.data);
      setCategoryData(categoryResponse.data);
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

  // Select the appropriate data based on view mode
  const currentData = viewMode === 'category' ? categoryData : data;

  // Filter data by selected category (only in item mode)
  const filteredData = viewMode === 'category'
    ? categoryData  // Show all categories
    : selectedCategory === "all"
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
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Data table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {viewMode === 'category' ? (
                <>
                  <th className="border border-gray-300 px-4 py-2 text-left">Category</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Units</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Revenue</th>
                </>
              ) : (
                columns.map((col) => (
                  <th
                    key={col.key}
                    className={`border border-gray-300 px-4 py-2 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {viewMode === 'category' ? (
                  <>
                    <td className="border border-gray-300 px-4 py-2 text-left">
                      {getCategoryDisplayName(row.category)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {formatNumber(row.units_sold, 0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {formatCurrency(row.revenue, 0)}
                    </td>
                  </>
                ) : (
                  columns.map((col) => (
                    <td
                      key={col.key}
                      className={`border border-gray-300 px-4 py-2 ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {col.format ? col.format(row[col.key], row) : row[col.key]}
                    </td>
                  ))
                )}
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