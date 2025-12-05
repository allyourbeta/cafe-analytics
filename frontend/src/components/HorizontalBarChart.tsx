import {
  getCategoryColor,
  getCategoryDisplayName,
} from "../utils/categoryColors";
import { formatCurrency } from "../utils/formatters";

export interface BarChartItem {
  label: string;
  value: number;
  category?: string;
}

export interface HorizontalBarChartProps {
  /** Array of items to display as bars */
  data: BarChartItem[];
  /** Title displayed above the chart */
  title: string;
  /** Format function for the value displayed on the bar */
  formatValue?: (value: number) => string;
  /** Whether to use category colors (default: true) */
  useCategoryColors?: boolean;
  /** Fixed color to use if not using category colors */
  barColor?: string;
  /** Width of the label column in pixels (default: 160) */
  labelWidth?: number;
}

/**
 * Reusable horizontal bar chart component.
 * Used by ItemsByRevenue, ItemsByProfit, and ItemsByMargin reports.
 */
export default function HorizontalBarChart({
  data,
  title,
  formatValue = (v) => formatCurrency(v, 0),
  useCategoryColors = true,
  barColor = "#3B82F6",
  labelWidth = 160,
}: HorizontalBarChartProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div
      style={{
        padding: "20px",
        backgroundColor: "white",
        borderRadius: "8px",
      }}
    >
      {/* Title */}
      {title && (
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "600",
            margin: 0,
            marginBottom: "20px",
          }}
        >
          {title}
        </h3>
      )}

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {data.map((item, index) => {
          const widthPercent = (item.value / maxValue) * 100;
          const color =
            useCategoryColors && item.category
              ? getCategoryColor(item.category)
              : barColor;

          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              {/* Label */}
              <div
                style={{
                  width: `${labelWidth}px`,
                  fontSize: "14px",
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={item.label}
              >
                {item.label}
              </div>

              {/* Bar track */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  borderRadius: "4px",
                  height: "32px",
                  position: "relative",
                }}
              >
                {/* Bar fill */}
                <div
                  style={{
                    width: `${widthPercent}%`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "8px",
                    transition: "width 0.3s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "white",
                    }}
                  >
                    {formatValue(item.value)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Helper to transform report data into BarChartItem format.
 * Handles both item view (with item_name) and category view.
 */
export function toBarChartItems(
  data: Record<string, any>[],
  valueKey: string,
  viewMode: "item" | "category" = "item"
): BarChartItem[] {
  return data.map((row) => ({
    label:
      viewMode === "category"
        ? getCategoryDisplayName(row.category)
        : row.item_name,
    value: row[valueKey],
    category: row.category,
  }));
}
