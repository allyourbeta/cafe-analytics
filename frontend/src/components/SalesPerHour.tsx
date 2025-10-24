import ReportLayout, { type Column } from './ReportLayout';
import { getSalesPerHour } from '../utils/api';

const columns: Column[] = [
  { key: 'hour', label: 'Hour', align: 'left' },
  {
    key: 'sales',
    label: 'Sales',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
];

export default function SalesPerHour() {
  return (
    <ReportLayout
      title="Sales per Labor Hour"
      fetchData={getSalesPerHour}
      columns={columns}
      needsDateRange={true}
    />
  );
}