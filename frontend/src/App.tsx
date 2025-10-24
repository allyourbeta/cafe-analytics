import { useState } from 'react';
import './index.css';
import ItemsByRevenue from './components/ItemsByRevenue';
import SalesPerHour from './components/SalesPerHour';
import LaborPercent from './components/LaborPercent';
import ItemsByProfit from './components/ItemsByProfit';
import ItemsByMargin from './components/ItemsByMargin';
import DailyForecast from './components/DailyForecast';
import HourlyForecast from './components/HourlyForecast';

function App() {
  const [activeTab, setActiveTab] = useState('revenue');

  const tabs = [
    { id: 'revenue', label: 'Items by Revenue', component: <ItemsByRevenue /> },
    { id: 'sales', label: 'Sales per Hour', component: <SalesPerHour /> },
    { id: 'labor', label: 'Labor %', component: <LaborPercent /> },
    { id: 'profit', label: 'Items by Profit', component: <ItemsByProfit /> },
    { id: 'margin', label: 'Items by Margin', component: <ItemsByMargin /> },
    { id: 'daily', label: 'Daily Forecast', component: <DailyForecast /> },
    { id: 'hourly', label: 'Hourly Forecast', component: <HourlyForecast /> },
  ];

  const activeComponent = tabs.find(t => t.id === activeTab)?.component;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm mb-4">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-800">☕ Campus Cafe Reporting</h1>
          <p className="text-gray-600">Sales Analytics Dashboard</p>
        </div>
      </header>

      <div className="container mx-auto px-4">
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-0">
            {activeComponent}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;