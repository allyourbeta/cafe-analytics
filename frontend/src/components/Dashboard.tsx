import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Clock, Percent } from 'lucide-react';
import { getItemsByRevenue, getSalesPerHour, getItemsByMargin } from '../utils/api';

interface KPICardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
}

function KPICard({ icon, iconBg, title, value, subtitle, trend }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`${iconBg} rounded-lg p-2.5 text-white`}>
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-sm font-semibold text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">{title}</div>
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
            <h1 className="text-4xl font-bold text-gray-900">Edmonds Café</h1>
            <p className="text-gray-600 text-sm mt-1">Today: Friday, October 24, 2025</p>
          </div>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            📅 Last 30 Days ▾
          </button>
        </div>
      </div>

      {/* KPI cards on colored background */}
      <div className="px-8 pt-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-4 gap-6">
            <KPICard
              icon={<DollarSign className="w-6 h-6" />}
              iconBg="bg-orange-500"
              title="TODAY'S SALES"
              value={`$${Math.round(todaySales)}`}
              subtitle="vs $2,541 yesterday"
              trend="12%"
            />
            <KPICard
              icon={<TrendingUp className="w-6 h-6" />}
              iconBg="bg-orange-500"
              title="TOP SELLER"
              value={topSeller}
              subtitle={`${topSellerUnits} sold`}
            />
            <KPICard
              icon={<Clock className="w-6 h-6" />}
              iconBg="bg-teal-500"
              title="LABOR COST"
              value="28.4%"
              subtitle="Target: 30%"
            />
            <KPICard
              icon={<Percent className="w-6 h-6" />}
              iconBg="bg-orange-500"
              title="AVG MARGIN"
              value={`${avgMargin.toFixed(1)}%`}
              subtitle="vs 65.8% last period"
              trend="2%"
            />
          </div>
        </div>
      </div>
    </>
  );
}