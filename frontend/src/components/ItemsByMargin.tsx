import ReportLayout, { type Column } from "./ReportLayout";
import { getItemsByMargin } from "../utils/api";
import { getCategoryColor } from "../utils/categoryColors";
import { type FilterValues } from "./FilterBar";

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

// Horizontal bar chart for margin %
const MarginChart = ({
  data,
  filters,
}: {
  data: Record<string, any>[];
  filters?: FilterValues;
}) => {
  const displayData =
    filters?.sortOrder === "top"
      ? data.slice(0, 10)
      : data.slice(-10).reverse();

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title */}
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
          Items by Profit Margin %
        </h3>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayData.map((item, index) => {
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
                    width: `${item.margin_pct}%`,
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
                    {item.margin_pct.toFixed(1)}%
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
