import ReportLayout, { type Column } from "./ReportLayout";
import { getDailyForecast } from "../utils/api";

// Chart component for the daily forecast
const ForecastChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxSales = Math.max(...data.map((item) => item.forecasted_sales), 1);

  // --- Group data by calendar week --- //
  const today = new Date();
  // In JS, Sunday is 0. We want Monday to be 0 for easier week calculations.
  const dayOfWeek = (today.getDay() + 6) % 7;

  // Days left in the current week, starting from tomorrow.
  const daysLeftInThisWeek = dayOfWeek === 6 ? 7 : 7 - (dayOfWeek + 1);

  const thisWeekData = data.slice(0, daysLeftInThisWeek);
  const nextWeekData = data.slice(daysLeftInThisWeek, daysLeftInThisWeek + 7);
  const twoWeeksOutData = data.slice(
    daysLeftInThisWeek + 7,
    daysLeftInThisWeek + 14
  );

  // --- Chart Rendering Logic --- //
  const minBarHeight = 4; // Minimum height for a bar in pixels
  const maxBarHeight = 180; // Adjusted for a more compact view

  // Function to get bar color based on sales intensity
  const getBarColor = (revenue: number) => {
    if (revenue <= 0) return "#e5e7eb"; // A light gray for no sales
    const intensity = Math.min(revenue / maxSales, 1);

    const lightR = 219,
      lightG = 234,
      lightB = 254; // Light Blue (blue-100)
    const darkR = 29,
      darkG = 78,
      darkB = 216; // Dark Blue (blue-700)

    const r = Math.round(lightR + (darkR - lightR) * intensity);
    const g = Math.round(lightG + (darkG - lightG) * intensity);
    const b = Math.round(lightB + (darkB - lightB) * intensity);

    return `rgb(${r}, ${g}, ${b})`;
  };

  const renderWeek = (weekData: Record<string, any>[], title: string) => {
    if (!weekData || weekData.length === 0) return null;

    // Create a full 7-day array for consistent layout, with placeholders
    const fullWeek = Array.from({ length: 7 }, (_, i) => {
      const dayIndex = (i + 1) % 7; // Monday=1, ..., Sunday=0
      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        dayIndex
      ];
      return weekData.find((d) => d.day_of_week.startsWith(dayName)) || null;
    });

    return (
      // Add more bottom margin for spacing
      <div className="mb-8">
        <h4 className="text-sm font-semibold text-gray-800 mb-3 border-b pb-2">
          {title}
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(7, 1fr)`,
            alignItems: "flex-end",
            gap: "8px",
            height: "220px",
            paddingBottom: "10px",
          }}
        >
          {fullWeek.map((item, index) => {
            const isWeekend = index === 5 || index === 6; // Saturday or Sunday

            if (!item) {
              // Render a placeholder for days not in the forecast (e.g., past days)
              return (
                <div
                  key={`placeholder-${index}`}
                  style={{
                    background: isWeekend ? "#f9fafb" : "transparent",
                    borderRadius: "4px",
                  }}
                />
              );
            }

            const barHeight =
              minBarHeight +
              (item.forecasted_sales / maxSales) *
                (maxBarHeight - minBarHeight);
            const barColor = getBarColor(item.forecasted_sales);

            return (
              <div
                key={index}
                style={{
                  background: isWeekend ? "#f9fafb" : "transparent",
                  borderRadius: "4px",
                  padding: "4px 2px",
                  display: "flex",
                  flexDirection: "column-reverse", // To align bar at bottom
                  height: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    color: "#9ca3af",
                    marginTop: "4px",
                    textAlign: "center",
                  }}
                >
                  {item.day_of_week.substring(0, 3)}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: `${barHeight}px`,
                    background: barColor,
                    borderRadius: "4px 4px 0 0",
                    transition: "all 0.3s ease",
                  }}
                />
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7280",
                    fontWeight: "500",
                    marginBottom: "4px",
                    textAlign: "center",
                  }}
                >
                  ${item.forecasted_sales.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Determine Titles --- //
  const getMondayDate = (dateStr: string) => {
    if (!dateStr) return "";
    // Parse YYYY-MM-DD to avoid timezone issues
    const parts = dateStr.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = (date.getDay() + 6) % 7; // Monday=0, Sunday=6
    date.setDate(date.getDate() - day);
    return date.toISOString().split("T")[0];
  };

  const thisWeekTitle = `Week starting ${getMondayDate(thisWeekData[0]?.date)}`;
  const nextWeekTitle = `Week starting ${nextWeekData[0]?.date}`;
  const twoWeeksOutTitle = `Week starting ${twoWeeksOutData[0]?.date}`;

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {renderWeek(thisWeekData, thisWeekTitle)}
      {renderWeek(nextWeekData, nextWeekTitle)}
      {renderWeek(twoWeeksOutData, twoWeeksOutTitle)}
    </div>
  );
};

export default function DailyForecast() {
  return (
    <ReportLayout
      title="21-Day Sales Forecast"
      fetchData={getDailyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={ForecastChart}
    />
  );
}
