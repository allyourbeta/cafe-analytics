import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getRevenueTrends } from "../utils/api";
import type { RevenueTrendsData, RevenuePeriod } from "../utils/api";
import { formatCurrency } from "../utils/formatters";

type Granularity = "week" | "month";

const MAX_VISIBLE_PERIODS = 12;

// Bar chart component
const TrendsChart = ({
  periods,
  average,
  showAll,
  onToggleShowAll,
  totalCount,
  granularity,
}: {
  periods: RevenuePeriod[];
  average: number;
  showAll: boolean;
  onToggleShowAll: () => void;
  totalCount: number;
  granularity: Granularity;
}) => {
  if (!periods || periods.length === 0) return null;

  const maxRevenue = Math.max(...periods.map((p) => p.revenue));
  const chartHeight = 280;
  const barMaxHeight = 220;

  // Calculate position of average line (as percentage from bottom)
  const avgLinePercent = maxRevenue > 0 ? (average / maxRevenue) * 100 : 0;
  const avgLineBottom = (avgLinePercent / 100) * barMaxHeight;

  const needsToggle = totalCount > MAX_VISIBLE_PERIODS;
  const periodLabel = granularity === "week" ? "weeks" : "months";

  // Fixed bar width when scrolling, flexible when not
  const barWidth = showAll ? "60px" : undefined;
  const barMinWidth = showAll ? "60px" : undefined;
  const containerMinWidth = showAll ? `${periods.length * 68}px` : undefined;

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "12px",
        marginBottom: "24px",
      }}
    >
      {/* Toggle for show all */}
      {needsToggle && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#6B7280",
          }}
        >
          <span>
            {showAll
              ? `Showing all ${totalCount} ${periodLabel}`
              : `Showing last ${periods.length} of ${totalCount} ${periodLabel}`}
          </span>
          <button
            onClick={onToggleShowAll}
            style={{
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "500",
              color: "#3B82F6",
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#DBEAFE";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#EFF6FF";
            }}
          >
            {showAll ? "Show recent" : "Show all"}
          </button>
        </div>
      )}

      {/* Chart container with optional scroll */}
      <div
        style={{
          position: "relative",
          height: `${chartHeight}px`,
          paddingBottom: "40px",
          overflowX: showAll ? "auto" : "visible",
          overflowY: "visible",
        }}
      >
        {/* Inner container for scrolling */}
        <div
          style={{
            position: "relative",
            minWidth: containerMinWidth,
            height: "100%",
          }}
        >
          {/* Average line */}
          {average > 0 && (
            <div
              style={{
                position: "absolute",
                left: "0",
                right: "0",
                bottom: `${avgLineBottom + 40}px`,
                height: "2px",
                backgroundColor: "#F59E0B",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: showAll ? "sticky" : "absolute",
                  right: showAll ? "8px" : "0",
                  left: showAll ? "auto" : undefined,
                  top: "-24px",
                  backgroundColor: "#FEF3C7",
                  color: "#92400E",
                  fontSize: "12px",
                  fontWeight: "600",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  width: "fit-content",
                  marginLeft: showAll ? "auto" : undefined,
                }}
              >
                Avg: {formatCurrency(average, 0)}
              </div>
            </div>
          )}

          {/* Bars container */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: showAll ? "flex-start" : "space-around",
              height: `${barMaxHeight}px`,
              gap: "8px",
              paddingTop: "20px",
            }}
          >
            {periods.map((period, index) => {
              const heightPercent =
                maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
              const barHeight = Math.max(
                (heightPercent / 100) * barMaxHeight,
                4
              );

              // Determine color based on comparison to average
              const vsAvg = average > 0 ? (period.revenue - average) / average : 0;
              let barColor = "#3B82F6"; // Default blue
              if (vsAvg > 0.05) barColor = "#1E40AF"; // Above avg: darker blue
              else if (vsAvg < -0.05) barColor = "#93C5FD"; // Below avg: lighter blue

              return (
                <div
                  key={index}
                  style={{
                    flex: showAll ? "none" : 1,
                    width: barWidth,
                    minWidth: barMinWidth,
                    maxWidth: showAll ? undefined : "80px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {/* Revenue label above bar */}
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatCurrency(period.revenue, 0)}
                  </div>

                  {/* Bar */}
                  <div
                    style={{
                      width: "100%",
                      height: `${barHeight}px`,
                      backgroundColor: barColor,
                      borderRadius: "6px 6px 0 0",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                    title={`${period.label}: ${formatCurrency(period.revenue, 2)}`}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div
            style={{
              display: "flex",
              justifyContent: showAll ? "flex-start" : "space-around",
              marginTop: "12px",
              gap: "8px",
            }}
          >
            {periods.map((period, index) => (
              <div
                key={index}
                style={{
                  flex: showAll ? "none" : 1,
                  width: barWidth,
                  minWidth: barMinWidth,
                  maxWidth: showAll ? undefined : "80px",
                  textAlign: "center",
                  fontSize: "11px",
                  fontWeight: "500",
                  color: "#6B7280",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {period.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#1E40AF",
              borderRadius: "4px",
            }}
          />
          <span style={{ fontSize: "13px", color: "#374151" }}>Above Avg</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#3B82F6",
              borderRadius: "4px",
            }}
          />
          <span style={{ fontSize: "13px", color: "#374151" }}>Near Avg</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              backgroundColor: "#93C5FD",
              borderRadius: "4px",
            }}
          />
          <span style={{ fontSize: "13px", color: "#374151" }}>Below Avg</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "2px",
              backgroundColor: "#F59E0B",
            }}
          />
          <span style={{ fontSize: "13px", color: "#374151" }}>Average</span>
        </div>
      </div>
    </div>
  );
};

// Data table component
const TrendsTable = ({
  periods,
  average,
}: {
  periods: RevenuePeriod[];
  average: number;
}) => {
  if (!periods || periods.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #E5E7EB",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#F9FAFB" }}>
            <th
              style={{
                textAlign: "left",
                padding: "14px 16px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              Period
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "14px 16px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              Revenue
            </th>
            <th
              style={{
                textAlign: "right",
                padding: "14px 16px",
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              vs Avg
            </th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period, index) => {
            const vsAvgPct =
              average > 0
                ? ((period.revenue - average) / average) * 100
                : 0;
            const isPositive = vsAvgPct >= 0;

            return (
              <tr
                key={index}
                style={{
                  backgroundColor: index % 2 === 0 ? "white" : "#FAFAFA",
                }}
              >
                <td
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    color: "#374151",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  {period.label}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#111827",
                    textAlign: "right",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  {formatCurrency(period.revenue, 0)}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: isPositive ? "#059669" : "#DC2626",
                    textAlign: "right",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  {isPositive ? "+" : ""}
                  {vsAvgPct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor: "#F0F9FF" }}>
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#1E40AF",
              }}
            >
              Average
            </td>
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#1E40AF",
                textAlign: "right",
              }}
            >
              {formatCurrency(average, 0)}
            </td>
            <td
              style={{
                padding: "12px 16px",
                fontSize: "14px",
                color: "#6B7280",
                textAlign: "right",
              }}
            >
              —
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default function WeeklyMonthlyTrends() {
  const [data, setData] = useState<RevenueTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [showAll, setShowAll] = useState(false);

  // Get dates from global context
  const { startDate, endDate } = useDateRange();

  // Format date for display
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRevenueTrends(startDate, endDate, granularity);
      setData(response.data);
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, granularity]);

  // Reset showAll when granularity changes
  useEffect(() => {
    setShowAll(false);
  }, [granularity]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  // Handle no complete periods
  if (!data || data.periods.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              {granularity === "week" ? "Weekly" : "Monthly"} Revenue Trends
            </h3>
            {/* Toggle buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setGranularity("week")}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  granularity === "week"
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setGranularity("month")}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  granularity === "month"
                    ? "bg-blue-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#FEF3C7",
            border: "1px solid #FCD34D",
            borderRadius: "8px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "16px",
              fontWeight: "600",
              color: "#92400E",
              marginBottom: "8px",
            }}
          >
            No complete {granularity === "week" ? "weeks" : "months"} in selected
            range
          </div>
          <div style={{ fontSize: "14px", color: "#B45309" }}>
            Select a longer date range to see complete{" "}
            {granularity === "week" ? "weeks (Mon-Sun)" : "calendar months"}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with title and toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">
            {granularity === "week" ? "Weekly" : "Monthly"} Revenue Trends:{" "}
            {startDate === endDate
              ? formatDate(startDate)
              : `${formatDate(startDate)} - ${formatDate(endDate)}`}
          </h3>
        </div>

        {/* Toggle buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setGranularity("week")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              granularity === "week"
                ? "bg-blue-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setGranularity("month")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              granularity === "month"
                ? "bg-blue-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Month
          </button>
        </div>

        {/* Summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              backgroundColor: "#DBEAFE",
              padding: "16px",
              borderRadius: "8px",
              border: "2px solid #BFDBFE",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#1E40AF",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              📊 PERIODS SHOWN
            </div>
            <div
              style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
            >
              {data.periods.length}
            </div>
            <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
              complete {granularity === "week" ? "weeks" : "months"}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#DBEAFE",
              padding: "16px",
              borderRadius: "8px",
              border: "2px solid #BFDBFE",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#1E40AF",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              💰 TOTAL REVENUE
            </div>
            <div
              style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
            >
              {formatCurrency(
                data.periods.reduce((sum, p) => sum + p.revenue, 0),
                0
              )}
            </div>
            <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
              across all periods
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#DBEAFE",
              padding: "16px",
              borderRadius: "8px",
              border: "2px solid #BFDBFE",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                color: "#1E40AF",
                fontWeight: "600",
                marginBottom: "4px",
              }}
            >
              📈 AVERAGE
            </div>
            <div
              style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
            >
              {formatCurrency(data.average, 0)}
            </div>
            <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
              per {granularity}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {(() => {
        const totalCount = data.periods.length;
        const visiblePeriods = showAll
          ? data.periods
          : data.periods.slice(-MAX_VISIBLE_PERIODS);

        return (
          <TrendsChart
            periods={visiblePeriods}
            average={data.average}
            showAll={showAll}
            onToggleShowAll={() => setShowAll(!showAll)}
            totalCount={totalCount}
            granularity={granularity}
          />
        );
      })()}

      {/* Table */}
      {(() => {
        const visiblePeriods = showAll
          ? data.periods
          : data.periods.slice(-MAX_VISIBLE_PERIODS);

        return (
          <TrendsTable periods={visiblePeriods} average={data.average} />
        );
      })()}

      {/* Partial period note */}
      {data.excluded_partial && (
        <div
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            backgroundColor: "#F9FAFB",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            fontSize: "13px",
            color: "#6B7280",
          }}
        >
          <span style={{ fontWeight: "600" }}>ℹ️ Note:</span>{" "}
          {data.excluded_partial.reason}
          {data.excluded_partial.reason.includes("start") &&
            !data.excluded_partial.reason.includes("and end") && (
              <span>
                {" "}
                ({formatDate(data.excluded_partial.start)} -{" "}
                {formatDate(data.excluded_partial.end)} excluded)
              </span>
            )}
          {data.excluded_partial.reason.includes("end") &&
            !data.excluded_partial.reason.includes("start") && (
              <span>
                {" "}
                ({formatDate(data.excluded_partial.start)} -{" "}
                {formatDate(data.excluded_partial.end)} excluded)
              </span>
            )}
        </div>
      )}
    </div>
  );
}