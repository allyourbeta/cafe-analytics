// Category color mapping for consistent styling across reports
// Using Tableau Classic 11-color palette (industry standard)
export const CATEGORY_COLORS: Record<string, string> = {
  'coffeetea': '#8c564b',           // Brown - coffee color
  'cold coffeetea': '#d62728',      // Cyan - cool, refreshing
  'beer': '#ff7f0e',                // Orange - amber beer
  'hh beer': '#bcbd22',             // Yellow-green - distinct from regular beer
  'wine': '#8c564b',                // Red - classic wine
  'hh wine': '#e377c2',             // Pink - rosé wine
  'other drinks': '#1f77b4',        // Blue - neutral, stands out
  'baked goods': '#ff9896',         // Light coral - warm, appetizing
  'food': '#2ca02c',                // Green - fresh, healthy
  'retail': '#7f7f7f',              // Gray - neutral, non-food
  'space rental': '#9467bd',        // Purple - premium, distinctive
};

// Display names for categories (friendlier than database values)
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'coffeetea': 'Coffee & Tea',
  'cold coffeetea': 'Cold Coffee & Tea',
  'beer': 'Beer',
  'hh beer': 'Happy Hour Beer',
  'wine': 'Wine',
  'hh wine': 'Happy Hour Wine',
  'other drinks': 'Other Drinks',
  'baked goods': 'Baked Goods',
  'food': 'Food',
  'retail': 'Retail',
  'space rental': 'Space Rental',
};

// Get all categories in a consistent order
export const ALL_CATEGORIES = [
  'coffeetea',
  'cold coffeetea',
  'beer',
  'hh beer',
  'wine',
  'hh wine',
  'other drinks',
  'baked goods',
  'food',
  'retail',
  'space rental',
];

// Helper function to get category color
export const getCategoryColor = (category: string): string => {
  return CATEGORY_COLORS[category] || '#6B7280'; // Default to gray if unknown
};

// Helper function to get category display name
export const getCategoryDisplayName = (category: string): string => {
  return CATEGORY_DISPLAY_NAMES[category] || category;
};