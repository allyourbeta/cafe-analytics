import { useState, useEffect } from "react";
import ReportLayout from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";

// Labor target localStorage (same as LaborPercent component)
const LABOR_TARGET_STORAGE_KEY = "cafe_labor_target_percent";
const DEFAULT_TARGET = 28;
const MIN_TARGET = 15;
const MAX_TARGET = 40;

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
              <div
                className="flex items-end justify-start gap-3 pr-4"
                style={{ height: "280px" }}
              >
                {dayData.hourly_data.map((item: any, hourIdx: number) => {
                  const columnHeightPx =
                    (item.avg_sales / yAxisScale.max) * 100;
                  const hourLabel = item.hour.split(":")[0];

                  return (
                    <div
                      key={hourIdx}
                      className="flex-1 flex flex-col items-center"
                    >
                      {/* Bar area with fixed height - bars align to bottom */}
                      <div
                        className="w-full flex flex-col items-center justify-end"
                        style={{ height: "180px" }}
                      >
                        {/* Sales amount */}
                        <div className="text-sm font-bold text-gray-800 mb-2">
                          ${item.avg_sales.toFixed(0)}
                        </div>

                        {/* Bar */}
                        <div
                          className="w-full bg-blue-600 rounded-t-lg"
                          style={{
                            height: `${columnHeightPx}%`,
                            minHeight: "4px",
                          }}
                        />
                      </div>

                      {/* Student hours - IN A BOX */}
                      <div className="mt-2 bg-green-50 border-2 border-green-200 rounded-lg p-2 w-full">
                        <div className="flex justify-center items-center">
                          <div className="text-base font-bold text-green-800 leading-tight">
                            {(() => {
                              const range =
                                item.student_hours?.split(" ")[0] || "0.0";
                              // If no dash, duplicate the value (e.g., "0.0" becomes "0.0-0.0")
                              const [start, end] = range.includes("-")
                                ? range.split("-")
                                : [range, range];
                              return (
                                <>
                                  <div className="flex items-center justify-end">
                                    <span>{start}</span>
                                    <span className="ml-0.5">–</span>
                                  </div>
                                  <div className="text-center">{end}</div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-[10px] font-medium text-green-600 text-center mt-1">
                          student hrs
                        </div>
                      </div>

                      {/* Hour label */}
                      <div className="text-base font-bold text-gray-700 mt-2">
                        {hourLabel}
                      </div>
                    </div>
                  );
                })}
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
  // Load target from localStorage
  const [target, setTarget] = useState(() => {
    const saved = localStorage.getItem(LABOR_TARGET_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved);
      if (parsed >= MIN_TARGET && parsed <= MAX_TARGET) {
        return parsed;
      }
    }
    return DEFAULT_TARGET;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempTarget, setTempTarget] = useState(target.toString());
  const [refreshKey, setRefreshKey] = useState(0);

  // Save target to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(LABOR_TARGET_STORAGE_KEY, target.toString());
    // Trigger re-fetch when target changes
    setRefreshKey((prev) => prev + 1);
  }, [target]);

  const handleTargetChange = (value: string) => {
    setTempTarget(value);
    const newTarget = parseInt(value);
    if (newTarget >= MIN_TARGET && newTarget <= MAX_TARGET) {
      setTarget(newTarget);
    }
  };

  const handleTargetBlur = () => {
    const newTarget = parseInt(tempTarget);
    if (newTarget < MIN_TARGET || newTarget > MAX_TARGET || isNaN(newTarget)) {
      setTempTarget(target.toString());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTargetBlur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newTarget = Math.min(MAX_TARGET, target + 1);
      setTarget(newTarget);
      setTempTarget(newTarget.toString());
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newTarget = Math.max(MIN_TARGET, target - 1);
      setTarget(newTarget);
      setTempTarget(newTarget.toString());
    }
  };

  const increment = () => {
    if (target < MAX_TARGET) {
      setTarget(target + 1);
    }
  };

  const decrement = () => {
    if (target > MIN_TARGET) {
      setTarget(target - 1);
    }
  };

  // Custom fetchData that includes target parameter
  const fetchDataWithTarget = () => getHourlyForecast(target);

  return (
    <div>
      {/* Target % Stepper Control Header */}
      <div className="flex items-center justify-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">
          Hourly Sales Forecast
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">(Labor % Target:</span>

          {/* Stepper Control */}
          <div className="flex items-center gap-2">
            {/* Minus button */}
            <button
              onClick={decrement}
              disabled={target <= MIN_TARGET}
              className={`w-7 h-7 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-md transition-all ${
                target <= MIN_TARGET
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-gray-200 cursor-pointer"
              }`}
            >
              <span className="text-base text-gray-700 leading-none">−</span>
            </button>

            {/* Editable target value */}
            {isEditing ? (
              <input
                type="number"
                value={tempTarget}
                onChange={(e) => handleTargetChange(e.target.value)}
                onBlur={handleTargetBlur}
                onKeyDown={handleKeyDown}
                autoFocus
                min={MIN_TARGET}
                max={MAX_TARGET}
                className="w-12 px-2 py-1 text-sm font-semibold border-2 border-blue-600 rounded-md text-center outline-none"
              />
            ) : (
              <span
                onClick={() => {
                  setIsEditing(true);
                  setTempTarget(target.toString());
                }}
                className="text-sm font-semibold text-blue-600 cursor-pointer px-2 py-1 min-w-[40px] text-center rounded-md bg-blue-50 hover:bg-blue-100 transition-all"
              >
                {target}%
              </span>
            )}

            {/* Plus button */}
            <button
              onClick={increment}
              disabled={target >= MAX_TARGET}
              className={`w-7 h-7 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-md transition-all ${
                target >= MAX_TARGET
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-gray-200 cursor-pointer"
              }`}
            >
              <span className="text-base text-gray-700 leading-none">+</span>
            </button>
          </div>

          <span className="text-sm text-gray-500">)</span>
        </div>
      </div>

      {/* ReportLayout with custom fetch function */}
      <ReportLayout
        key={refreshKey}
        title="Next 15-21 Days"
        fetchData={fetchDataWithTarget}
        columns={[]}
        needsDateRange={false}
        ChartComponent={HourlyChart}
        enableCache={true}
        cacheKey={`hourly_forecast_${target}`}
      />
    </div>
  );
}
