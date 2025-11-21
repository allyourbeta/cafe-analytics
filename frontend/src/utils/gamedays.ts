// Cal Football home game dates for 2025
// These dates represent significantly higher volume days at the cafe
export const GAME_DAY_DATES_2025: string[] = [
  '2025-09-06',
  '2025-09-13',
  '2025-10-04',
  '2025-10-17',
  '2025-11-01',
  '2025-11-29'
];

// Helper function to check if a date string is a game day
export const isGameDay = (dateStr: string): boolean => {
  return GAME_DAY_DATES_2025.includes(dateStr);
};

// Helper function to check if a date string is a Saturday
export const isSaturday = (dateStr: string): boolean => {
  const date = new Date(dateStr + 'T12:00:00'); // Add time to avoid timezone issues
  return date.getDay() === 6; // 6 = Saturday
};

// Helper function to check if a date is a non-game Saturday
export const isNonGameSaturday = (dateStr: string): boolean => {
  return isSaturday(dateStr) && !isGameDay(dateStr);
};