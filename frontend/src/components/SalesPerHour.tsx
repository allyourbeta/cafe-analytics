import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getSalesPerHour } from "../utils/api";

type ViewMode = "average" | "day-of-week";

// Vertical bar chart - visual magnitude representation
const SalesChart = ({ data }: { data: Record<string, any>[] }) => {
  if (!data || data.length === 0) return null;

  // Safety check: ensure data has the expected structure
  if (!data[0]?.sales) return null;

  const maxSales = Math.max(...data.map((item) => item.sales));
  const minSales = Math.min(...data.map((item) => item.sales));
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);

  // Find peak hour
  const peakHour = data.reduce(
    (max, item) => (item.sales > max.sales ? item : max),
    data[0]
  );

  // Get color based on sales intensity (blue gradient)
  const getBarColor = (sales: number) => {
    const intensity = (sales - minSales) / (maxSales - minSales);
    if (intensity > 0.8)
      return { bg: "#1E40AF", text: "#FFFFFF", label: "PEAK" }; // Bold blue
    if (intensity > 0.6)
      return { bg: "#2563EB", text: "#FFFFFF", label: "HIGH" }; // Bright blue
    if (intensity > 0.4)
      return { bg: "#3B82F6", text: "#FFFFFF", label: "GOOD" }; // Medium blue
    if (intensity > 0.2)
      return { bg: "#60A5FA", text: "#FFFFFF", label: "MODERATE" }; // Light blue
    return { bg: "#BFDBFE", text: "#1E40AF", label: "LOW" }; // Very light blue
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "12px",
      }}
    >
      {/* Vertical bar chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "8px",
          marginBottom: "24px",
          height: "300px",
          padding: "0 8px",
        }}
      >
        {data.map((item, index) => {
          const colors = getBarColor(item.sales);
          const isPeak = item.sales === peakHour.sales;
          const heightPercent = (item.sales / maxSales) * 100;

          return (
            <div
              key={index}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                position: "relative",
              }}
            >
              {isPeak && (
                <div
                  style={{
                    position: "absolute",
                    top: "-24px",
                    backgroundColor: "#FEF3C7",
                    color: "#92400E",
                    fontSize: "10px",
                    fontWeight: "700",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    whiteSpace: "nowrap",
                  }}
                >
                  🔥 PEAK
                </div>
              )}
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: colors.bg,
                  marginBottom: "4px",
                }}
              >
                ${item.sales.toFixed(0)}
              </div>
              <div
                style={{
                  width: "100%",
                  height: `${heightPercent}%`,
                  backgroundColor: colors.bg,
                  borderRadius: "8px 8px 0 0",
                  transition: "all 0.3s ease",
                  boxShadow: isPeak
                    ? "0 0 20px rgba(30, 64, 175, 0.5)"
                    : "0 2px 4px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  minHeight: "20px",
                }}
                title={`${item.hour}: $${item.sales.toFixed(2)}`}
              />
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "#6B7280",
                  marginTop: "8px",
                  transform: "rotate(-45deg)",
                  transformOrigin: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {item.hour}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "24px",
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
            🔥 PEAK HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            {peakHour.hour}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
            ${peakHour.sales.toFixed(0)}
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
            💰 TOTAL SALES
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            ${totalSales.toFixed(0)}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
            Across {data.length} hours
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
            📊 AVG PER HOUR
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#1E40AF" }}
          >
            ${(totalSales / data.length).toFixed(0)}
          </div>
          <div style={{ fontSize: "14px", color: "#1E40AF", marginTop: "2px" }}>
            Per labor hour
          </div>
        </div>
      </div>
    </div>
  );
};

// Component for day-of-week view with seven stacked charts
const DayOfWeekCharts = ({ data }: { data: Record<string, any>[] }) => {
  if (!data || data.length === 0) return null;

  // Calculate max sales across all days for consistent scaling
  const maxSales = Math.max(
    ...data.flatMap((day) => (day.hourly_data || []).map((h: any) => h.sales)),
    1
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {data.map((dayData, dayIndex) => {
        if (!dayData.hourly_data || dayData.hourly_data.length === 0) {
          return null;
        }

        const isWeekend =
          dayData.day_of_week === "Saturday" ||
          dayData.day_of_week === "Sunday";
        const peakHour = dayData.hourly_data.reduce(
          (max: any, item: any) => (item.sales > max.sales ? item : max),
          dayData.hourly_data[0]
        );

        return (
          <div
            key={dayIndex}
            style={{
              marginBottom: "16px",
            }}
          >
            {/* Day name - simple label */}
            <div style={{ marginBottom: "8px" }}>
              <h4
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                {dayData.day_of_week}
              </h4>
            </div>

            {/* Chart section */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                height: "220px",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "10px",
                background: isWeekend
                  ? "linear-gradient(to bottom, #faf5ff, #f3e8ff)"
                  : "#ffffff",
                borderRadius: "0 0 12px 12px",
                padding: "20px 8px 10px 8px",
              }}
            >
              {dayData.hourly_data.map((item: any, index: number) => {
                const minBarHeight = 8;
                const maxBarHeight = 180;
                const barHeight =
                  minBarHeight +
                  (item.sales / maxSales) * (maxBarHeight - minBarHeight);
                const isPeak = item.sales === peakHour.sales;
                const intensity = item.sales / maxSales;

                let barColor;
                if (intensity > 0.8) barColor = "#1E40AF";
                else if (intensity > 0.6) barColor = "#2563EB";
                else if (intensity > 0.4) barColor = "#3B82F6";
                else if (intensity > 0.2) barColor = "#60A5FA";
                else barColor = "#BFDBFE";

                return (
                  <div
                    key={index}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      borderRadius: "6px",
                      padding: "4px 2px",
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                    }}
                  >
                    {isPeak && (
                      <div
                        style={{
                          fontSize: "10px",
                          marginBottom: "2px",
                        }}
                      >
                        🔥
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        fontWeight: "600",
                        marginBottom: "2px",
                      }}
                    >
                      ${item.sales.toFixed(0)}
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: `${barHeight}px`,
                        background: `linear-gradient(to top, ${barColor} 0%, ${barColor}dd 100%)`,
                        borderRadius: "6px 6px 0 0",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                        transition: "all 0.3s ease",
                        position: "relative",
                        overflow: "hidden",
                      }}
                      title={`${item.hour}: $${item.sales.toFixed(2)}`}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          height: "40%",
                          background:
                            "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)",
                          borderRadius: "6px 6px 0 0",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: "9px",
                        color: "#94a3b8",
                        marginTop: "2px",
                        fontWeight: "500",
                      }}
                    >
                      {item.hour.split(":")[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function SalesPerHour() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("average");

  // Get dates from global context
  const { startDate, endDate } = useDateRange();

  // Format date for display
  const formatDate = (dateStr: string) => {
    // Parse date string as local date to avoid timezone shift
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
      const response = await getSalesPerHour(startDate, endDate, viewMode);
      setData(response.data);
      if (response.metadata) {
        setMetadata(response.metadata);
      }
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load data when dates or view mode change
  useEffect(() => {
    loadData();
  }, [startDate, endDate, viewMode]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  if (data.length === 0) {
    return <div className="p-6 text-gray-500">No data for this period</div>;
  }

  return (
    <div className="p-6">
      {/* Header with title and toggle */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-700">
            {viewMode === "average"
              ? "Average hourly pattern"
              : "Day-of-week hourly pattern"}
            :{" "}
            {startDate === endDate
              ? formatDate(startDate)
              : `${formatDate(startDate)} - ${formatDate(endDate)}`}
          </h3>
        </div>

        {/* Toggle buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode("average")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              viewMode === "average"
                ? "bg-emerald-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Overall Average
          </button>
          <button
            onClick={() => setViewMode("day-of-week")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              viewMode === "day-of-week"
                ? "bg-emerald-500 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            By Day of Week
          </button>
        </div>

        {metadata && metadata.missing_days > 0 && viewMode === "average" && (
          <p className="text-sm text-gray-600 mb-4">
            Note: Missing data for {metadata.missing_days} day
            {metadata.missing_days > 1 ? "s" : ""} in range.
          </p>
        )}
      </div>

      {/* Render appropriate view */}
      {viewMode === "average" ? (
        <SalesChart data={data} />
      ) : (
        <DayOfWeekCharts data={data} />
      )}
    </div>
  );
}
