/**
 * Format a number with commas for thousands separators
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0 for no cents)
 * @returns Formatted string with commas
 */
export function formatCurrency(num: number, decimals: number = 0): string {
  return `$${num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/**
 * Format a number with commas (no dollar sign)
 * @param num - The number to format
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted string with commas
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Get today's date formatted for display in Pacific Time
 * @returns Formatted date string like "Friday, October 30, 2025"
 */
export function getTodayPacificTime(): string {
  const today = new Date();

  // Format in Pacific Time
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Los_Angeles'
  };

  return today.toLocaleDateString('en-US', options);
}