import ReportLayout, { type Column } from "./ReportLayout";
import { getItemsByProfit } from "../utils/api";

const columns: Column[] = [
  { key: "item_name", label: "Item", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "units_sold", label: "Units", align: "right" },
  {
    key: "total_profit",
    label: "Total Profit",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right",
    format: (val) => `${Number(val).toFixed(1)}%`,
  },
];

// Horizontal bar chart by category
const ProfitChart = ({ data }: { data: Record<string, any>[] }) => {
  const top10 = data.slice(0, 10);
  const maxProfit = Math.max(...top10.map((item) => item.total_profit));

  const categoryColors: Record<string, string> = {
    alcohol: "#f97316",
    "coffee drinks": "#fbbf24",
    "internal food": "#06b6d4",
    "external food": "#a855f7",
    default: "#6b7280",
  };

  const getColor = (category: string) => {
    return categoryColors[category.toLowerCase()] || categoryColors["default"];
  };

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        Top 10 Items by Total Profit
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {top10.map((item, index) => {
          const widthPercent = (item.total_profit / maxProfit) * 100;
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
                    backgroundColor: getColor(item.category),
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
                    ${item.total_profit.toFixed(0)}
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
  return (
    <ReportLayout
      title="Items by Total Profit"
      fetchData={getItemsByProfit}
      columns={columns}
      needsDateRange={true}
      ChartComponent={ProfitChart}
    />
  );
}
