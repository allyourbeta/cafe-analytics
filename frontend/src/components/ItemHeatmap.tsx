import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getCategoryColor } from "../utils/categoryColors";
import { formatCurrency } from "../utils/formatters";
import axios from "axios";

const API_BASE = "http://127.0.0.1:5500/api";

// Local type definitions (avoiding import issues)
interface TopItem {
  item_id: number;
  item_name: string;
  category: string;
  total_revenue: number;
}

interface HeatmapCell {
  day_of_week: string;
  day_num: number;
  hour: number;
  revenue: number;
  units: number;
}

// Display order: Monday through Sunday (weekends on right)
const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]; // 7am-9pm

export default function ItemHeatmap() {
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TopItem | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { startDate, endDate } = useDateRange();

  // Load top items
  useEffect(() => {
    const loadTopItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE}/reports/top-items`, {
          params: { start: startDate, end: endDate, limit: 25 },
        });

        const items = response.data.data;
        setTopItems(items);

        // Auto-select first item
        if (items && items.length > 0) {
          setSelectedItem(items[0]);
        }
      } catch (err) {
        setError("Failed to load items");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTopItems();
  }, [startDate, endDate]);

  // Load heatmap data when item selected
  useEffect(() => {
    if (!selectedItem) return;

    const loadHeatmapData = async () => {
      try {
        const response = await axios.get(`${API_BASE}/reports/item-heatmap`, {
          params: {
            item_id: selectedItem.item_id,
            start: startDate,
            end: endDate,
          },
        });
        setHeatmapData(response.data.data || []);
      } catch (err) {
        console.error("Failed to load heatmap data", err);
      }
    };

    loadHeatmapData();
  }, [selectedItem, startDate, endDate]);

  // Create a map for quick lookups
  const dataMap = new Map<string, number>();
  heatmapData.forEach((cell) => {
    const key = `${cell.day_num}-${cell.hour}`;
    dataMap.set(key, cell.revenue);
  });

  // Calculate max revenue for color scaling
  const maxRevenue = Math.max(...heatmapData.map((cell) => cell.revenue), 1);

  // Get revenue for a specific cell
  // Maps display index to database day_num (DB uses Sun=0, Mon=1, ..., Sat=6)
  const getRevenue = (displayDayIndex: number, hour: number): number => {
    // Convert display index to database day_num
    // Display: Mon(0), Tue(1), ..., Sat(5), Sun(6)
    // Database: Sun(0), Mon(1), ..., Sat(6)
    const dbDayNum = displayDayIndex === 6 ? 0 : displayDayIndex + 1;
    const key = `${dbDayNum}-${hour}`;
    return dataMap.get(key) || 0;
  };

  // Calculate blue intensity
  const getColorIntensity = (revenue: number): number => {
    if (revenue === 0) return 0;
    return revenue / maxRevenue;
  };

  // Convert intensity to blue color
  const getBlueColor = (intensity: number): string => {
    if (intensity === 0) return "#ffffff";

    const lightR = 219,
      lightG = 234,
      lightB = 254;
    const darkR = 29,
      darkG = 78,
      darkB = 216;

    const r = Math.round(lightR + (darkR - lightR) * intensity);
    const g = Math.round(lightG + (darkG - lightG) * intensity);
    const b = Math.round(lightB + (darkB - lightB) * intensity);

    return `rgb(${r}, ${g}, ${b})`;
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600 bg-red-50 rounded">{error}</div>;
  }

  if (topItems.length === 0) {
    return <div className="p-6 text-gray-500">No data for this period</div>;
  }

  return (
    <div className="flex gap-6">
      {/* Left side - Item list (collapsible) */}
      {!sidebarCollapsed && (
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Top 25 Items</h3>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded transition-colors"
                title="Collapse sidebar"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-1 max-h-[450px] overflow-y-auto">
              {topItems.map((item) => (
                <button
                  key={item.item_id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                    selectedItem?.item_id === item.item_id
                      ? "bg-blue-50 border-2 border-blue-500"
                      : "hover:bg-gray-50 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: getCategoryColor(item.category),
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {item.item_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(item.total_revenue, 0)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed sidebar button */}
      {sidebarCollapsed && (
        <div className="flex-shrink-0">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="bg-white rounded-lg shadow p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
            title="Expand sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Right side - Heatmap */}
      <div className="flex-1">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedItem?.item_name} - Hourly Sales Pattern
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Revenue by day and hour
            </p>
          </div>

          {/* Heatmap grid */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              {/* Header row */}
              <div className="flex mb-1">
                <div className="w-16 flex-shrink-0"></div>
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex-1 text-center font-semibold text-gray-700 px-1"
                    style={{ minWidth: "70px", fontSize: "13px" }}
                  >
                    {day.substring(0, 3)}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {HOURS.map((hour) => (
                <div key={hour} className="flex mb-1">
                  {/* Hour label */}
                  <div
                    className="w-16 flex-shrink-0 font-medium text-gray-600 pr-2 text-right flex items-center justify-end"
                    style={{ fontSize: "13px" }}
                  >
                    {hour === 12
                      ? "12pm"
                      : hour > 12
                      ? `${hour - 12}pm`
                      : `${hour}am`}
                  </div>

                  {/* Cells */}
                  {DAYS.map((day, dayIndex) => {
                    const revenue = getRevenue(dayIndex, hour);
                    const intensity = getColorIntensity(revenue);
                    const bgColor = getBlueColor(intensity);

                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="flex-1 px-1"
                        style={{ minWidth: "70px" }}
                      >
                        <div
                          className="h-8 rounded border border-gray-200 flex items-center justify-center text-xs font-medium cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          style={{ backgroundColor: bgColor }}
                          // title={revenue > 0 ? `${formatCurrency(revenue, 0)}` : 'No sales'}
                        >
                          {revenue > 0 && intensity > 0.5 && (
                            <span className="text-white text-[11px]">
                              {formatCurrency(revenue, 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                }}
              ></div>
              <span>No sales</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#DBEAFE" }}
              ></div>
              <span>Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#60A5FA" }}
              ></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: "#1D4ED8" }}
              ></div>
              <span>High ({formatCurrency(maxRevenue, 0)})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
