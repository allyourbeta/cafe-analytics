import ReportLayout, { type Column } from "./ReportLayout";
import { getSalesPerHour } from "../utils/api";

const columns: Column[] = [
  { key: "hour", label: "Hour", align: "left" },
  {
    key: "sales",
    label: "Sales",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
];

// Heat map timeline - instant visual pattern recognition
const SalesChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.sales));
  const minSales = Math.min(...data.map((item) => item.sales));
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);

  // Find peak hour
  const peakHour = data.reduce(
    (max, item) => (item.sales > max.sales ? item : max),
    data[0]
  );

  // Get color based on sales intensity
  const getHeatColor = (sales: number) => {
    const intensity = (sales - minSales) / (maxSales - minSales);
    if (intensity > 0.8)
      return { bg: "#DC2626", text: "#FFFFFF", label: "PEAK" }; // Deep red
    if (intensity > 0.6)
      return { bg: "#EA580C", text: "#FFFFFF", label: "HOT" }; // Bright orange
    if (intensity > 0.4)
      return { bg: "#FB923C", text: "#FFFFFF", label: "WARM" }; // Soft orange
    if (intensity > 0.2)
      return { bg: "#FED7AA", text: "#92400E", label: "WARM" }; // Light orange
    return { bg: "#E5E7EB", text: "#6B7280", label: "COOL" }; // Gray
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "12px",
      }}
    >
      <h3
        style={{
          marginBottom: "24px",
          fontSize: "18px",
          fontWeight: "700",
          color: "#111827",
        }}
      >
        Sales Heat Map - Hourly Pattern
      </h3>

      {/* Heat map timeline */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        {data.map((item, index) => {
          const colors = getHeatColor(item.sales);
          const isPeak = item.sales === peakHour.sales;
          return (
            <div
              key={index}
              style={{
                backgroundColor: colors.bg,
                color: colors.text,
                padding: "16px 8px",
                borderRadius: "8px",
                textAlign: "center",
                transition: "all 0.3s ease",
                boxShadow: isPeak
                  ? "0 0 20px rgba(220, 38, 38, 0.5)"
                  : "0 1px 3px rgba(0,0,0,0.1)",
                transform: isPeak ? "scale(1.05)" : "scale(1)",
                cursor: "pointer",
                position: "relative",
              }}
            >
              {isPeak && (
                <div
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  🔥 PEAK
                </div>
              )}
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                {item.hour}
              </div>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>
                ${item.sales.toFixed(0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            backgroundColor: "#FEF3C7",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #FDE68A",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#92400E",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            🔥 PEAK HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#92400E" }}
          >
            {peakHour.hour}
          </div>
          <div style={{ fontSize: "14px", color: "#92400E", marginTop: "2px" }}>
            ${peakHour.sales.toFixed(0)}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#DBEAFE",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #BFDBFE",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#1E40AF",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            💰 TOTAL SALES
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            ${totalSales.toFixed(0)}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
            Across {data.length} hours
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#E0E7FF",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #C7D2FE",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#4338CA",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            📊 AVG PER HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#4338CA" }}
          >
            ${(totalSales / data.length).toFixed(0)}
          </div>
          <div style={{ fontSize: "14px", color: "#4338CA", marginTop: "2px" }}>
            Per labor hour
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SalesPerHour() {
  return (
    <ReportLayout
      title="Sales per Labor Hour"
      fetchData={getSalesPerHour}
      columns={columns}
      needsDateRange={true}
      ChartComponent={SalesChart}
    />
  );
}
