import ReportLayout, { type Column } from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";

// Chart component for the hourly forecast
const HourlyChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.avg_sales), 1);

  // Constants for scaling the bar heights
  const minBarHeight = 8;
  const maxBarHeight = 220;

  // Function to get bar color based on sales intensity (heatmap effect)
  const getBarColor = (revenue: number, type: "light" | "dark") => {
    if (revenue <= 0) return "#e5e7eb";
    const intensity = Math.min(revenue / maxSales, 1);

    const baseLight = { r: 219, g: 234, b: 254 }; // blue-100
    const baseDark = { r: 29, g: 78, b: 216 }; // blue-700

    const r = Math.round(baseLight.r + (baseDark.r - baseLight.r) * intensity);
    const g = Math.round(baseLight.g + (baseDark.g - baseLight.g) * intensity);
    const b = Math.round(baseLight.b + (baseDark.b - baseLight.b) * intensity);

    if (type === "light") {
      return `rgb(${Math.min(r + 40, 255)}, ${Math.min(
        g + 40,
        255
      )}, ${Math.min(b + 40, 255)})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: "600" }}>
        Tomorrow's Hourly Sales Forecast
      </h3>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "16px",
          height: "280px",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        {data.map((item, index) => {
          const barHeight =
            minBarHeight +
            (item.avg_sales / maxSales) * (maxBarHeight - minBarHeight);

          const darkColor = getBarColor(item.avg_sales, "dark");
          const lightColor = getBarColor(item.avg_sales, "light");

          // Parse hour to determine if it's weekend-adjacent or special
          const hourNum = parseInt(item.hour.split(":")[0]);
          const isWeekend = false; // For hourly, we'll handle this differently in carousel

          return (
            <div
              key={index}
              className="hour-container"
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                background: isWeekend ? "#f9fafb" : "transparent",
                borderRadius: "6px",
                padding: "4px 2px",
                transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-8px)";
                const bar = e.currentTarget.querySelector(
                  ".bar"
                ) as HTMLElement;
                if (bar)
                  bar.style.boxShadow =
                    "0 20px 40px -10px rgba(29, 78, 216, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                const bar = e.currentTarget.querySelector(
                  ".bar"
                ) as HTMLElement;
                if (bar)
                  bar.style.boxShadow = "0 10px 25px -5px rgba(0, 0, 0, 0.15)";
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: "#475569",
                  fontWeight: "600",
                  marginBottom: "4px",
                }}
              >
                ${item.avg_sales.toFixed(0)}
              </div>
              <div
                className="bar"
                style={{
                  width: "100%",
                  height: `${barHeight}px`,
                  background: `linear-gradient(to top, ${darkColor} 0%, ${lightColor} 100%)`,
                  borderRadius: "6px 6px 0 0",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                  transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "40%",
                    background:
                      "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)",
                    borderRadius: "6px 6px 0 0",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#94a3b8",
                  marginTop: "4px",
                  fontWeight: "500",
                }}
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
