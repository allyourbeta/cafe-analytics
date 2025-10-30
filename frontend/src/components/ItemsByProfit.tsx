import { useState, useEffect } from "react";
import { useDateRange } from "../context/DateContext";
import { getItemsByProfit } from "../utils/api";
import { getCategoryColor, getCategoryDisplayName, ALL_CATEGORIES } from "../utils/categoryColors";

const columns = [
  { key: "item_name", label: "Item", align: "left" as const },
  { key: "category", label: "Category", align: "left" as const },
  { key: "units_sold", label: "Units", align: "right" as const },
  {
    key: "total_profit",
    label: "Total Profit",
    align: "right" as const,
    format: (val: number) => `$${Number(val).toFixed(2)}`,
  },
  {
    key: "margin_pct",
    label: "Margin %",
    align: "right" as const,
    format: (val: number) => `${Number(val).toFixed(1)}%`,
  },
];

// Horizontal bar chart by category
const ProfitChart = ({ data }: { data: Record<string, any>[] }) => {
  const top10 = data.slice(0, 10);
  const maxProfit = Math.max(...top10.map((item) => item.total_profit));

  return (
    <div
      style={{ padding: "20px", backgroundColor: "white", borderRadius: "8px" }}
    >
      <h3 style={{ marginBottom: "20px", fontSize: "16px", fontWeight: "600" }}>
        Top 10 Items by Total Profit
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {top10.map((item, index) => {
          const widthPercent = (item.total_profit / maxProfit) * 100;
          return (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <div
                style={{
                  width: "120px",
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
                    width: `${widthPercent}%`,
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
                    ${item.total_profit.toFixed(0)}
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

export default function ItemsByProfit() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { startDate, endDate } = useDateRange();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getItemsByProfit(startDate, endDate);
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
  }, [startDate, endDate]);

  // Filter data by selected category
  const filteredData = selectedCategory === "all"
    ? data
    : data.filter(item => item.category === selectedCategory);

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
      {/* Title with category filter */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Items by Profit $$</h2>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          <option value="all">All Categories</option>
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {getCategoryDisplayName(cat)}
            </option>
          ))}
        </select>
      </div>

      {/* Chart */}
      <ProfitChart data={filteredData} />

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
            {filteredData.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`border border-gray-300 px-4 py-2 ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {col.format ? col.format(row[col.key]) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-sm text-gray-600">
          Total rows: {filteredData.length}
        </div>
      </div>
    </div>
  );
}