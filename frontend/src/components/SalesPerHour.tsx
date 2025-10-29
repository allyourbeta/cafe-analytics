import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getSalesPerHour } from "../utils/api";

// Vertical bar chart - visual magnitude representation
const SalesChart = ({ data }: { data: Record<string, any>[] }) => {
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
                  fontSize: "11px",
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

export default function SalesPerHour() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  // Get dates from global context
  const { startDate, endDate } = useDateRange();

  // Format date for display
  const formatDate = (dateStr: string) => {
    // Parse date string as local date to avoid timezone shift
    const [year, month, day] = dateStr.split('-').map(Number);
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
      const response = await getSalesPerHour(startDate, endDate, 'average');
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

  // Load data when dates change
  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>;
  }

  if (data.length === 0) {
    return <div className="p-6 text-gray-500">No data for this period</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Average hourly pattern: {startDate === endDate
            ? formatDate(startDate)
            : `${formatDate(startDate)} - ${formatDate(endDate)}`}
        </h3>
        {metadata && metadata.missing_days > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            Note: Missing data for {metadata.missing_days} day{metadata.missing_days > 1 ? 's' : ''} in range.
          </p>
        )}
      </div>

      <SalesChart data={data} />
    </div>
  );
}