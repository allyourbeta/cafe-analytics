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

// Vertical bar chart - visual magnitude representation
const SalesChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.sales));
  const minSales = Math.min(...data.map((item) => item.sales));
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);

  // Find peak hour
  const peakHour = data.reduce(
    (max, item) => (item.sales > max.sales ? item : max),
    data[0]
  );

  // Get color based on sales intensity (blue gradient)
  const getBarColor = (sales: number) => {
    const intensity = (sales - minSales) / (maxSales - minSales);
    if (intensity > 0.8)
      return { bg: "#1E40AF", text: "#FFFFFF", label: "PEAK" }; // Bold blue
    if (intensity > 0.6)
      return { bg: "#2563EB", text: "#FFFFFF", label: "HIGH" }; // Bright blue
    if (intensity > 0.4)
      return { bg: "#3B82F6", text: "#FFFFFF", label: "GOOD" }; // Medium blue
    if (intensity > 0.2)
      return { bg: "#60A5FA", text: "#FFFFFF", label: "MODERATE" }; // Light blue
    return { bg: "#BFDBFE", text: "#1E40AF", label: "LOW" }; // Very light blue
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
        Hourly Sales Pattern
      </h3>

      {/* Vertical bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          marginBottom: "24px",
          height: "300px",
          padding: "0 8px",
        }}
      >
        {data.map((item, index) => {
          const colors = getBarColor(item.sales);
          const isPeak = item.sales === peakHour.sales;
          const heightPercent = (item.sales / maxSales) * 100;

          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                position: "relative",
              }}
            >
              {isPeak && (
                <div
                  style={{
                    position: "absolute",
                    top: "-24px",
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    whiteSpace: "nowrap",
                  }}
                >
                  🔥 PEAK
                </div>
              )}
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: colors.bg,
                  marginBottom: "4px",
                }}
              >
                ${item.sales.toFixed(0)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${heightPercent}%`,
                  backgroundColor: colors.bg,
                  borderRadius: "8px 8px 0 0",
                  transition: "all 0.3s ease",
                  boxShadow: isPeak
                    ? "0 0 20px rgba(30, 64, 175, 0.5)"
                    : "0 2px 4px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  minHeight: "20px",
                }}
                title={`${item.hour}: $${item.sales.toFixed(2)}`}
              />
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#6B7280",
                  marginTop: "8px",
                  transform: "rotate(-45deg)",
                  transformOrigin: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {item.hour}
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
            🔥 PEAK HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            {peakHour.hour}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
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
            📊 AVG PER HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            ${(totalSales / data.length).toFixed(0)}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
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
