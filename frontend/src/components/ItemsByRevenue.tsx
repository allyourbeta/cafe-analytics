import ReportLayout, { type Column } from "./ReportLayout";
import { getItemsByRevenue } from "../utils/api";

const columns: Column[] = [
  { key: "item_name", label: "Item", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "units_sold", label: "Units", align: "right" },
  {
    key: "revenue",
    label: "Revenue",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
];

// Simple CSS bar chart - NO external libraries
const RevenueChart = ({ data }: { data: Record<string, any>[] }) => {
  const top10 = data.slice(0, 10);
  const maxRevenue = Math.max(...top10.map((item) => item.revenue));

  // Color by category for consistency
  const categoryColors: Record<string, string> = {
    alcohol: "#f97316", // Orange
    "coffee drinks": "#fbbf24", // Amber
    "internal food": "#06b6d4", // Cyan
    "external food": "#a855f7", // Purple
    default: "#6b7280", // Gray fallback
  };

  const getColor = (category: string) => {
    return categoryColors[category.toLowerCase()] || categoryColors["default"];
  };

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        Top 10 Items by Revenue
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {top10.map((item, index) => {
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
                    ${item.revenue.toFixed(0)}
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
  return (
    <ReportLayout
      title="Items by Revenue"
      fetchData={getItemsByRevenue}
      columns={columns}
      needsDateRange={true}
      ChartComponent={RevenueChart}
    />
  );
}
