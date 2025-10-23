import axios from 'axios';

const API_BASE = 'http://127.0.0.1:5500/api';

export interface RevenueItem {
  item_name: string;
  category: string;
  units_sold: number;
  revenue: number;
}

export interface RevenueResponse {
  success: boolean;
  data: RevenueItem[];
  date_range: {
    start: string;
    end: string;
  };
}

export const getItemsByRevenue = async (
  startDate: string,
  endDate: string
): Promise<RevenueResponse> => {
  const response = await axios.get<RevenueResponse>(
    `${API_BASE}/reports/items-by-revenue`,
    {
      params: { start: startDate, end: endDate }
    }
  );
  return response.data;
};
