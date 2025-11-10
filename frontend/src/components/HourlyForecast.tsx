import { useState } from "react";
import ReportLayout from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";

// Professional hourly chart component
const HourlyChart = ({ data }: { data: Record<string, any>[] }) => {
  const [currentWeek, setCurrentWeek] = useState(0);

  // Group data by calendar week
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  const daysLeftInThisWeek = dayOfWeek === 6 ? 7 : 7 - (dayOfWeek + 1);

  const days = [
    data.slice(0, daysLeftInThisWeek),
    data.slice(daysLeftInThisWeek, daysLeftInThisWeek + 7),
    data.slice(daysLeftInThisWeek + 7, daysLeftInThisWeek + 14),
  ].filter((week) => week.length > 0);

  // Calculate max sales across ALL hourly data for consistent scaling
  const maxSales = Math.max(
    ...data.flatMap((day) => day.hourly_data.map((h: any) => h.avg_sales)),
    1
  );

  // Calculate Y-axis scale at $100 intervals
  const getYAxisScale = () => {
    const roundedMax = Math.ceil(maxSales / 100) * 100;
    const intervals = [];
    for (let i = roundedMax; i >= 0; i -= 100) {
      intervals.push(i);
    }
    return { max: roundedMax, intervals };
  };

  const yAxisScale = getYAxisScale();

  const getDateLabel = (dateStr: string, dayOfWeek: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return `${dayOfWeek}, ${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  };

  // Calculate daily total
  const getDailyTotal = (dayData: Record<string, any>) => {
    return dayData.hourly_data.reduce(
      (sum: number, hour: any) => sum + hour.avg_sales,
      0
    );
  };

  const weeks = days;

  const currentWeekData = weeks[currentWeek] || [];

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      {/* Week selector buttons - top */}
      <div className="flex justify-center gap-2 mb-6">
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

      {/* Days stacked vertically */}
      <div className="space-y-8">
        {currentWeekData.map((dayData, idx) => {
          const dailyTotal = getDailyTotal(dayData);

          return (
            <div
              key={idx}
              className="border-b border-gray-200 pb-6 last:border-b-0"
            >
              {/* Day header with total */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {getDateLabel(dayData.date, dayData.day_of_week)}
                </h3>
                <div className="bg-gray-100 px-3 py-1 rounded-lg">
                  <span className="text-sm text-gray-600 mr-2">TOTAL:</span>
                  <span className="text-base font-bold text-gray-900">
                    $
                    {dailyTotal.toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>

              {/* Hourly chart */}
              <div className="relative" style={{ height: "240px" }}>
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-sm text-gray-500">
                  {yAxisScale.intervals.map((value, yIdx) => (
                    <span key={yIdx}>${value.toLocaleString()}</span>
                  ))}
                </div>

                {/* Columns */}
                <div className="ml-12 absolute inset-0 left-12 right-0 top-0 bottom-8 flex items-end justify-start gap-1">
                  {dayData.hourly_data.map((item: any, hourIdx: number) => {
                    const columnHeightPx =
                      (item.avg_sales / yAxisScale.max) * 100;
                    const hourLabel = item.hour.split(":")[0];

                    return (
                      <div
                        key={hourIdx}
                        className="flex-1 flex flex-col items-center h-full justify-end"
                      >
                        {/* Value label */}
                        <div className="text-xs font-semibold text-gray-700 mb-1">
                          ${item.avg_sales.toFixed(0)}
                        </div>

                        {/* Column */}
                        <div
                          className="w-full bg-blue-600 rounded-t transition-all duration-300 hover:bg-blue-700"
                          style={{
                            height: `${columnHeightPx}%`,
                            minHeight: "4px",
                          }}
                        />

                        {/* Hour label */}
                        <div className="text-xs font-medium text-gray-600 mt-1">
                          {hourLabel}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week selector buttons - bottom */}
      <div className="flex justify-center gap-2 mt-6">
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

export default function HourlyForecast() {
  return (
    <ReportLayout
      title="Next 15-21 Days"
      fetchData={getHourlyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={HourlyChart}
      enableCache={true}
      cacheKey="hourly_forecast"
    />
  );
}
