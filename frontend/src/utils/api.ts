import axios from 'axios';

const API_BASE = 'http://127.0.0.1:5500/api';

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

// R3: Items by Revenue
export const getItemsByRevenue = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/items-by-revenue`, {
    params: { start: startDate, end: endDate }
  });
  return response.data;
};

// R1: Sales per Hour
export const getSalesPerHour = async (startDate: string, endDate: string, mode: 'average' | 'single' = 'average', singleDate?: string) => {
  const params: any = { start: startDate, end: endDate, mode };
  if (mode === 'single' && singleDate) {
    params.date = singleDate;
  }
  const response = await axios.get(`${API_BASE}/reports/sales-per-hour`, { params });
  return response.data;
};

// R2: Labor Percent per Hour
export const getLaborPercent = async (startDate: string, endDate: string, includeSalaried: boolean = true) => {
  const response = await axios.get(`${API_BASE}/reports/labor-percent`, {
    params: { start: startDate, end: endDate, include_salaried: includeSalaried }
  });
  return response.data;
};

// R4: Items by Profit
export const getItemsByProfit = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/items-by-profit`, {
    params: { start: startDate, end: endDate }
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
export const getCategoriesByRevenue = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/categories-by-revenue`, {
    params: { start: startDate, end: endDate }
  });
  return response.data;
};

// R7: Categories by Profit
export const getCategoriesByProfit = async (startDate: string, endDate: string) => {
  const response = await axios.get(`${API_BASE}/reports/categories-by-profit`, {
    params: { start: startDate, end: endDate }
  });
  return response.data;
};