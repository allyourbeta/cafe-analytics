import ReportLayout, { type Column } from "./ReportLayout";
import { getLaborPercent } from "../utils/api";

const columns: Column[] = [
  { key: "hour", label: "Hour", align: "left" },
  {
    key: "sales",
    label: "Sales",
    align: "right",
    format: (val) => `$${Number(val).toFixed(2)}`,
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

// Line chart with threshold zone
const LaborChart = ({ data }: { data: Record<string, any>[] }) => {
  const maxPct = Math.max(...data.map((item) => item.labor_pct), 35);
  const threshold = 30;

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        Labor % by Hour (Target: 30%)
      </h3>
      <div
        style={{
          position: "relative",
          height: "250px",
          borderLeft: "2px solid #e5e7eb",
          borderBottom: "2px solid #e5e7eb",
          paddingLeft: "10px",
        }}
      >
        {/* Threshold zone */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: `${(threshold / maxPct) * 100}%`,
            height: "1px",
            borderTop: "2px dashed #10b981",
            zIndex: 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              right: "10px",
              top: "-10px",
              fontSize: "11px",
              color: "#10b981",
              fontWeight: "600",
            }}
          >
            30% Target
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: "100%",
            gap: "8px",
            position: "relative",
          }}
        >
          {data.map((item, index) => {
            const heightPercent = (item.labor_pct / maxPct) * 100;
            const isOverBudget = item.labor_pct > threshold;
            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "4px",
                    height: `${heightPercent}%`,
                    backgroundColor: isOverBudget ? "#ef4444" : "#06b6d4",
                    borderRadius: "2px",
                    position: "relative",
                    minHeight: "4px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "-20px",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: "10px",
                      color: isOverBudget ? "#ef4444" : "#06b6d4",
                      fontWeight: "600",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.labor_pct.toFixed(1)}%
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "#9ca3af",
                    marginTop: "6px",
                  }}
                >
                  {item.hour}
                </div>
              </div>
            );
          })}
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
