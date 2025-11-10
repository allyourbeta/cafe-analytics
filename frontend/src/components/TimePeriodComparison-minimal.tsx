import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import {
  getAllItems,
  getTimePeriodComparison,
  type TimePeriodComparisonData,
} from "../utils/api";
import { formatCurrency } from "../utils/formatters";
import { getCategoryColor } from "../utils/categoryColors";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

// Proportional Circles Visualization Component
const ProportionalCircles = ({ data }: { data: TimePeriodComparisonData }) => {
  const { period_a, period_b } = data;

  // Calculate max revenue for scaling
  const maxRevenue = Math.max(period_a.revenue, period_b.revenue);

  // Scale circle radius based on revenue (area proportional to revenue)
  // Max circle radius is 100px
  const maxRadius = 100;
  const radiusA =
    maxRevenue > 0 ? Math.sqrt(period_a.revenue / maxRevenue) * maxRadius : 0;
  const radiusB =
    maxRevenue > 0 ? Math.sqrt(period_b.revenue / maxRevenue) * maxRadius : 0;

  // Get color for the item's category
  const color = getCategoryColor(data.category);

  // Helper to format day list
  const formatDays = (days: number[]) => {
    if (days.length === 7) return "Every day";
    if (days.length === 5 && !days.includes(0) && !days.includes(6))
      return "Weekdays";
    if (days.length === 2 && days.includes(0) && days.includes(6))
      return "Weekends";
    return days
      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
      .join(", ");
  };

  // Helper to format hour range
  const formatHourRange = (start: number, end: number) => {
    const startLabel = HOURS[start].label;
    const endLabel = HOURS[end].label;
    return `${startLabel} - ${endLabel}`;
  };

  // Calculate percentage difference
  const percentDiff =
    period_a.revenue > 0
      ? ((period_b.revenue - period_a.revenue) / period_a.revenue) * 100
      : period_b.revenue > 0
      ? 100
      : 0;

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px" }}>
        Revenue Comparison: {data.item_name}
      </h3>

      {/* SVG with proportional circles */}
      <svg
        width="100%"
        height="280"
        viewBox="0 0 600 280"
        style={{ marginBottom: "20px" }}
      >
        {/* Period A Circle */}
        <g transform={`translate(150, 140)`}>
          <circle
            r={radiusA}
            fill={color}
            opacity="0.8"
            stroke={color}
            strokeWidth="2"
          />
          <text
            y="-10"
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="#374151"
          >
            Period A
          </text>
          <text
            y="10"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#111827"
          >
            {formatCurrency(period_a.revenue, 0)}
          </text>
          <text y="30" textAnchor="middle" fontSize="12" fill="#6B7280">
            {period_a.units_sold} units
          </text>
        </g>

        {/* Period B Circle */}
        <g transform={`translate(450, 140)`}>
          <circle
            r={radiusB}
            fill={color}
            opacity="0.6"
            stroke={color}
            strokeWidth="2"
          />
          <text
            y="-10"
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="#374151"
          >
            Period B
          </text>
          <text
            y="10"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#111827"
          >
            {formatCurrency(period_b.revenue, 0)}
          </text>
          <text y="30" textAnchor="middle" fontSize="12" fill="#6B7280">
            {period_b.units_sold} units
          </text>
        </g>

        {/* Comparison arrow and text */}
        {period_a.revenue !== period_b.revenue && (
          <>
            <line
              x1="200"
              y1="240"
              x2="400"
              y2="240"
              stroke="#9CA3AF"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            <text
              x="300"
              y="265"
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill={percentDiff > 0 ? "#10B981" : "#EF4444"}
            >
              {percentDiff > 0 ? "+" : ""}
              {percentDiff.toFixed(1)}%
            </text>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#9CA3AF" />
              </marker>
            </defs>
          </>
        )}
      </svg>

      {/* Period Details */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}
      >
        {/* Period A Details */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#F9FAFB",
            borderRadius: "6px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "12px",
            }}
          >
            Period A Details
          </div>
          <div
            style={{ fontSize: "13px", color: "#6B7280", lineHeight: "1.8" }}
          >
            <div>
              <strong>Days:</strong> {formatDays(period_a.days)}
            </div>
            <div>
              <strong>Hours:</strong>{" "}
              {formatHourRange(period_a.start_hour, period_a.end_hour)}
            </div>
            <div>
              <strong>Days counted:</strong> {period_a.days_counted}
            </div>
            <div>
              <strong>Avg per day:</strong>{" "}
              {formatCurrency(period_a.avg_per_day, 2)}
            </div>
          </div>
        </div>

        {/* Period B Details */}
        <div
          style={{
            padding: "16px",
            backgroundColor: "#F9FAFB",
            borderRadius: "6px",
            border: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "12px",
            }}
          >
            Period B Details
          </div>
          <div
            style={{ fontSize: "13px", color: "#6B7280", lineHeight: "1.8" }}
          >
            <div>
              <strong>Days:</strong> {formatDays(period_b.days)}
            </div>
            <div>
              <strong>Hours:</strong>{" "}
              {formatHourRange(period_b.start_hour, period_b.end_hour)}
            </div>
            <div>
              <strong>Days counted:</strong> {period_b.days_counted}
            </div>
            <div>
              <strong>Avg per day:</strong>{" "}
              {formatCurrency(period_b.avg_per_day, 2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TimePeriodComparison() {
  const { startDate, endDate } = useDateRange();
  const [items, setItems] = useState<any[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [comparisonData, setComparisonData] =
    useState<TimePeriodComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Period A settings
  const [periodADays, setPeriodADays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [periodAStartHour, setPeriodAStartHour] = useState(9);
  const [periodAEndHour, setPeriodAEndHour] = useState(12);

  // Period B settings
  const [periodBDays, setPeriodBDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [periodBStartHour, setPeriodBStartHour] = useState(14);
  const [periodBEndHour, setPeriodBEndHour] = useState(17);

  // Load items on mount
  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await getAllItems();
        setItems(response.data);
        // Select first item by default
        if (response.data.length > 0) {
          setSelectedItemId(response.data[0].item_id);
        }
      } catch (err) {
        console.error("Error loading items:", err);
        setError("Failed to load items");
      }
    };
    loadItems();
  }, []);

  // Load comparison data when parameters change
  useEffect(() => {
    if (selectedItemId !== null) {
      loadComparisonData();
    }
  }, [
    selectedItemId,
    startDate,
    endDate,
    periodADays,
    periodAStartHour,
    periodAEndHour,
    periodBDays,
    periodBStartHour,
    periodBEndHour,
  ]);

  const loadComparisonData = async () => {
    if (selectedItemId === null) return;

    setLoading(true);
    setError(null);
    try {
      const response = await getTimePeriodComparison(
        selectedItemId,
        startDate,
        endDate,
        periodADays.join(","),
        periodAStartHour,
        periodAEndHour,
        periodBDays.join(","),
        periodBStartHour,
        periodBEndHour
      );
      setComparisonData(response.data);
    } catch (err) {
      setError("Failed to load comparison data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle day selection
  const toggleDay = (dayValue: number, period: "A" | "B") => {
    if (period === "A") {
      setPeriodADays((prev) =>
        prev.includes(dayValue)
          ? prev.filter((d) => d !== dayValue)
          : [...prev, dayValue].sort()
      );
    } else {
      setPeriodBDays((prev) =>
        prev.includes(dayValue)
          ? prev.filter((d) => d !== dayValue)
          : [...prev, dayValue].sort()
      );
    }
  };

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "white",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <h3
          style={{ fontSize: "16px", fontWeight: "600", marginBottom: "20px" }}
        >
          Configure Time Period Comparison
        </h3>

        {/* Item Selection */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Select Item
          </label>
          <select
            value={selectedItemId || ""}
            onChange={(e) => setSelectedItemId(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "14px",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              backgroundColor: "white",
            }}
          >
            {items.map((item) => (
              <option key={item.item_id} value={item.item_id}>
                {item.item_name} ({item.category})
              </option>
            ))}
          </select>
        </div>

        {/* Period Configuration Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "24px",
          }}
        >
          {/* Period A */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#F9FAFB",
              borderRadius: "8px",
              border: "2px solid #3B82F6",
            }}
          >
            <h4
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#3B82F6",
                marginBottom: "16px",
              }}
            >
              Period A
            </h4>

            {/* Days of Week */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Days of Week
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value, "A")}
                    style={{
                      padding: "6px 12px",
                      fontSize: "13px",
                      fontWeight: "600",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: periodADays.includes(day.value)
                        ? "#3B82F6"
                        : "white",
                      color: periodADays.includes(day.value)
                        ? "white"
                        : "#6B7280",
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Time Range
              </label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <select
                  value={periodAStartHour}
                  onChange={(e) => setPeriodAStartHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: "13px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                  }}
                >
                  {HOURS.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "14px", color: "#6B7280" }}>to</span>
                <select
                  value={periodAEndHour}
                  onChange={(e) => setPeriodAEndHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: "13px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                  }}
                >
                  {HOURS.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Period B */}
          <div
            style={{
              padding: "16px",
              backgroundColor: "#F9FAFB",
              borderRadius: "8px",
              border: "2px solid #10B981",
            }}
          >
            <h4
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#10B981",
                marginBottom: "16px",
              }}
            >
              Period B
            </h4>

            {/* Days of Week */}
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Days of Week
              </label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value, "B")}
                    style={{
                      padding: "6px 12px",
                      fontSize: "13px",
                      fontWeight: "600",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: periodBDays.includes(day.value)
                        ? "#10B981"
                        : "white",
                      color: periodBDays.includes(day.value)
                        ? "white"
                        : "#6B7280",
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Hour Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Time Range
              </label>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <select
                  value={periodBStartHour}
                  onChange={(e) => setPeriodBStartHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: "13px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                  }}
                >
                  {HOURS.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: "14px", color: "#6B7280" }}>to</span>
                <select
                  value={periodBEndHour}
                  onChange={(e) => setPeriodBEndHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "8px",
                    fontSize: "13px",
                    border: "1px solid #D1D5DB",
                    borderRadius: "6px",
                  }}
                >
                  {HOURS.map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visualization */}
      {loading && (
        <div className="p-6 text-gray-600">Loading comparison data...</div>
      )}
      {!loading && comparisonData && (
        <ProportionalCircles data={comparisonData} />
      )}
    </div>
  );
}
