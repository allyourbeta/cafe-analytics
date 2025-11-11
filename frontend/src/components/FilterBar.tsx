import CategoryDropdown from "./CategoryDropdown";

export interface FilterValues {
  itemType?: "all" | "purchased" | "house-made";
  sortOrder?: "top" | "bottom";
  viewMode?: "item" | "category";
  selectedCategory?: string;
}

interface ToggleButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  color: string;
}

const ToggleButton = ({
  label,
  isActive,
  onClick,
  color,
}: ToggleButtonProps) => (
  <button
    onClick={onClick}
    style={{
      padding: "6px 12px",
      fontSize: "13px",
      fontWeight: "600",
      border: "none",
      borderRadius: "4px",
      cursor: "pointer",
      transition: "all 0.2s",
      backgroundColor: isActive ? color : "transparent",
      color: isActive ? "#FFFFFF" : "#6B7280",
    }}
  >
    {label}
  </button>
);

interface FilterBarProps {
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  enabledFilters: Array<"itemType" | "sortOrder" | "viewMode" | "category">;
  showCategoryDropdown?: boolean;
}

export default function FilterBar({
  filters,
  onFilterChange,
  enabledFilters,
  showCategoryDropdown = false,
}: FilterBarProps) {
  const updateFilter = (key: keyof FilterValues, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap",
      }}
    >
      {/* View Mode Toggle (By Item / By Category) */}
      {enabledFilters.includes("viewMode") && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "#E5E7EB",
            padding: "4px",
            borderRadius: "6px",
          }}
        >
          <ToggleButton
            label="By Item"
            isActive={filters.viewMode === "item"}
            onClick={() => updateFilter("viewMode", "item")}
            color="#10B981"
          />
          <ToggleButton
            label="By Category"
            isActive={filters.viewMode === "category"}
            onClick={() => updateFilter("viewMode", "category")}
            color="#10B981"
          />
        </div>
      )}

      {/* Item Type Filter (All / Resold / Made) */}
      {enabledFilters.includes("itemType") && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "#E5E7EB",
            padding: "4px",
            borderRadius: "6px",
          }}
        >
          <ToggleButton
            label="All"
            isActive={filters.itemType === "all"}
            onClick={() => updateFilter("itemType", "all")}
            color="#8B5CF6"
          />
          <ToggleButton
            label="Resold"
            isActive={filters.itemType === "purchased"}
            onClick={() => updateFilter("itemType", "purchased")}
            color="#8B5CF6"
          />
          <ToggleButton
            label="Made"
            isActive={filters.itemType === "house-made"}
            onClick={() => updateFilter("itemType", "house-made")}
            color="#8B5CF6"
          />
        </div>
      )}

      {/* Top/Bottom Toggle */}
      {enabledFilters.includes("sortOrder") && (
        <div
          style={{
            display: "flex",
            gap: "4px",
            backgroundColor: "#E5E7EB",
            padding: "4px",
            borderRadius: "6px",
          }}
        >
          <ToggleButton
            label="Top 10"
            isActive={filters.sortOrder === "top"}
            onClick={() => updateFilter("sortOrder", "top")}
            color="#3B82F6"
          />
          <ToggleButton
            label="Bottom 10"
            isActive={filters.sortOrder === "bottom"}
            onClick={() => updateFilter("sortOrder", "bottom")}
            color="#3B82F6"
          />
        </div>
      )}

      {/* Category Dropdown */}
      {showCategoryDropdown && (
        <div style={{ opacity: filters.viewMode === "category" ? 0.5 : 1 }}>
          <CategoryDropdown
            value={filters.selectedCategory || "all"}
            onChange={(cat) => updateFilter("selectedCategory", cat)}
            disabled={filters.viewMode === "category"}
          />
        </div>
      )}
    </div>
  );
}
