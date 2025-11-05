import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getItemsByRevenue, getTimePeriodComparison } from "../utils/api";
import type { TimePeriodComparisonData } from "../utils/api";
import { formatCurrency } from "../utils/formatters";

// Reorder to show Mon-Sun (but keep values 0-6)
const DAYS_OF_WEEK = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, "0")}:00`,
}));

// Column Chart Visualization Component
const ColumnChart = ({
  data,
  viewMode
}: {
  data: TimePeriodComparisonData;
  viewMode: 'hourly' | 'total';
}) => {
  const { period_a, period_b } = data;

  // Calculate avg per hour
  const hoursInWindowA = period_a.end_hour - period_a.start_hour;
  const hoursInWindowB = period_b.end_hour - period_b.start_hour;

  const avgPerHourA = period_a.days_counted > 0
    ? period_a.revenue / (period_a.days_counted * hoursInWindowA)
    : 0;
  const avgPerHourB = period_b.days_counted > 0
    ? period_b.revenue / (period_b.days_counted * hoursInWindowB)
    : 0;

  // Determine what to display based on view mode
  const valueA = viewMode === 'hourly' ? avgPerHourA : period_a.revenue;
  const valueB = viewMode === 'hourly' ? avgPerHourB : period_b.revenue;
  const labelA = viewMode === 'hourly' ? `${formatCurrency(avgPerHourA, 2)}/hr` : formatCurrency(period_a.revenue, 0);
  const labelB = viewMode === 'hourly' ? `${formatCurrency(avgPerHourB, 2)}/hr` : formatCurrency(period_b.revenue, 0);

  // Calculate max for scaling
  const maxValue = Math.max(valueA, valueB);
  const heightA = maxValue > 0 ? (valueA / maxValue) * 200 : 0;
  const heightB = maxValue > 0 ? (valueB / maxValue) * 200 : 0;

  return (
    <div style={{ padding: "24px", backgroundColor: "white", borderRadius: "8px" }}>
      <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "24px" }}>
        Revenue Comparison: {data.item_name}
      </h3>

      {/* Column chart */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "80px",
        height: "250px",
        marginBottom: "24px"
      }}>
        {/* Period A Column */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#374151",
            textAlign: "center"
          }}>
            Period A
          </div>
          <div style={{
            width: "210px",
            height: `${heightA}px`,
            backgroundColor: "#3B82F6",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: "16px",
            transition: "height 0.3s ease",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "white",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}>
              {labelA}
            </div>
          </div>
          <div style={{
            fontSize: "15px",
            color: "#6B7280",
            textAlign: "center"
          }}>
            {period_a.units_sold} units
          </div>
        </div>

        {/* Period B Column */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px"
        }}>
          <div style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#374151",
            textAlign: "center"
          }}>
            Period B
          </div>
          <div style={{
            width: "210px",
            height: `${heightB}px`,
            backgroundColor: "#F97316",
            borderRadius: "8px 8px 0 0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: "16px",
            transition: "height 0.3s ease",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "white",
              textShadow: "0 2px 4px rgba(0,0,0,0.2)"
            }}>
              {labelB}
            </div>
          </div>
          <div style={{
            fontSize: "15px",
            color: "#6B7280",
            textAlign: "center"
          }}>
            {period_b.units_sold} units
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
  const [comparisonData, setComparisonData] = useState<TimePeriodComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'hourly' | 'total'>('hourly');

  // Period A settings - START WITH EMPTY DAYS AND 07:00-07:00
  const [periodADays, setPeriodADays] = useState<number[]>([]);
  const [periodAStartHour, setPeriodAStartHour] = useState(7);
  const [periodAEndHour, setPeriodAEndHour] = useState(7);

  // Period B settings - START WITH EMPTY DAYS AND 07:00-07:00
  const [periodBDays, setPeriodBDays] = useState<number[]>([]);
  const [periodBStartHour, setPeriodBStartHour] = useState(7);
  const [periodBEndHour, setPeriodBEndHour] = useState(7);

  // Load items on mount and when date range changes
  useEffect(() => {
    const loadItems = async () => {
      try {
        const response = await getItemsByRevenue(startDate, endDate);
        // Items are already sorted by revenue descending from the backend
        setItems(response.data);
        // Don't auto-select - let user choose from the ranked list
      } catch (err) {
        console.error("Error loading items:", err);
        setError("Failed to load items");
      }
    };
    loadItems();
  }, [startDate, endDate]);

  // Load comparison data when parameters change
  useEffect(() => {
    // Only load if we have an item AND both periods have at least one day selected
    if (selectedItemId !== null && periodADays.length > 0 && periodBDays.length > 0) {
      loadComparisonData();
    } else {
      // Clear data if criteria not met
      setComparisonData(null);
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
          padding: "24px",
          backgroundColor: "white",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h3 style={{ fontSize: "20px", fontWeight: "600", margin: 0 }}>
            Configure Time Period Comparison
          </h3>

          {/* View Mode Toggle */}
          <div style={{ display: "flex", gap: "8px", backgroundColor: "#F3F4F6", padding: "6px", borderRadius: "8px" }}>
            <button
              onClick={() => setViewMode('hourly')}
              style={{
                padding: "8px 16px",
                fontSize: "15px",
                fontWeight: "600",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: viewMode === 'hourly' ? "#3B82F6" : "transparent",
                color: viewMode === 'hourly' ? "#FFFFFF" : "#6B7280",
              }}
            >
              Avg/Hour
            </button>
            <button
              onClick={() => setViewMode('total')}
              style={{
                padding: "8px 16px",
                fontSize: "15px",
                fontWeight: "600",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor: viewMode === 'total' ? "#3B82F6" : "transparent",
                color: viewMode === 'total' ? "#FFFFFF" : "#6B7280",
              }}
            >
              Total Revenue
            </button>
          </div>
        </div>

        {/* Item Selection */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "block",
              fontSize: "16px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "10px",
            }}
          >
            Select Item
          </label>
          <select
            value={selectedItemId || ""}
            onChange={(e) => setSelectedItemId(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #D1D5DB",
              borderRadius: "8px",
              backgroundColor: "white",
            }}
          >
            <option value="" disabled>
              ITEMS RANKED BY REVENUE - Select an item
            </option>
            {items.map((item) => (
              <option key={item.item_id} value={item.item_id}>
                {item.item_id} - {item.item_name} ({item.category})
              </option>
            ))}
          </select>
        </div>

        {/* Period Configuration Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Period A */}
          <div
            style={{
              padding: "20px",
              backgroundColor: "#F9FAFB",
              borderRadius: "8px",
              border: "2px solid #3B82F6",
            }}
          >
            <h4
              style={{
                fontSize: "17px",
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
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "10px",
                }}
              >
                Days of Week
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value, "A")}
                    style={{
                      padding: "8px 14px",
                      fontSize: "15px",
                      fontWeight: "600",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: periodADays.includes(day.value)
                        ? "#3B82F6"
                        : "white",
                      color: periodADays.includes(day.value) ? "white" : "#6B7280",
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {periodADays.length === 0 && (
                <div style={{ marginTop: "8px", fontSize: "14px", color: "#EF4444" }}>
                  Select at least one day
                </div>
              )}
            </div>

            {/* Hour Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "10px",
                }}
              >
                Time Range
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  value={periodAStartHour}
                  onChange={(e) => setPeriodAStartHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: "15px",
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
                <span style={{ fontSize: "16px", color: "#6B7280", fontWeight: "600" }}>to</span>
                <select
                  value={periodAEndHour}
                  onChange={(e) => setPeriodAEndHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: "15px",
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
              padding: "20px",
              backgroundColor: "#F9FAFB",
              borderRadius: "8px",
              border: "2px solid #F97316",
            }}
          >
            <h4
              style={{
                fontSize: "17px",
                fontWeight: "600",
                color: "#F97316",
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
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "10px",
                }}
              >
                Days of Week
              </label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => toggleDay(day.value, "B")}
                    style={{
                      padding: "8px 14px",
                      fontSize: "15px",
                      fontWeight: "600",
                      border: "1px solid #D1D5DB",
                      borderRadius: "6px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      backgroundColor: periodBDays.includes(day.value)
                        ? "#F97316"
                        : "white",
                      color: periodBDays.includes(day.value) ? "white" : "#6B7280",
                    }}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {periodBDays.length === 0 && (
                <div style={{ marginTop: "8px", fontSize: "14px", color: "#EF4444" }}>
                  Select at least one day
                </div>
              )}
            </div>

            {/* Hour Range */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "15px",
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: "10px",
                }}
              >
                Time Range
              </label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <select
                  value={periodBStartHour}
                  onChange={(e) => setPeriodBStartHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: "15px",
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
                <span style={{ fontSize: "16px", color: "#6B7280", fontWeight: "600" }}>to</span>
                <select
                  value={periodBEndHour}
                  onChange={(e) => setPeriodBEndHour(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: "10px",
                    fontSize: "15px",
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
      {!selectedItemId ? (
        <div style={{
          padding: "60px 40px",
          backgroundColor: "white",
          borderRadius: "8px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "48px",
            marginBottom: "16px"
          }}>
            📊
          </div>
          <div style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#374151",
            marginBottom: "8px"
          }}>
            Select an Item to Begin
          </div>
          <div style={{
            fontSize: "15px",
            color: "#6B7280"
          }}>
            Choose an item from the dropdown above to compare revenue across time periods
          </div>
        </div>
      ) : !comparisonData && !loading ? (
        <div style={{
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "8px",
          textAlign: "center",
          color: "#6B7280",
          fontSize: "16px"
        }}>
          {periodADays.length === 0 || periodBDays.length === 0
            ? "Select days for both periods to begin comparison"
            : "Loading..."
          }
        </div>
      ) : loading ? (
        <div className="p-6 text-gray-600">Loading comparison data...</div>
      ) : comparisonData ? (
        <ColumnChart data={comparisonData} viewMode={viewMode} />
      ) : null}
    </div>
  );
}