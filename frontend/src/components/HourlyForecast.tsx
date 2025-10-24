import ReportLayout, { type Column } from './ReportLayout';
import { getHourlyForecast } from '../utils/api';

const columns: Column[] = [
  { key: 'hour', label: 'Hour', align: 'left' },
  {
    key: 'avg_sales',
    label: 'Forecasted Sales',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
];

export default function HourlyForecast() {
  return (
    <ReportLayout
      title="Hourly Sales Forecast (Tomorrow)"
      fetchData={getHourlyForecast}
      columns={columns}
      needsDateRange={false}
    />
  );
}