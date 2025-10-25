import { useState, useEffect } from 'react';
import { getItemsByRevenue, getSalesPerHour, getItemsByMargin } from '../utils/api';

interface KPICardProps {
  icon: string;
  iconBg: string;
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendColor?: string;
}

function KPICard({ icon, iconBg, title, value, subtitle, trend, trendColor }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`${iconBg} rounded-lg p-3 text-2xl`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
            <span>📈</span>
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-sm text-gray-600 uppercase tracking-wide mb-1">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{subtitle}</div>
    </div>
  );
}

export default function Dashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [topSeller, setTopSeller] = useState<string>('');
  const [topSellerRevenue, setTopSellerRevenue] = useState<number>(0);
  const [topSellerUnits, setTopSellerUnits] = useState<number>(0);
  const [avgMargin, setAvgMargin] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch top seller (use last 30 days for demo since we have historical data)
      const revenueData = await getItemsByRevenue('2024-10-01', '2024-10-23');
      if (revenueData.data.length > 0) {
        const top = revenueData.data[0];
        setTopSeller(top.item_name);
        setTopSellerRevenue(top.revenue);
        setTopSellerUnits(top.units_sold);
      }

      // Fetch sales data to calculate today's sales
      const salesData = await getSalesPerHour('2024-10-23', '2024-10-23');
      const totalSales = salesData.data.reduce((sum: number, hour: any) => sum + hour.sales, 0);
      setTodaySales(totalSales);

      // Fetch margin data
      const marginData = await getItemsByMargin();
      if (marginData.data.length > 0) {
        const avgMarginPct = marginData.data.reduce((sum: number, item: any) =>
          sum + item.margin_pct, 0) / marginData.data.length;
        setAvgMargin(avgMarginPct);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Campus Cafe Dashboard</h1>
            <p className="text-gray-600">Today: {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow">
            <span className="text-gray-600">📅</span>
            <span className="text-sm font-medium">Last 30 Days</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            icon="💵"
            iconBg="bg-orange-100"
            title="TODAY'S SALES"
            value={`$${todaySales.toFixed(2)}`}
            subtitle="vs $2,541 yesterday"
            trend="12%"
            trendColor="text-green-600"
          />

          <KPICard
            icon="📊"
            iconBg="bg-orange-100"
            title="TOP SELLER"
            value={topSeller}
            subtitle={`${topSellerUnits} sold • $${topSellerRevenue.toFixed(2)} revenue`}
          />

          <KPICard
            icon="⏰"
            iconBg="bg-green-100"
            title="LABOR COST"
            value="28.4%"
            subtitle="Target: 30% • On target"
          />

          <KPICard
            icon="💰"
            iconBg="bg-orange-100"
            title="AVG MARGIN"
            value={`${avgMargin.toFixed(1)}%`}
            subtitle="vs 65.8% last period"
            trend="2%"
            trendColor="text-green-600"
          />
        </div>
      </div>
    </div>
  );
}