import { useState } from "react";
import ReportLayout from "./ReportLayout";
import { getDailyForecast } from "../utils/api";
import { Calendar } from "lucide-react";

// Professional bar chart component
const ForecastChart = ({ data }: { data: Record<string, any>[] }) => {
  const [currentWeek, setCurrentWeek] = useState(0);

  const maxSales = Math.max(...data.map((item) => item.forecasted_sales), 1);

  // Group data by calendar week
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  const daysLeftInThisWeek = dayOfWeek === 6 ? 7 : 7 - (dayOfWeek + 1);

  const weeks = [
    data.slice(0, daysLeftInThisWeek),
    data.slice(daysLeftInThisWeek, daysLeftInThisWeek + 7),
    data.slice(daysLeftInThisWeek + 7, daysLeftInThisWeek + 14),
  ].filter((week) => week.length > 0);

  // Format week date range - show full calendar week (Sun-Sat)
  const getWeekDateRange = (weekData: Record<string, any>[]) => {
    if (!weekData || weekData.length === 0) return "";
    const firstDate = weekData[0].date;

    // Parse first date and find the Sunday of that week
    const [year, month, day] = firstDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday

    // Calculate Sunday and Saturday of this week
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dayOfWeek);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const formatDate = (d: Date) => {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };

    const first = formatDate(sunday);
    const last = formatDate(saturday).split(" ")[1]; // Just the day number
    return `${first}-${last}`;
  };

  // Calculate Y-axis scale at $1000 intervals
  const getYAxisScale = () => {
    const roundedMax = Math.ceil(maxSales / 1000) * 1000;
    const intervals = [];
    for (let i = roundedMax; i >= 0; i -= 1000) {
      intervals.push(i);
    }
    return { max: roundedMax, intervals };
  };

  const yAxisScale = getYAxisScale();

  // Calculate week total
  const getWeekTotal = (weekData: Record<string, any>[]) => {
    return weekData.reduce((sum, day) => sum + day.forecasted_sales, 0);
  };

  const currentWeekData = weeks[currentWeek];
  const weekTotal = getWeekTotal(currentWeekData);
  const isPartialWeek = currentWeekData.length < 7;

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Daily Sales Forecast Report
            </h2>
            <p className="text-base text-gray-600 mt-1">
              Three-week revenue projection analysis
            </p>
          </div>
          <div className="flex items-center gap-2 text-base text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              Week {currentWeek + 1} of {weeks.length}
            </span>
          </div>
        </div>
      </div>

      {/* Week header with total */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">
          Week of {getWeekDateRange(currentWeekData)}
        </h3>
        <div className="bg-gray-100 px-4 py-2 rounded-lg">
          <span className="text-base text-gray-600 mr-2">TOTAL:</span>
          <span className="text-xl font-bold text-gray-900">
            $
            {weekTotal.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
          {isPartialWeek && (
            <span className="text-base text-gray-500 ml-2">
              / {currentWeekData.length} day
              {currentWeekData.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {/* Bar chart */}
      <div className="mb-8">
        <div className="relative" style={{ height: "320px" }}>
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-sm text-gray-500">
            {yAxisScale.intervals.map((value, idx) => (
              <span key={idx}>${value.toLocaleString()}</span>
            ))}
          </div>

          {/* Columns */}
          <div className="ml-16 absolute inset-0 left-16 right-0 top-0 bottom-8 flex items-end justify-between gap-4">
            {(() => {
              const slots: any[] = [];

              // If partial week, add gray placeholders for past days
              if (currentWeekData.length < 7 && currentWeekData.length > 0) {
                const firstDay = currentWeekData[0].day_of_week;
                const dayPositionMap: Record<string, number> = {
                  'Monday': 0,
                  'Tuesday': 1,
                  'Wednesday': 2,
                  'Thursday': 3,
                  'Friday': 4,
                  'Saturday': 5,
                  'Sunday': 6
                };
                const dayPosition = dayPositionMap[firstDay] || 0;

                // Add gray placeholders for days before the first forecast day
                for (let i = 0; i < dayPosition; i++) {
                  const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                  slots.push(
                    <div
                      key={`past-${i}`}
                      className="flex-1 flex flex-col items-center h-full justify-end"
                    >
                      {/* Empty space where value would be */}
                      <div className="text-base font-semibold mb-2 invisible">$0</div>

                      {/* Faint gray rectangle */}
                      <div
                        className="w-full bg-gray-200 rounded-t"
                        style={{ height: "8px" }}
                      />

                      {/* Day label - light gray */}
                      <div className="text-sm font-medium text-gray-400 mt-2">
                        {dayNames[i]}
                      </div>
                    </div>
                  );
                }
              }

              // Add the actual forecast data
              currentWeekData.forEach((item, index) => {
                const columnHeightPx =
                  (item.forecasted_sales / yAxisScale.max) * 100;
                const dayAbbr = item.day_of_week.substring(0, 3).toUpperCase();

                slots.push(
                  <div
                    key={`forecast-${index}`}
                    className="flex-1 flex flex-col items-center h-full justify-end"
                  >
                    {/* Value label */}
                    <div className="text-base font-semibold text-gray-700 mb-2">
                      $
                      {item.forecasted_sales.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </div>

                    {/* Column */}
                    <div
                      className="w-full bg-blue-600 rounded-t transition-all duration-300 hover:bg-blue-700"
                      style={{ height: `${columnHeightPx}%`, minHeight: "8px" }}
                    />

                    {/* Day label */}
                    <div className="text-sm font-medium text-gray-600 mt-2">
                      {dayAbbr}
                    </div>
                  </div>
                );
              });

              return slots;
            })()}
          </div>
        </div>
      </div>

      {/* Week selector buttons */}
      <div className="flex justify-center gap-2">
        {weeks.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentWeek(index)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              index === currentWeek
                ? "bg-gray-800 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            Week {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
};

export default function DailyForecast() {
  return (
    <ReportLayout
      title="Next 15-21 Days"
      fetchData={getDailyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={ForecastChart}
      enableCache={true}
      cacheKey="daily_forecast"
    />
  );
}