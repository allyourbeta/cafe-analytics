import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Clock,
  Percent,
  BarChart3,
  Calendar,
  Activity,
  Menu,
  X,
} from "lucide-react";
import {
  getItemsByRevenue,
  getSalesPerHour,
  getItemsByMargin,
} from "../utils/api";
import ItemsByRevenue from "./ItemsByRevenue";
import SalesPerHour from "./SalesPerHour";
import LaborPercent from "./LaborPercent";
import ItemsByProfit from "./ItemsByProfit";
import ItemsByMargin from "./ItemsByMargin";
import DailyForecast from "./DailyForecast";
import HourlyForecast from "./HourlyForecast";

interface KPICardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconShadow: string;
  cardBg: string;
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
}

interface ReportItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  component: React.ReactNode;
}

function KPICard({
  icon,
  iconBg,
  iconShadow,
  cardBg,
  title,
  value,
  subtitle,
  trend,
}: KPICardProps) {
  return (
    <div
      className={`${cardBg} rounded-xl p-6 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-gray-100`}
    >
      <div
        className={`${iconBg} ${iconShadow} w-14 h-14 rounded-xl flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {title}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{subtitle}</div>
      {trend && (
        <div
          className="text-xs font-bold text-green-600 flex items-center gap-1 mt-2 animate-pulse"
          style={{ filter: "drop-shadow(0 0 8px rgba(34,197,94,0.5))" }}
        >
          <TrendingUp className="w-3 h-3" />
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [todaySales, setTodaySales] = useState<number>(0);
  const [topSeller, setTopSeller] = useState<string>("Cold Brew");
  const [topSellerUnits, setTopSellerUnits] = useState<number>(0);
  const [avgMargin, setAvgMargin] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const reports: ReportItem[] = [
    {
      id: "items-by-revenue",
      title: "Items by Revenue",
      description: "Top selling items ranked by total revenue",
      icon: <BarChart3 className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-orange-400 to-orange-600",
      component: <ItemsByRevenue />,
    },
    {
      id: "sales-per-hour",
      title: "Sales per Hour",
      description: "Hourly sales breakdown for today",
      icon: <Clock className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-blue-400 to-blue-600",
      component: <SalesPerHour />,
    },
    {
      id: "labor-percent",
      title: "Labor % per Hour",
      description: "Labor cost percentage by hour",
      icon: <Percent className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-green-400 to-green-600",
      component: <LaborPercent />,
    },
    {
      id: "items-by-profit",
      title: "Items by Profit",
      description: "Most profitable menu items",
      icon: <DollarSign className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-purple-400 to-purple-600",
      component: <ItemsByProfit />,
    },
    {
      id: "items-by-margin",
      title: "Items by Margin",
      description: "Items with highest profit margins",
      icon: <TrendingUp className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-pink-400 to-pink-600",
      component: <ItemsByMargin />,
    },
    {
      id: "daily-forecast",
      title: "Daily Sales Forecast",
      description: "Predicted sales for next 7 days",
      icon: <Calendar className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-600",
      component: <DailyForecast />,
    },
    {
      id: "hourly-forecast",
      title: "Hourly Sales Forecast",
      description: "Predicted sales by hour for tomorrow",
      icon: <Activity className="w-5 h-5 text-white" />,
      iconBg: "bg-gradient-to-br from-blue-400 to-blue-600",
      component: <HourlyForecast />,
    },
  ];

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const revenueData = await getItemsByRevenue("2024-10-01", "2024-10-23");
      if (revenueData.data.length > 0) {
        const top = revenueData.data[0];
        setTopSeller(top.item_name);
        setTopSellerUnits(top.units_sold);
      }

      const salesData = await getSalesPerHour("2024-10-23", "2024-10-23");
      const totalSales = salesData.data.reduce(
        (sum: number, hour: any) => sum + hour.sales,
        0
      );
      setTodaySales(totalSales);

      const marginData = await getItemsByMargin();
      if (marginData.data.length > 0) {
        const avgMarginPct =
          marginData.data.reduce(
            (sum: number, item: any) => sum + item.margin_pct,
            0
          ) / marginData.data.length;
        setAvgMargin(avgMarginPct);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  const selectedReportData = reports.find((r) => r.id === selectedReport);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">
              Edmonds Café
            </h1>
            <p className="text-sm text-gray-500">
              Today: Friday, October 24, 2025
            </p>
          </div>
        </div>
        <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 flex items-center gap-2">
          <span className="text-gray-500">📅</span>
          Last 30 Days ▾
        </button>
      </div>

      {/* Decorative stripe */}
      <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-full mb-8 shadow-lg shadow-orange-500/20" />

      {/* Main layout with sidebar */}
      <div className="flex gap-6">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:block w-72 flex-shrink-0">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 px-2">
              Sales Reports
            </h2>
            <nav className="space-y-1">
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-150 text-left ${
                    selectedReport === report.id
                      ? "bg-white shadow-md border border-orange-200"
                      : "hover:bg-white hover:shadow-sm"
                  }`}
                >
                  <div
                    className={`${report.iconBg} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
                  >
                    {report.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">
                      {report.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {report.description}
                    </div>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            {/* Drawer */}
            <aside className="fixed top-0 left-0 bottom-0 w-80 bg-white z-50 lg:hidden shadow-2xl animate-slide-in">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">
                  Sales Reports
                </h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>
              <nav className="p-4 space-y-1">
                {reports.map((report) => (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedReport(report.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all duration-150 text-left ${
                      selectedReport === report.id
                        ? "bg-orange-50 border border-orange-200"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`${report.iconBg} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}
                    >
                      {report.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {report.title}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {report.description}
                      </div>
                    </div>
                  </button>
                ))}
              </nav>
            </aside>
          </>
        )}

        {/* Main content area */}
        <main className="flex-1 min-w-0">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard
              icon={<DollarSign className="w-7 h-7 text-white" />}
              iconBg="bg-gradient-to-br from-orange-400 to-orange-600"
              iconShadow="shadow-lg shadow-orange-500/40"
              cardBg="bg-gradient-to-br from-orange-50 to-white"
              title="TODAY'S SALES"
              value={`$${Math.round(todaySales)}`}
              subtitle="vs $2,541 yesterday"
              trend="+12%"
            />
            <KPICard
              icon={<TrendingUp className="w-7 h-7 text-white" />}
              iconBg="bg-gradient-to-br from-amber-400 to-amber-600"
              iconShadow="shadow-lg shadow-amber-500/40"
              cardBg="bg-gradient-to-br from-amber-50 to-white"
              title="TOP SELLER"
              value={topSeller}
              subtitle={`${topSellerUnits} sold`}
            />
            <KPICard
              icon={<Clock className="w-7 h-7 text-white" />}
              iconBg="bg-gradient-to-br from-cyan-400 to-cyan-600"
              iconShadow="shadow-lg shadow-cyan-500/40"
              cardBg="bg-gradient-to-br from-cyan-50 to-white"
              title="LABOR COST"
              value="28.4%"
              subtitle="Target: 30%"
            />
            <KPICard
              icon={<Percent className="w-7 h-7 text-white" />}
              iconBg="bg-gradient-to-br from-yellow-400 to-yellow-600"
              iconShadow="shadow-lg shadow-yellow-500/40"
              cardBg="bg-gradient-to-br from-yellow-50 to-white"
              title="AVG MARGIN"
              value={`${avgMargin.toFixed(1)}%`}
              subtitle="vs 65.8% last period"
              trend="+2%"
            />
          </div>

          {/* Report display area */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            {selectedReportData ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className={`${selectedReportData.iconBg} w-12 h-12 rounded-lg flex items-center justify-center shadow-sm`}
                  >
                    {selectedReportData.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedReportData.title}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedReportData.description}
                    </p>
                  </div>
                </div>
                <div>{selectedReportData.component}</div>
              </div>
            ) : (
              <div className="text-center py-16">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Report Selected
                </h3>
                <p className="text-sm text-gray-600">
                  Select a report from the sidebar to view details
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
