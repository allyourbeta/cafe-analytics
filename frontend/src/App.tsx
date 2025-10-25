import './index.css';
import Dashboard from './components/Dashboard.tsx';
import ReportCard from './components/ReportCard';
import ItemsByRevenue from './components/ItemsByRevenue';
import SalesPerHour from './components/SalesPerHour';
import LaborPercent from './components/LaborPercent';
import ItemsByProfit from './components/ItemsByProfit';
import ItemsByMargin from './components/ItemsByMargin';
import DailyForecast from './components/DailyForecast';
import HourlyForecast from './components/HourlyForecast';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard KPIs */}
      <Dashboard />

      {/* Sales Reports Section */}
      <div className="px-6 pb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Sales Reports</h2>

        <ReportCard
          icon="📊"
          iconBg="bg-orange-100"
          title="Items by Revenue"
          description="Top selling items ranked by total revenue"
        >
          <ItemsByRevenue />
        </ReportCard>

        <ReportCard
          icon="⏰"
          iconBg="bg-blue-100"
          title="Sales per Hour"
          description="Hourly sales breakdown for today"
        >
          <SalesPerHour />
        </ReportCard>

        <ReportCard
          icon="💰"
          iconBg="bg-green-100"
          title="Labor % per Hour"
          description="Labor cost percentage by hour"
        >
          <LaborPercent />
        </ReportCard>

        <ReportCard
          icon="💵"
          iconBg="bg-purple-100"
          title="Items by Profit"
          description="Most profitable menu items"
        >
          <ItemsByProfit />
        </ReportCard>

        <ReportCard
          icon="📈"
          iconBg="bg-pink-100"
          title="Items by Margin"
          description="Items with highest profit margins"
        >
          <ItemsByMargin />
        </ReportCard>

        <ReportCard
          icon="📅"
          iconBg="bg-teal-100"
          title="Daily Sales Forecast"
          description="Predicted sales for next 7 days"
        >
          <DailyForecast />
        </ReportCard>

        <ReportCard
          icon="🔮"
          iconBg="bg-blue-100"
          title="Hourly Sales Forecast"
          description="Predicted sales by hour for tomorrow"
        >
          <HourlyForecast />
        </ReportCard>
      </div>
    </div>
  );
}

export default App;