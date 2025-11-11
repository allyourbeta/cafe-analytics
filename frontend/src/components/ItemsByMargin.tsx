import { useState, useEffect } from "react";
import { getItemsByMargin } from "../utils/api";
import { getCategoryColor } from "../utils/categoryColors";
import { formatCurrency } from "../utils/formatters";

const columns = [
  {
    key: "item_name",
    label: "Item",
    align: "left" as const,
    format: (val: string | number, row?: any) =>
      row?.item_id ? `${row.item_id} - ${val}` : val,
  },
  { key: "category", label: "Category", align: "left" as const },
  {
    key: "current_price",
    label: "Price",
    align: "right" as const,
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "current_cost",
    label: "Cost",
    align: "right" as const,
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "profit_per_unit",
    label: "Profit/Unit",
    align: "right" as const,
    format: (val: number | string) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right" as const,
    format: (val: number | string) => `${Number(val).toFixed(1)}%`,
  },
];

// Horizontal bar chart for margin %
const MarginChart = ({
  data,
  sortOrder,
  setSortOrder,
  itemTypeFilter,
  setItemTypeFilter,
}: {
  data: Record<string, any>[];
  sortOrder: "top" | "bottom";
  setSortOrder: (order: "top" | "bottom") => void;
  itemTypeFilter: "all" | "purchased" | "house-made";
  setItemTypeFilter: (filter: "all" | "purchased" | "house-made") => void;
}) => {
  const displayData =
    sortOrder === "top" ? data.slice(0, 10) : data.slice(-10).reverse();

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      {/* Header with title and toggles */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
            Items by Profit Margin %
          </h3>

          {/* Item Type Filter (All / Resold / Made) */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              backgroundColor: "#E5E7EB",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            <button
              onClick={() => setItemTypeFilter("all")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  itemTypeFilter === "all" ? "#8B5CF6" : "transparent",
                color: itemTypeFilter === "all" ? "#FFFFFF" : "#6B7280",
              }}
            >
              All
            </button>
            <button
              onClick={() => setItemTypeFilter("purchased")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  itemTypeFilter === "purchased" ? "#8B5CF6" : "transparent",
                color: itemTypeFilter === "purchased" ? "#FFFFFF" : "#6B7280",
              }}
            >
              Resold
            </button>
            <button
              onClick={() => setItemTypeFilter("house-made")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  itemTypeFilter === "house-made" ? "#8B5CF6" : "transparent",
                color: itemTypeFilter === "house-made" ? "#FFFFFF" : "#6B7280",
              }}
            >
              Made
            </button>
          </div>

          {/* Top/Bottom toggle */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              backgroundColor: "#E5E7EB",
              padding: "4px",
              borderRadius: "6px",
            }}
          >
            <button
              onClick={() => setSortOrder("top")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  sortOrder === "top" ? "#3B82F6" : "transparent",
                color: sortOrder === "top" ? "#FFFFFF" : "#6B7280",
              }}
            >
              Top 10
            </button>
            <button
              onClick={() => setSortOrder("bottom")}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                fontWeight: "600",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                transition: "all 0.2s",
                backgroundColor:
                  sortOrder === "bottom" ? "#3B82F6" : "transparent",
                color: sortOrder === "bottom" ? "#FFFFFF" : "#6B7280",
              }}
            >
              Bottom 10
            </button>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {displayData.map((item, index) => {
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div
                style={{
                  width: "160px",
                  fontSize: "14px",
                  fontWeight: "500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.item_name}
              </div>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#f3f4f6",
                  borderRadius: "4px",
                  height: "32px",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${item.margin_pct}%`,
                    height: "100%",
                    backgroundColor: getCategoryColor(item.category),
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
                    {item.margin_pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function ItemsByMargin() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"top" | "bottom">("top");
  const [itemTypeFilter, setItemTypeFilter] = useState<
    "all" | "purchased" | "house-made"
  >("all");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getItemsByMargin(itemTypeFilter);
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
  }, [itemTypeFilter]);

  // Sort data based on sortOrder (reverse for bottom 10 in table)
  const sortedData = sortOrder === "top" ? data : [...data].reverse();

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 p-3 rounded">{error}</div>
    );
  }

  if (data.length === 0) {
    return <div className="p-6 text-gray-500">No data available</div>;
  }

  return (
    <div>
      {/* Chart with inline controls */}
      <MarginChart
        data={data}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        itemTypeFilter={itemTypeFilter}
        setItemTypeFilter={setItemTypeFilter}
      />

      {/* Data table */}
      <div className="mt-6 overflow-x-auto">
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
            {sortedData.map((row, i) => (
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
        <div className="mt-2 text-sm text-gray-600">
          Total rows: {data.length}
        </div>
      </div>
    </div>
  );
}
