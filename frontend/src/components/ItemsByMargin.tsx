import ReportLayout, { type Column } from "./ReportLayout";
import { getItemsByMargin } from "../utils/api";
import { type FilterValues } from "./FilterBar";
import { TOP_N_COUNT } from "../context/ReportFiltersContext";
import HorizontalBarChart, { toBarChartItems } from "./HorizontalBarChart";

const columns: Column[] = [
  {
    key: "item_name",
    label: "Item",
    align: "left",
    format: (val: string | number, row?: any) =>
      row?.item_id ? `${row.item_id} - ${val}` : val,
  },
  { key: "category", label: "Category", align: "left" },
  {
    key: "current_price",
    label: "Price",
    align: "right",
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "current_cost",
    label: "Cost",
    align: "right",
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "profit_per_unit",
    label: "Profit/Unit",
    align: "right",
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right",
    format: (val: number | string) => `${Number(val).toFixed(1)}%`,
  },
];

// Chart wrapper that delegates to HorizontalBarChart
const MarginChart = ({
  data,
  filters,
}: {
  data: Record<string, any>[];
  filters?: FilterValues;
}) => {
  const displayData =
    filters?.sortOrder === "top"
      ? data.slice(0, TOP_N_COUNT)
      : data.slice(-TOP_N_COUNT).reverse();

  // Transform data for the bar chart
  const chartData = toBarChartItems(displayData, "margin_pct", "item");

  return (
    <HorizontalBarChart
      data={chartData}
      title="Items by Profit Margin %"
      formatValue={(v) => `${v.toFixed(1)}%`}
    />
  );
};

export default function ItemsByMargin() {
  return (
    <ReportLayout
      title="Items by Profit Margin %"
      fetchData={(_, __, filters) =>
        getItemsByMargin(filters?.itemType || "all")
      }
      columns={columns}
      needsDateRange={false}
      ChartComponent={MarginChart}
      enabledFilters={["itemType", "sortOrder"]}
    />
  );
}
