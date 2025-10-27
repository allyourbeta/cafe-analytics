import ReportLayout, { type Column } from "./ReportLayout";
import { getDailyForecast } from "../utils/api";

const columns: Column[] = [
  { key: "date", label: "Date", align: "left" },
  { key: "day_of_week", label: "Day", align: "left" },
  {
    key: "forecasted_sales",
    label: "Forecasted Sales",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
  { key: "basis", label: "Basis", align: "left" },
];

// Combo chart - bars for past, line for future
const ForecastChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.forecasted_sales));

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
          const heightPercent = (item.forecasted_sales / maxSales) * 100;
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
                  height: `${heightPercent}%`,
                  background: isPast
                    ? "linear-gradient(to top, #06b6d4, #22d3ee)"
                    : "linear-gradient(to top, #3b82f6, #60a5fa)",
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                  minHeight: "2px",
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
      columns={columns}
      needsDateRange={false}
      ChartComponent={ForecastChart}
    />
  );
}
