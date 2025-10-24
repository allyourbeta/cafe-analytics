import ReportLayout, { type Column } from './ReportLayout';
import { getDailyForecast } from '../utils/api';

const columns: Column[] = [
  { key: 'date', label: 'Date', align: 'left' },
  { key: 'day_of_week', label: 'Day', align: 'left' },
  {
    key: 'forecasted_sales',
    label: 'Forecasted Sales',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  { key: 'basis', label: 'Basis', align: 'left' },
];

export default function DailyForecast() {
  return (
    <ReportLayout
      title="Daily Sales Forecast (Next 7 Days)"
      fetchData={getDailyForecast}
      columns={columns}
      needsDateRange={false}
    />
  );
}