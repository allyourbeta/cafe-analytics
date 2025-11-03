import { useState, useEffect, useMemo } from "react";
import {
  getItemDemandForecast,
  getCategoryDemandForecast,
  type ItemDemandForecast as ItemForecast,
  type CategoryDemandForecast as CategoryForecast,
} from "../utils/api";
import { Sparkles, Search } from "lucide-react";

type ViewMode = "items" | "categories";
type SortColumn = "name" | "week1" | "week2" | "week3" | "total";
type SortDirection = "asc" | "desc";

const CACHE_KEY_ITEMS = "itemDemandForecast_items";
const CACHE_KEY_CATEGORIES = "itemDemandForecast_categories";
const CACHE_KEY_DATE = "itemDemandForecast_date";

const ItemDemandForecast = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("items");
  const [filterLimit, setFilterLimit] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [itemsData, setItemsData] = useState<ItemForecast[]>([]);
  const [categoriesData, setCategoriesData] = useState<CategoryForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if cache is from today
  const isCacheValid = () => {
    const cachedDate = localStorage.getItem(CACHE_KEY_DATE);
    if (!cachedDate) return false;
    const today = new Date().toDateString();
    return cachedDate === today;
  };

  // Load from cache
  const loadFromCache = (key: string) => {
    if (!isCacheValid()) return null;
    try {
      const cached = localStorage.getItem(key);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Save to cache
  const saveToCache = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem(CACHE_KEY_DATE, new Date().toDateString());
    } catch (e) {
      console.warn("Failed to cache data:", e);
    }
  };

  // Fetch data
  const fetchData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "items") {
        // Check cache first
        const cached = loadFromCache(CACHE_KEY_ITEMS);
        if (!force && cached && cached.length > 0) {
          setItemsData(cached);
          setLoading(false);
          return;
        }

        // Fetch from API
        const result = await getItemDemandForecast();
        if (result.success) {
          setItemsData(result.data);
          saveToCache(CACHE_KEY_ITEMS, result.data);
        } else {
          setError(result.error || "Failed to fetch item forecasts");
        }
      } else {
        // Check cache first
        const cached = loadFromCache(CACHE_KEY_CATEGORIES);
        if (!force && cached && cached.length > 0) {
          setCategoriesData(cached);
          setLoading(false);
          return;
        }

        // Fetch from API
        const result = await getCategoryDemandForecast();
        if (result.success) {
          setCategoriesData(result.data);
          saveToCache(CACHE_KEY_CATEGORIES, result.data);
        } else {
          setError(result.error || "Failed to fetch category forecasts");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when view mode changes
  useEffect(() => {
    fetchData();
  }, [viewMode]);

  // Get current data based on view mode
  const currentData = viewMode === "items" ? itemsData : categoriesData;

  // Calculate max quantity for heatmap coloring
  const maxQuantity = useMemo(() => {
    if (currentData.length === 0) return 1;
    const allQuantities = currentData.flatMap((item) =>
      item.weekly_forecast.map((w) => w.quantity)
    );
    return Math.max(...allQuantities, 1);
  }, [currentData]);

  // Get heatmap color
  const getHeatmapColor = (quantity: number) => {
    if (quantity === 0) return "#f3f4f6";
    const intensity = Math.min(quantity / maxQuantity, 1);
    const r = Math.round(219 + (29 - 219) * intensity);
    const g = Math.round(234 + (78 - 234) * intensity);
    const b = Math.round(254 + (216 - 254) * intensity);
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Filter, search, and sort data
  const processedData = useMemo(() => {
    let filtered = [...currentData];

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter((item) => {
        const name =
          viewMode === "items"
            ? (item as ItemForecast).item_name
            : (item as CategoryForecast).category;
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      });
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortColumn) {
        case "name":
          aVal =
            viewMode === "items"
              ? (a as ItemForecast).item_name
              : (a as CategoryForecast).category;
          bVal =
            viewMode === "items"
              ? (b as ItemForecast).item_name
              : (b as CategoryForecast).category;
          break;
        case "week1":
          aVal = a.weekly_forecast[0].quantity;
          bVal = b.weekly_forecast[0].quantity;
          break;
        case "week2":
          aVal = a.weekly_forecast[1].quantity;
          bVal = b.weekly_forecast[1].quantity;
          break;
        case "week3":
          aVal = a.weekly_forecast[2].quantity;
          bVal = b.weekly_forecast[2].quantity;
          break;
        case "total":
        default:
          aVal = a.total_forecast;
          bVal = b.total_forecast;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    // Apply top N filter
    if (filterLimit !== null) {
      filtered = filtered.slice(0, filterLimit);
    }

    return filtered;
  }, [
    currentData,
    searchTerm,
    sortColumn,
    sortDirection,
    filterLimit,
    viewMode,
  ]);

  // Handle column header click for sorting
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Item Demand Forecast
        </h2>
        <p className="text-sm text-gray-600">
          3-week quantity forecast for inventory planning
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode("items")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === "items"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Items
          </button>
          <button
            onClick={() => setViewMode("categories")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === "categories"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Categories
          </button>
        </div>

        {/* Filter Dropdown */}
        <select
          value={filterLimit || "all"}
          onChange={(e) =>
            setFilterLimit(
              e.target.value === "all" ? null : Number(e.target.value)
            )
          }
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">
            All {viewMode === "items" ? "Items" : "Categories"}
          </option>
          <option value="10">Top 10</option>
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th
                onClick={() => handleSort("name")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                {viewMode === "items" ? "Item Name" : "Category"}
                {renderSortIndicator("name")}
              </th>
              {viewMode === "items" && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
              )}
              <th
                onClick={() => handleSort("week1")}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Week 1{renderSortIndicator("week1")}
              </th>
              <th
                onClick={() => handleSort("week2")}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Week 2{renderSortIndicator("week2")}
              </th>
              <th
                onClick={() => handleSort("week3")}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Week 3{renderSortIndicator("week3")}
              </th>
              <th
                onClick={() => handleSort("total")}
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                Total{renderSortIndicator("total")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td
                  colSpan={viewMode === "items" ? 6 : 5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  Loading forecast data...
                </td>
              </tr>
            ) : processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={viewMode === "items" ? 6 : 5}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  No data available
                </td>
              </tr>
            ) : (
              processedData.map((item, index) => {
                const isItem = viewMode === "items";
                const name = isItem
                  ? (item as ItemForecast).item_name
                  : (item as CategoryForecast).category;
                const category = isItem
                  ? (item as ItemForecast).category
                  : null;

                return (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {item.is_new && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            <Sparkles className="w-3 h-3 mr-1" />
                            NEW
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {name}
                        </span>
                      </div>
                    </td>
                    {isItem && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {category}
                      </td>
                    )}
                    {item.weekly_forecast.map((week) => (
                      <td
                        key={week.week}
                        className="px-6 py-4 whitespace-nowrap text-center"
                      >
                        <span
                          className="inline-block px-3 py-1 rounded-md text-sm font-semibold"
                          style={{
                            backgroundColor: getHeatmapColor(week.quantity),
                            color:
                              week.quantity > maxQuantity * 0.5
                                ? "white"
                                : "#1f2937",
                          }}
                        >
                          {week.quantity} units
                        </span>
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-gray-900">
                        {item.total_forecast} units
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-sm text-gray-600">
        Showing {processedData.length} of {currentData.length}{" "}
        {viewMode === "items" ? "items" : "categories"}
      </div>
    </div>
  );
};

export default ItemDemandForecast;
