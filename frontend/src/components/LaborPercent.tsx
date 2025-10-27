import ReportLayout, { type Column } from "./ReportLayout";
import { getLaborPercent } from "../utils/api";
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
const LaborChart = ({ data }: { data: Record<string, any>[] }) => {
  const [target, setTarget] = React.useState(30);
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempTarget, setTempTarget] = React.useState("30");

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

  const avgLabor =
    data.reduce((sum, item) => sum + item.labor_pct, 0) / data.length;
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
      {/* Header with editable target */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
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
      </div>

      {/* Stoplight gauge blocks */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
          gap: "8px",
          marginBottom: "24px",
        }}
      >
        {data.map((item, index) => {
          const status = getStoplightStatus(item.labor_pct);
          return (
            <div
              key={index}
              style={{
                backgroundColor: status.bg,
                color: status.text,
                padding: "16px 8px",
                borderRadius: "8px",
                textAlign: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                transition: "transform 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.05)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  marginBottom: "8px",
                }}
              >
                {item.hour}
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: "700",
                  marginBottom: "4px",
                }}
              >
                {item.labor_pct.toFixed(1)}%
              </div>
              <div style={{ fontSize: "18px" }}>{status.icon}</div>
            </div>
          );
        })}
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
  return (
    <ReportLayout
      title="Labor % per Labor Hour"
      fetchData={getLaborPercent}
      columns={columns}
      needsDateRange={true}
      ChartComponent={LaborChart}
    />
  );
}
