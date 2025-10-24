import ReportLayout, { type Column } from './ReportLayout';
import { getLaborPercent } from '../utils/api';

const columns: Column[] = [
  { key: 'hour', label: 'Hour', align: 'left' },
  {
    key: 'sales',
    label: 'Sales',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  {
    key: 'labor_cost',
    label: 'Labor Cost',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  {
    key: 'labor_pct',
    label: 'Labor %',
    align: 'right',
    format: (val) => `${Number(val).toFixed(1)}%`
  },
];

export default function LaborPercent() {
  return (
    <ReportLayout
      title="Labor % per Labor Hour"
      fetchData={getLaborPercent}
      columns={columns}
      needsDateRange={true}
    />
  );
}