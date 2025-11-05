import axios from "axios";

const API_BASE = "http://127.0.0.1:5500/api";

// Interfaces
export interface RevenueItem {
  item_name: string;
  category: string;
  units_sold: number;
  revenue: number;
}

export interface SalesHour {
  hour: string;
  sales: number;
}

export interface LaborHour {
  hour: string;
  sales: number;
  labor_cost: number;
  labor_pct: number;
}

export interface ProfitItem {
  item_name: string;
  category: string;
  units_sold: number;
  total_profit: number;
  margin_pct: number;
}

export interface MarginItem {
  item_name: string;
  category: string;
  current_price: number;
  current_cost: number;
  profit_per_unit: number;
  margin_pct: number;
}

export interface CategoryRevenue {
  category: string;
  units_sold: number;
  revenue: number;
}

export interface CategoryProfit {
  category: string;
  units_sold: number;
  total_profit: number;
  margin_pct: number;
}

export interface DailyForecast {
  date: string;
  day_of_week: string;
  forecasted_sales: number;
  basis: string;
}

export interface HourlyForecast {
  hour: string;
  avg_sales: number;
}

export interface TopItem {
  item_id: number;
  item_name: string;
  category: string;
  total_revenue: number;
}

export interface HeatmapCell {
  day_of_week: string;
  day_num: number;
  hour: number;
  revenue: number;
  units: number;
}

export interface WeeklyForecast {
  week: number;
  start_date: string;
  end_date: string;
  quantity: number;
}

export interface ItemDemandForecast {
  item_id: number;
  item_name: string;
  category: string;
  is_new: boolean;
  weekly_forecast: WeeklyForecast[];
  total_forecast: number;
}

export interface CategoryDemandForecast {
  category: string;
  is_new: boolean;
  weekly_forecast: WeeklyForecast[];
  total_forecast: number;
}

// R3: Items by Revenue
export const getItemsByRevenue = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/items-by-revenue`, {
    params: { start: startDate, end: endDate },
  });
  return response.data;
};

// R1: Sales per Hour
export const getSalesPerHour = async (
  startDate: string,
  endDate: string,
  mode: "average" | "single" | "day-of-week" = "average",
  singleDate?: string
) => {
  const params: any = { start: startDate, end: endDate, mode };
  if (mode === "single" && singleDate) {
    params.date = singleDate;
  }
  const response = await axios.get(`${API_BASE}/reports/sales-per-hour`, {
    params,
  });
  return response.data;
};

// Total Sales for date range
export const getTotalSales = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/total-sales`, {
    params: { start: startDate, end: endDate },
  });
  return response.data;
};

// R2: Labor Percent per Hour
export const getLaborPercent = async (
  startDate: string,
  endDate: string,
  includeSalaried: boolean = true
) => {
  const response = await axios.get(`${API_BASE}/reports/labor-percent`, {
    params: {
      start: startDate,
      end: endDate,
      include_salaried: includeSalaried,
    },
  });
  return response.data;
};

// R4: Items by Profit
export const getItemsByProfit = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/items-by-profit`, {
    params: { start: startDate, end: endDate },
  });
  return response.data;
};

// R5: Items by Margin
export const getItemsByMargin = async () => {
  const response = await axios.get(`${API_BASE}/reports/items-by-margin`);
  return response.data;
};

// P1: Daily Forecast
export const getDailyForecast = async () => {
  const response = await axios.get(`${API_BASE}/forecasts/daily`);
  return response.data;
};

// P2: Hourly Forecast
export const getHourlyForecast = async () => {
  const response = await axios.get(`${API_BASE}/forecasts/hourly`);
  return response.data;
};

// R6: Categories by Revenue
export const getCategoriesByRevenue = async (
  startDate: string,
  endDate: string
) => {
  const response = await axios.get(
    `${API_BASE}/reports/categories-by-revenue`,
    {
      params: { start: startDate, end: endDate },
    }
  );
  return response.data;
};

// R7: Categories by Profit
export const getCategoriesByProfit = async (
  startDate: string,
  endDate: string
) => {
  const response = await axios.get(`${API_BASE}/reports/categories-by-profit`, {
    params: { start: startDate, end: endDate },
  });
  return response.data;
};

// R8: Get top items for heatmap
export const getTopItems = async (
  startDate: string,
  endDate: string,
  limit: number = 25
) => {
  const response = await axios.get(`${API_BASE}/reports/top-items`, {
    params: { start: startDate, end: endDate, limit },
  });
  return response.data;
};

// R9: Get item heatmap data
export const getItemHeatmap = async (
  itemId: number,
  startDate: string,
  endDate: string
) => {
  const response = await axios.get(`${API_BASE}/reports/item-heatmap`, {
    params: { item_id: itemId, start: startDate, end: endDate },
  });
  return response.data;
};

// P3: Item Demand Forecast
export const getItemDemandForecast = async () => {
  const response = await axios.get(`${API_BASE}/forecasts/items`);
  return response.data;
};

// P4: Category Demand Forecast
export const getCategoryDemandForecast = async () => {
  const response = await axios.get(`${API_BASE}/forecasts/categories`);
  return response.data;
};

// R10: Time Period Comparison
export interface TimePeriodData {
  days: number[];
  start_hour: number;
  end_hour: number;
  revenue: number;
  days_counted: number;
  units_sold: number;
  avg_per_day: number;
}

export interface TimePeriodComparisonData {
  item_id: number;
  item_name: string;
  category: string;
  date_range: {
    start: string;
    end: string;
  };
  period_a: TimePeriodData;
  period_b: TimePeriodData;
}

export const getTimePeriodComparison = async (
  itemId: number,
  startDate: string,
  endDate: string,
  periodADays: string,
  periodAStartHour: number,
  periodAEndHour: number,
  periodBDays: string,
  periodBStartHour: number,
  periodBEndHour: number
) => {
  const response = await axios.get(`${API_BASE}/reports/time-period-comparison`, {
    params: {
      item_id: itemId,
      start: startDate,
      end: endDate,
      period_a_days: periodADays,
      period_a_start_hour: periodAStartHour,
      period_a_end_hour: periodAEndHour,
      period_b_days: periodBDays,
      period_b_start_hour: periodBStartHour,
      period_b_end_hour: periodBEndHour,
    },
  });
  return response.data;
};

// Get all items for dropdown
export const getAllItems = async () => {
  const response = await axios.get(`${API_BASE}/items`);
  return response.data;
};