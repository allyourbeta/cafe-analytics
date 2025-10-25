import './index.css';
import Dashboard from './components/Dashboard';
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
    <div className="min-h-screen bg-gray-400">
      <Dashboard />

      <div className="px-8 pb-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Sales Reports</h2>

          <div className="grid grid-cols-2 gap-6">
            <ReportCard
              icon="📊"
              iconBg="bg-orange-500"
              title="Items by Revenue"
              description="Top selling items ranked by total revenue"
            >
              <ItemsByRevenue />
            </ReportCard>

            <ReportCard
              icon="⏰"
              iconBg="bg-blue-500"
              title="Sales per Hour"
              description="Hourly sales breakdown for today"
            >
              <SalesPerHour />
            </ReportCard>

            <ReportCard
              icon="💰"
              iconBg="bg-green-500"
              title="Labor % per Hour"
              description="Labor cost percentage by hour"
            >
              <LaborPercent />
            </ReportCard>

            <ReportCard
              icon="💵"
              iconBg="bg-purple-500"
              title="Items by Profit"
              description="Most profitable menu items"
            >
              <ItemsByProfit />
            </ReportCard>

            <ReportCard
              icon="📈"
              iconBg="bg-pink-500"
              title="Items by Margin"
              description="Items with highest profit margins"
            >
              <ItemsByMargin />
            </ReportCard>

            <ReportCard
              icon="📅"
              iconBg="bg-teal-500"
              title="Daily Sales Forecast"
              description="Predicted sales for next 7 days"
            >
              <DailyForecast />
            </ReportCard>

            <ReportCard
              icon="🔮"
              iconBg="bg-blue-500"
              title="Hourly Sales Forecast"
              description="Predicted sales by hour for tomorrow"
            >
              <HourlyForecast />
            </ReportCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;