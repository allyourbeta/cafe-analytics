import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { useReportFilters, TOP_N_COUNT } from "../context/ReportFiltersContext";
import { getItemsByRevenue } from "../utils/api";
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
    key: "revenue",
    label: "Revenue",
    align: "right",
    format: (val) => formatCurrency(val as number, 0),
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
    key: "revenue",
    label: "Revenue",
    align: "right",
    format: (val) => formatCurrency(val as number, 0),
  },
];

// Chart wrapper that handles filters and delegates to HorizontalBarChart
const RevenueChart = ({ data }: { data: Record<string, any>[] }) => {
  const { filters, updateFilters } = useReportFilters();
  const metric = filters.metric;

  // Sort data by selected metric
  const sortedByMetric = [...data].sort((a, b) => {
    const aVal = metric === "revenue" ? a.revenue : a.units_sold;
    const bVal = metric === "revenue" ? b.revenue : b.units_sold;
    return bVal - aVal;
  });

  // In category mode, show all categories; in item mode, show top/bottom N
  const displayData =
    filters.viewMode === "category"
      ? sortedByMetric
      : filters.sortOrder === "top"
      ? sortedByMetric.slice(0, TOP_N_COUNT)
      : sortedByMetric.slice(-TOP_N_COUNT).reverse();

  // Transform data for the bar chart
  const valueKey = metric === "revenue" ? "revenue" : "units_sold";
  const chartData = toBarChartItems(displayData, valueKey, filters.viewMode);

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title and filter controls */}
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
            Items by {metric === "revenue" ? "Revenue" : "Units"}
          </h3>

          <FilterBar
            filters={filters}
            onFilterChange={updateFilters}
            enabledFilters={
              filters.viewMode === "item"
                ? ["viewMode", "itemType", "sortOrder", "metric", "category"]
                : ["viewMode", "metric"]
            }
            showCategoryDropdown={filters.viewMode === "item"}
          />
        </div>
      </div>

      {/* Bar chart */}
      <HorizontalBarChart
        data={chartData}
        title=""
        formatValue={(v) =>
          metric === "revenue" ? formatCurrency(v, 0) : formatNumber(v, 0)
        }
      />
    </div>
  );
};

export default function ItemsByRevenue() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useDateRange();
  const { filters } = useReportFilters();
  const metric = filters.metric;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch item data only
      const itemResponse = await getItemsByRevenue(
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
      ? aggregateByCategory(data)
      : filters.selectedCategory === "all"
      ? data
      : data.filter((item) => item.category === filters.selectedCategory);

  // Sort data based on selected metric and sortOrder
  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = metric === "revenue" ? a.revenue : a.units_sold;
    const bVal = metric === "revenue" ? b.revenue : b.units_sold;
    return filters.sortOrder === "top" ? bVal - aVal : aVal - bVal;
  });

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
      <RevenueChart data={filteredData} />

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
