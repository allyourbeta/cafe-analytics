// Category color mapping for consistent styling across reports
export const CATEGORY_COLORS: Record<string, string> = {
  'coffeetea': '#8B4513',           // Brown/Coffee
  'cold coffeetea': '#87CEEB',      // Ice blue
  'beer': '#DAA520',                // Golden
  'hh beer': '#FFBF00',             // Amber
  'wine': '#8B0000',                // Deep red
  'hh wine': '#C04040',             // Rose
  'other drinks': '#008080',        // Teal
  'baked goods': '#F5DEB3',         // Wheat
  'food': '#FF6347',                // Tomato
  'retail': '#9370DB',              // Purple
  'space rental': '#708090',        // Gray
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