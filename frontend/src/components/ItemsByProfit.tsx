import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { useReportFilters, TOP_N_COUNT } from "../context/ReportFiltersContext";
import { getItemsByProfit } from "../utils/api";
import { getCategoryDisplayName } from "../utils/categoryColors";
import {
  formatCurrency,
  formatNumber,
  aggregateByCategory,
} from "../utils/formatters";
import FilterBar from "./FilterBar";
import HorizontalBarChart, { toBarChartItems } from "./HorizontalBarChart";
import DataTable, { type Column } from "./DataTable";

const itemColumns: Column[] = [
  {
    key: "item_name",
    label: "Item",
    align: "left",
    format: (val, row) => (row?.item_id ? `${row.item_id} - ${val}` : val),
  },
  { key: "category", label: "Category", align: "left" },
  {
    key: "units_sold",
    label: "Units",
    align: "right",
    format: (val) => formatNumber(val as number, 0),
  },
  {
    key: "total_profit",
    label: "Total Profit",
    align: "right",
    format: (val) => formatCurrency(val as number, 0),
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right",
    format: (val) => `${Number(val).toFixed(1)}%`,
  },
];

const categoryColumns: Column[] = [
  {
    key: "category",
    label: "Category",
    align: "left",
    format: (val) => getCategoryDisplayName(val),
  },
  {
    key: "units_sold",
    label: "Units",
    align: "right",
    format: (val) => formatNumber(val as number, 0),
  },
  {
    key: "total_profit",
    label: "Total Profit",
    align: "right",
    format: (val) => formatCurrency(val as number, 0),
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right",
    format: (val) => `${Number(val).toFixed(1)}%`,
  },
];

// Chart wrapper that handles filters and delegates to HorizontalBarChart
const ProfitChart = ({ data }: { data: Record<string, any>[] }) => {
  const { filters, updateFilters } = useReportFilters();

  // In category mode, show all categories; in item mode, show top/bottom N
  const displayData =
    filters.viewMode === "category"
      ? data
      : filters.sortOrder === "top"
      ? data.slice(0, TOP_N_COUNT)
      : data.slice(-TOP_N_COUNT).reverse();

  // Transform data for the bar chart
  const chartData = toBarChartItems(
    displayData,
    "total_profit",
    filters.viewMode
  );

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title and FilterBar */}
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
            onFilterChange={updateFilters}
            enabledFilters={
              filters.viewMode === "item"
                ? ["viewMode", "itemType", "sortOrder", "category"]
                : ["viewMode"]
            }
            showCategoryDropdown={filters.viewMode === "item"}
          />
        </div>
      </div>

      {/* Bar chart */}
      <HorizontalBarChart
        data={chartData}
        title=""
        formatValue={(v) => formatCurrency(v, 0)}
      />
    </div>
  );
};

export default function ItemsByProfit() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useDateRange();
  const { filters } = useReportFilters();

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
      {/* Chart with centralized filter controls */}
      <ProfitChart data={filteredData} />

      {/* Data table */}
      <DataTable
        data={sortedData}
        columns={
          filters.viewMode === "category" ? categoryColumns : itemColumns
        }
        className="mt-6"
      />
    </div>
  );
}
