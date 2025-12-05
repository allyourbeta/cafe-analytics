export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
  format?: (value: any, row?: Record<string, any>) => string | number;
}

export interface DataTableProps {
  /** Array of data rows to display */
  data: Record<string, any>[];
  /** Column definitions */
  columns: Column[];
  /** Whether to show the row count footer (default: true) */
  showRowCount?: boolean;
  /** Custom row count label (default: "Total rows") */
  rowCountLabel?: string;
  /** Additional CSS class for the container */
  className?: string;
}

/**
 * Reusable data table component with consistent styling.
 * Used by ItemsByRevenue, ItemsByProfit, and ReportLayout.
 */
export default function DataTable({
  data,
  columns,
  showRowCount = true,
  rowCountLabel = "Total rows",
  className = "",
}: DataTableProps) {
  if (!data || data.length === 0 || columns.length === 0) {
    return null;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`border border-gray-300 px-4 py-2 ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`border border-gray-300 px-4 py-2 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.format ? col.format(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showRowCount && (
        <div className="mt-2 text-sm text-gray-600">
          {rowCountLabel}: {data.length}
        </div>
      )}
    </div>
  );
}
