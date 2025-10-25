import { useState, useEffect } from 'react';
import { getItemsByRevenue, getSalesPerHour, getItemsByMargin } from '../utils/api';

interface KPICardProps {
  icon: string;
  iconBg: string;
  title: string;
  value: string;
  subtitle: string;
}

function KPICard({ icon, iconBg, title, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className={`${iconBg} rounded-lg p-3 text-2xl inline-block mb-3`}>
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-500 uppercase mb-1">{title}</div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{subtitle}</div>
    </div>
  );
}

export default function Dashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [topSeller, setTopSeller] = useState<string>('Cold Brew');
  const [topSellerUnits, setTopSellerUnits] = useState<number>(0);
  const [avgMargin, setAvgMargin] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const revenueData = await getItemsByRevenue('2024-10-01', '2024-10-23');
      if (revenueData.data.length > 0) {
        const top = revenueData.data[0];
        setTopSeller(top.item_name);
        setTopSellerUnits(top.units_sold);
      }

      const salesData = await getSalesPerHour('2024-10-23', '2024-10-23');
      const totalSales = salesData.data.reduce((sum: number, hour: any) => sum + hour.sales, 0);
      setTodaySales(totalSales);

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
    return <div className="p-8">Loading...</div>;
  }

  return (
    <>
      {/* White title bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">edmonds café dashboard</h1>
            <p className="text-gray-600 text-sm mt-1">Today: Friday, October 24, 2025</p>
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            📅 Last 30 Days ▾
          </button>
        </div>
      </div>

      {/* KPI cards on colored background */}
      <div className="px-8 pt-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-4 gap-6">
            <KPICard
              icon="💵"
              iconBg="bg-orange-500"
              title="TODAY'S SALES"
              value={`$${Math.round(todaySales)}`}
              subtitle="vs $2,541 yesterday"
            />
            <KPICard
              icon="📊"
              iconBg="bg-orange-500"
              title="TOP SELLER"
              value={topSeller}
              subtitle={`${topSellerUnits} sold`}
            />
            <KPICard
              icon="⏰"
              iconBg="bg-teal-500"
              title="LABOR COST"
              value="28.4%"
              subtitle="Target: 30%"
            />
            <KPICard
              icon="💰"
              iconBg="bg-orange-500"
              title="AVG MARGIN"
              value={`${avgMargin.toFixed(1)}%`}
              subtitle="vs 65.8% last period"
            />
          </div>
        </div>
      </div>
    </>
  );
}