import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getItemsByProfit } from "../utils/api";
import {
  getCategoryColor,
  getCategoryDisplayName,
} from "../utils/categoryColors";
import {
  formatCurrency,
  formatNumber,
  aggregateByCategory,
} from "../utils/formatters";
import CategoryDropdown from "./CategoryDropdown";
import FilterBar, { type FilterValues } from "./FilterBar";

const columns = [
  {
    key: "item_name",
    label: "Item",
    align: "left" as const,
    format: (val: string | number, row?: any) =>
      row?.item_id ? `${row.item_id} - ${val}` : val,
  },
  { key: "category", label: "Category", align: "left" as const },
  {
    key: "units_sold",
    label: "Units",
    align: "right" as const,
    format: (val: number | string, _row?: any) =>
      formatNumber(val as number, 0),
  },
  {
    key: "total_profit",
    label: "Total Profit",
    align: "right" as const,
    format: (val: number | string, _row?: any) =>
      formatCurrency(val as number, 0),
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right" as const,
    format: (val: number | string, _row?: any) => `${Number(val).toFixed(1)}%`,
  },
];

// Horizontal bar chart by category
const ProfitChart = ({
  data,
  filters,
  onFilterChange,
}: {
  data: Record<string, any>[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}) => {
  // In category mode, show all categories (no top/bottom split)
  // In item mode, show top 10 or bottom 10
  const displayData =
    filters.viewMode === "category"
      ? data // Show all categories
      : filters.sortOrder === "top"
      ? data.slice(0, 10)
      : data.slice(-10).reverse();

  const maxProfit = Math.max(...displayData.map((item) => item.total_profit));

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title, view mode toggle, top/bottom toggle, and category dropdown */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
            Items by Profit $$
          </h3>
          <FilterBar
            filters={filters}
            onFilterChange={onFilterChange}
            enabledFilters={
              filters.viewMode === "item"
                ? ["viewMode", "itemType", "sortOrder"]
                : ["viewMode"]
            }
          />
        </div>

        {/* Category dropdown - only enabled in item mode */}
        <div style={{ opacity: filters.viewMode === "category" ? 0.5 : 1 }}>
          <CategoryDropdown
            value={filters.selectedCategory || "all"}
            onChange={(cat) =>
              onFilterChange({ ...filters, selectedCategory: cat })
            }
            disabled={filters.viewMode === "category"}
          />
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayData.map((item, index) => {
          const widthPercent = (item.total_profit / maxProfit) * 100;
          const displayName =
            filters.viewMode === "category"
              ? getCategoryDisplayName(item.category)
              : item.item_name;
          const barColor =
            filters.viewMode === "category"
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
                    {formatCurrency(item.total_profit, 0)}
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

export default function ItemsByProfit() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    itemType: "all",
    sortOrder: "top",
    viewMode: "item",
    selectedCategory: "all",
  });

  const { startDate, endDate } = useDateRange();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch item data only
      const itemResponse = await getItemsByProfit(
        startDate,
        endDate,
        filters.itemType || "all"
      );
      setData(itemResponse.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, filters.itemType]);

  // Aggregate by category if in category mode, otherwise filter by selected category
  const filteredData =
    filters.viewMode === "category"
      ? aggregateByCategory(data) // Client-side aggregation
      : filters.selectedCategory === "all"
      ? data
      : data.filter((item) => item.category === filters.selectedCategory);

  // Sort data based on sortOrder (reverse for bottom 10 in table)
  const sortedData =
    filters.sortOrder === "top" ? filteredData : [...filteredData].reverse();

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  if (data.length === 0) {
    return <div className="p-6 text-gray-500">No data for this period</div>;
  }

  return (
    <div>
      {/* Chart with inline controls */}
      <ProfitChart
        data={filteredData}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Data table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {filters.viewMode === "category" ? (
                <>
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    Category
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    Units
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    Total Profit
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    Margin %
                  </th>
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
                {filters.viewMode === "category" ? (
                  <>
                    <td className="border border-gray-300 px-4 py-2 text-left">
                      {getCategoryDisplayName(row.category)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {formatNumber(row.units_sold, 0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {formatCurrency(row.total_profit, 0)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {`${Number(row.margin_pct).toFixed(1)}%`}
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
                      {col.format
                        ? col.format(row[col.key], row)
                        : row[col.key]}
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
