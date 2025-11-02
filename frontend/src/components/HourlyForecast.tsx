import ReportLayout, { type Column } from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";

// Chart component for the hourly forecast
const HourlyChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.avg_sales), 1);

  // Constants for scaling the bar heights
  const minBarHeight = 4; // Minimum height for a bar in pixels
  const maxBarHeight = 220; // Maximum height for a bar in pixels

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        Tomorrow's Hourly Sales Forecast
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "4px",
          height: "250px",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        {data.map((item, index) => {
          // Calculate bar height with a minimum value to ensure visibility
          const barHeight =
            minBarHeight +
            (item.avg_sales / maxSales) * (maxBarHeight - minBarHeight);

          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "#6b7280",
                  fontWeight: "500",
                  marginBottom: "4px",
                }}
              >
                ${item.avg_sales.toFixed(0)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${barHeight}px`,
                  background: "linear-gradient(to top, #3b82f6, #60a5fa)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                }}
              />
              <div
                style={{ fontSize: "9px", color: "#9ca3af", marginTop: "4px" }}
              >
                {item.hour}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function HourlyForecast() {
  return (
    <ReportLayout
      title="Hourly Sales Forecast (Tomorrow)"
      fetchData={getHourlyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={HourlyChart}
    />
  );
}
