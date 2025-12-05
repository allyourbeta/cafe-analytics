/**
 * Format a date string (YYYY-MM-DD) for display
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormatOptions (default: short format)
 * @returns Formatted date string like "Oct 30, 2025"
 */
export function formatDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  }
): string {
  // Parse date string as local date to avoid timezone shift
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", options);
}

/**
 * Format a date range for display
 * @param startDate - Start date string in YYYY-MM-DD format
 * @param endDate - End date string in YYYY-MM-DD format
 * @returns Formatted range like "Oct 30, 2025" or "Oct 30 - Nov 5, 2025"
 */
export function formatDateRange(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

/**
 * Format a number with commas for thousands separators
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0 for no cents)
 * @returns Formatted string with commas
 */
export function formatCurrency(num: number, decimals: number = 0): string {
  // Handle undefined/null values defensively
  const safeNum = num ?? 0;
  return `$${safeNum.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/**
 * Format a number with commas (no dollar sign)
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string with commas
 */
export function formatNumber(num: number, decimals: number = 0): string {
  // Handle undefined/null values defensively
  const safeNum = num ?? 0;
  return safeNum.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Get today's date formatted for display in Pacific Time
 * @returns Formatted date string like "Friday, October 30, 2025"
 */
export function getTodayPacificTime(): string {
  const today = new Date();

  // Format in Pacific Time
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  };

  return today.toLocaleDateString("en-US", options);
}

/**
 * Aggregate items by category, summing units, profit, and revenue
 * @param items - Array of items with category, units_sold, total_profit, margin_pct, and/or revenue
 * @returns Array of category aggregates
 */
export function aggregateByCategory(items: any[]): any[] {
  const categoryMap = new Map<string, any>();

  items.forEach((item) => {
    const category = item.category;
    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        units_sold: 0,
        total_profit: 0,
        total_revenue: 0, // For weighted margin calculation
        revenue: 0, // Direct revenue aggregation for ItemsByRevenue
      });
    }

    const agg = categoryMap.get(category);
    agg.units_sold += item.units_sold || 0;
    agg.total_profit += item.total_profit || 0;

    // If item has direct revenue field (from ItemsByRevenue), aggregate it
    if (item.revenue !== undefined) {
      agg.revenue += item.revenue || 0;
      agg.total_revenue += item.revenue || 0;
    }
    // Otherwise calculate revenue from profit and margin (for profit reports)
    else if (item.margin_pct && item.margin_pct > 0) {
      const revenue = item.total_profit / (item.margin_pct / 100);
      agg.total_revenue += revenue;
    }
  });

  // Convert to array and calculate margin_pct
  return Array.from(categoryMap.values())
    .map((agg) => ({
      ...agg,
      margin_pct:
        agg.total_revenue > 0
          ? (agg.total_profit / agg.total_revenue) * 100
          : 0,
    }))
    .sort(
      (a, b) => (b.revenue || b.total_profit) - (a.revenue || a.total_profit)
    ); // Sort by revenue or profit
}
