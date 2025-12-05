import type { ReactNode } from "react";

export type SummaryCardVariant = "blue" | "green" | "yellow" | "red";

export interface SummaryCardProps {
  /** Icon and label displayed at the top (e.g., "🔥 PEAK HOUR") */
  label: string;
  /** Main value displayed prominently */
  value: ReactNode;
  /** Subtitle displayed below the value */
  subtitle?: string;
  /** Color variant */
  variant?: SummaryCardVariant;
}

const variantStyles: Record<
  SummaryCardVariant,
  { bg: string; border: string; text: string }
> = {
  blue: {
    bg: "#DBEAFE",
    border: "#BFDBFE",
    text: "#1E40AF",
  },
  green: {
    bg: "#F0FDF4",
    border: "#BBF7D0",
    text: "#166534",
  },
  yellow: {
    bg: "#FEF3C7",
    border: "#FDE68A",
    text: "#92400E",
  },
  red: {
    bg: "#FEE2E2",
    border: "#FECACA",
    text: "#991B1B",
  },
};

/**
 * Reusable summary card component for displaying key metrics.
 * Used in SalesPerHour, LaborPercent, and other reports.
 */
export default function SummaryCard({
  label,
  value,
  subtitle,
  variant = "blue",
}: SummaryCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      style={{
        backgroundColor: styles.bg,
        padding: "16px",
        borderRadius: "8px",
        border: `2px solid ${styles.border}`,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          color: styles.text,
          fontWeight: "600",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "24px",
          fontWeight: "700",
          color: styles.text,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: "14px",
            color: styles.text,
            marginTop: "2px",
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

export interface SummaryCardGridProps {
  children: ReactNode;
  /** Minimum width of each card (default: 200px) */
  minCardWidth?: number;
}

/**
 * Grid container for summary cards with responsive layout.
 */
export function SummaryCardGrid({
  children,
  minCardWidth = 200,
}: SummaryCardGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minCardWidth}px, 1fr))`,
        gap: "16px",
        marginTop: "24px",
      }}
    >
      {children}
    </div>
  );
}
