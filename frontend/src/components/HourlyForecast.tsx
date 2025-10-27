import ReportLayout, { type Column } from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";

const columns: Column[] = [
  { key: "hour", label: "Hour", align: "left" },
  {
    key: "avg_sales",
    label: "Forecasted Sales",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
];

// Dual line chart - tomorrow forecast
const HourlyChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.avg_sales));

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
          const heightPercent = (item.avg_sales / maxSales) * 100;
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
                  height: `${heightPercent}%`,
                  background: "linear-gradient(to top, #3b82f6, #60a5fa)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                  minHeight: "2px",
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
      columns={columns}
      needsDateRange={false}
      ChartComponent={HourlyChart}
    />
  );
}
