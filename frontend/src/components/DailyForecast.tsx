import ReportLayout, { type Column } from "./ReportLayout";
import { getDailyForecast } from "../utils/api";

// Chart component for the daily forecast
const ForecastChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.forecasted_sales), 1);

  // Constants for scaling the bar heights
  const minBarHeight = 4; // Minimum height for a bar in pixels
  const maxBarHeight = 220; // Maximum height for a bar in pixels

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        7-Day Sales Forecast
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          height: "250px",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        {data.map((item, index) => {
          const barHeight =
            minBarHeight +
            (item.forecasted_sales / maxSales) * (maxBarHeight - minBarHeight);
          const isPast = item.basis && item.basis.includes("actual");

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
                  fontSize: "11px",
                  color: "#6b7280",
                  fontWeight: "500",
                  marginBottom: "4px",
                }}
              >
                ${item.forecasted_sales.toFixed(0)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${barHeight}px`,
                  background: isPast
                    ? "linear-gradient(to top, #06b6d4, #22d3ee)"
                    : "linear-gradient(to top, #3b82f6, #60a5fa)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                  opacity: isPast ? 0.7 : 1,
                }}
              />
              <div
                style={{
                  fontSize: "9px",
                  color: "#9ca3af",
                  marginTop: "4px",
                  textAlign: "center",
                }}
              >
                {item.day_of_week}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: "12px",
          display: "flex",
          gap: "16px",
          justifyContent: "center",
          fontSize: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "linear-gradient(to top, #06b6d4, #22d3ee)",
              borderRadius: "2px",
              opacity: 0.7,
            }}
          />
          <span>Past (Actual)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "linear-gradient(to top, #3b82f6, #60a5fa)",
              borderRadius: "2px",
            }}
          />
          <span>Future (Forecast)</span>
        </div>
      </div>
    </div>
  );
};

export default function DailyForecast() {
  return (
    <ReportLayout
      title="Daily Sales Forecast (Next 7 Days)"
      fetchData={getDailyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={ForecastChart}
    />
  );
}
