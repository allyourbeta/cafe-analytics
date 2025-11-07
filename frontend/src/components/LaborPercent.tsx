import ReportLayout, { type Column } from "./ReportLayout";
import { getLaborPercent } from "../utils/api";
import { useDateRange } from "../context/DateContext";
import React from "react";

const columns: Column[] = [
  { key: "hour", label: "Hour", align: "left" },
  {
    key: "sales",
    label: "Sales",
    align: "right",
    format: (val) => `${Number(val).toFixed(1)}%`,
  },
  {
    key: "labor_cost",
    label: "Labor Cost",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "labor_pct",
    label: "Labor %",
    align: "right",
    format: (val) => `${Number(val).toFixed(1)}%`,
  },
];

// Stoplight gauge system - instant visual labor cost control
const LaborChart = ({
  data,
  includeSalaried,
  setIncludeSalaried,
}: {
  data: Record<string, any>[];
  includeSalaried: boolean;
  setIncludeSalaried: (value: boolean) => void;
}) => {
  const [target, setTarget] = React.useState(30);
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempTarget, setTempTarget] = React.useState("30");
  const [hoveredItem, setHoveredItem] = React.useState<Record<
    string,
    any
  > | null>(null);

  // Get stoplight color based on performance vs target
  const getStoplightStatus = (laborPct: number) => {
    if (laborPct <= target) {
      return { bg: "#10B981", text: "#FFFFFF", icon: "", label: "GOOD" }; // Green - under target
    } else if (laborPct <= target * 1.1) {
      return { bg: "#F59E0B", text: "#FFFFFF", icon: "", label: "CAUTION" }; // Yellow - slightly over
    } else {
      return { bg: "#EF4444", text: "#FFFFFF", icon: "", label: "OVER" }; // Red - way over
    }
  };

  const handleTargetChange = (value: string) => {
    setTempTarget(value);
    const newTarget = parseInt(value);
    // Apply immediately if valid
    if (newTarget >= 1 && newTarget <= 100) {
      setTarget(newTarget);
      // TODO: Save to backend/localStorage
    }
  };

  const handleTargetBlur = () => {
    // Validate on blur and revert if invalid
    const newTarget = parseInt(tempTarget);
    if (newTarget < 1 || newTarget > 100 || isNaN(newTarget)) {
      setTempTarget(target.toString());
    }
    setIsEditing(false);
  };

  // Calculate weighted average: total labor cost / total sales
  // This is the true labor % (not simple average of percentages)
  const totalLaborCost = data.reduce((sum, item) => sum + item.labor_cost, 0);
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const avgLabor = totalSales > 0 ? (totalLaborCost / totalSales) * 100 : 0;
  const underTargetCount = data.filter(
    (item) => item.labor_pct <= target
  ).length;
  const overTargetCount = data.filter(
    (item) => item.labor_pct > target * 1.1
  ).length;

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: "white",
        borderRadius: "12px",
      }}
    >
      {/* Header with editable target and toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            fontSize: "18px",
            fontWeight: "700",
            color: "#111827",
            margin: 0,
          }}
        >
          Labor % by Hour
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "14px", color: "#6B7280" }}>(Target:</span>
          {isEditing ? (
            <input
              type="number"
              value={tempTarget}
              onChange={(e) => handleTargetChange(e.target.value)}
              onBlur={handleTargetBlur}
              onKeyDown={(e) => e.key === "Enter" && handleTargetBlur()}
              autoFocus
              min="1"
              max="100"
              style={{
                width: "50px",
                padding: "4px 8px",
                fontSize: "14px",
                fontWeight: "600",
                border: "2px solid #3B82F6",
                borderRadius: "4px",
                textAlign: "center",
                outline: "none",
              }}
            />
          ) : (
            <span
              onClick={() => {
                setIsEditing(true);
                setTempTarget(target.toString());
              }}
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#3B82F6",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "4px",
                backgroundColor: "#EFF6FF",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#DBEAFE")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#EFF6FF")
              }
            >
              {target}%
            </span>
          )}
          {!isEditing && (
            <span
              onClick={() => {
                setIsEditing(true);
                setTempTarget(target.toString());
              }}
              style={{ fontSize: "14px", color: "#9CA3AF", cursor: "pointer" }}
            >
              ✎
            </span>
          )}
          <span style={{ fontSize: "14px", color: "#6B7280" }}>)</span>
        </div>

        {/* Toggle for Salaried+Students vs Students-only */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginLeft: "auto",
            backgroundColor: "#F3F4F6",
            padding: "4px",
            borderRadius: "8px",
          }}
        >
          <button
            onClick={() => setIncludeSalaried(true)}
            style={{
              padding: "6px 12px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: includeSalaried ? "#3B82F6" : "transparent",
              color: includeSalaried ? "#FFFFFF" : "#6B7280",
            }}
          >
            Salaried+Students
          </button>
          <button
            onClick={() => setIncludeSalaried(false)}
            style={{
              padding: "6px 12px",
              fontSize: "14px",
              fontWeight: "600",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              transition: "all 0.2s",
              backgroundColor: !includeSalaried ? "#3B82F6" : "transparent",
              color: !includeSalaried ? "#FFFFFF" : "#6B7280",
            }}
          >
            Students-only
          </button>
        </div>
      </div>

      {/* Stoplight gauge blocks - grouped by day */}
      <div style={{ marginBottom: "24px" }}>
        {(() => {
          // Group data by date
          const groupedByDate: Record<string, typeof data> = {};
          data.forEach((item) => {
            const date = item.hour.split(" ")[0]; // Extract date (YYYY-MM-DD)
            if (!groupedByDate[date]) {
              groupedByDate[date] = [];
            }
            groupedByDate[date].push(item);
          });

          return Object.entries(groupedByDate).map(([date, dayData]) => (
            <div key={date} style={{ marginBottom: "20px" }}>
              {/* Date header */}
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "#374151",
                  marginBottom: "8px",
                  paddingBottom: "4px",
                  borderBottom: "2px solid #E5E7EB",
                }}
              >
                {(() => {
                  // Parse date string as local date to avoid timezone shift
                  const [year, month, day] = date.split("-").map(Number);
                  const localDate = new Date(year, month - 1, day);
                  return localDate.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                })()}
              </div>

              {/* Hours for this day */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: "8px",
                  position: "relative",
                }}
              >
                {dayData.map((item, index) => {
                  const status = getStoplightStatus(item.labor_pct);
                  const isHovered = hoveredItem?.hour === item.hour;
                  const hourTime = new Date(item.hour).toLocaleTimeString(
                    "en-US",
                    {
                      hour: "numeric",
                      hour12: true,
                    }
                  );

                  return (
                    <div
                      key={index}
                      style={{
                        backgroundColor: status.bg,
                        color: status.text,
                        padding: "16px 8px",
                        borderRadius: "8px",
                        textAlign: "center",
                        boxShadow: isHovered
                          ? "0 4px 12px rgba(0,0,0,0.2)"
                          : "0 2px 4px rgba(0,0,0,0.1)",
                        transition: "all 0.2s",
                        cursor: "pointer",
                        position: "relative",
                        transform: isHovered ? "scale(1.05)" : "scale(1)",
                      }}
                      onMouseEnter={() => setHoveredItem(item)}
                      onMouseLeave={() => setHoveredItem(null)}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          marginBottom: "8px",
                        }}
                      >
                        {hourTime}
                      </div>
                      <div
                        style={{
                          fontSize: "22px",
                          fontWeight: "700",
                          marginBottom: "4px",
                        }}
                      >
                        {item.labor_pct.toFixed(1)}%
                      </div>
                      <div style={{ fontSize: "18px" }}>{status.icon}</div>

                      {/* Tooltip */}
                      {isHovered && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "100%",
                            left: "50%",
                            transform: "translateX(-50%)",
                            marginBottom: "8px",
                            backgroundColor: "#1F2937",
                            color: "#FFFFFF",
                            padding: "12px 16px",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                            whiteSpace: "nowrap",
                            fontSize: "13px",
                            lineHeight: "1.6",
                            zIndex: 1000,
                            pointerEvents: "none",
                          }}
                        >
                          {/* Arrow pointing down */}
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: "50%",
                              transform: "translateX(-50%)",
                              width: 0,
                              height: 0,
                              borderLeft: "6px solid transparent",
                              borderRight: "6px solid transparent",
                              borderTop: "6px solid #1F2937",
                            }}
                          />

                          {/* Time slot header - show as range (e.g., 0700-0800) */}
                          <div
                            style={{
                              fontWeight: "700",
                              marginBottom: "8px",
                              fontSize: "13px",
                            }}
                          >
                            {(() => {
                              const hourDate = new Date(item.hour);
                              const startHour =
                                hourDate
                                  .getHours()
                                  .toString()
                                  .padStart(2, "0") + "00";
                              const endHour =
                                ((hourDate.getHours() + 1) % 24)
                                  .toString()
                                  .padStart(2, "0") + "00";
                              return `${startHour}-${endHour}`;
                            })()}
                          </div>

                          <div
                            style={{ marginBottom: "4px", fontSize: "13px" }}
                          >
                            <strong>Revenue:</strong> ${item.sales.toFixed(2)}
                          </div>
                          <div
                            style={{
                              marginBottom: "8px",
                              color: "#FCA5A5",
                              fontSize: "13px",
                            }}
                          >
                            <strong>Labor Cost:</strong> $
                            {item.labor_cost.toFixed(2)} (
                            {item.labor_pct.toFixed(1)}%)
                          </div>

                          {/* Always show salaried when in "Salaried+Students" mode, even if 0 */}
                          {includeSalaried && (
                            <div
                              style={{
                                marginBottom: "4px",
                                fontSize: "13px",
                                color: "#D1D5DB",
                              }}
                            >
                              Salaried: {item.salaried_hours.toFixed(1)} hrs = $
                              {item.salaried_cost.toFixed(2)}
                            </div>
                          )}

                          <div style={{ fontSize: "13px", color: "#D1D5DB" }}>
                            Students: {item.student_hours.toFixed(1)} hrs = $
                            {item.student_cost.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#F0FDF4",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #BBF7D0",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#166534",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            ✓ UNDER TARGET
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#166534" }}
          >
            {underTargetCount}
          </div>
          <div style={{ fontSize: "14px", color: "#166534", marginTop: "2px" }}>
            hours on track
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#FEF3C7",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #FDE68A",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#92400E",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            📊 AVERAGE
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#92400E" }}
          >
            {avgLabor.toFixed(1)}%
          </div>
          <div style={{ fontSize: "14px", color: "#92400E", marginTop: "2px" }}>
            across all hours
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#FEE2E2",
            padding: "16px",
            borderRadius: "8px",
            border: "2px solid #FECACA",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              color: "#991B1B",
              fontWeight: "600",
              marginBottom: "4px",
            }}
          >
            ✗ OVER TARGET
          </div>
          <div
            style={{ fontSize: "24px", fontWeight: "700", color: "#991B1B" }}
          >
            {overTargetCount}
          </div>
          <div style={{ fontSize: "14px", color: "#991B1B", marginTop: "2px" }}>
            hours overstaffed
          </div>
        </div>
      </div>
    </div>
  );
};

export default function LaborPercent() {
  const { startDate, endDate } = useDateRange(); // Use global date context
  const [data, setData] = React.useState<Record<string, any>[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [includeSalaried, setIncludeSalaried] = React.useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getLaborPercent(
        startDate,
        endDate,
        includeSalaried
      );
      if (response.success) {
        setData(response.data || []);
      } else {
        setError(response.error || "Failed to fetch data");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [startDate, endDate, includeSalaried]);

  return (
    <div style={{ padding: "24px" }}>
      {loading && (
        <div style={{ textAlign: "center", padding: "48px" }}>Loading...</div>
      )}
      {error && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            color: "#991B1B",
          }}
        >
          Error: {error}
        </div>
      )}
      {!loading && !error && data.length > 0 && (
        <LaborChart
          data={data}
          includeSalaried={includeSalaried}
          setIncludeSalaried={setIncludeSalaried}
        />
      )}
      {!loading && !error && data.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px", color: "#6B7280" }}>
          No data available for the selected date range
        </div>
      )}
    </div>
  );
}
