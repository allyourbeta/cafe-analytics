import ReportLayout, { type Column } from './ReportLayout';
import { getItemsByProfit } from '../utils/api';

const columns: Column[] = [
  { key: 'item_name', label: 'Item', align: 'left' },
  { key: 'category', label: 'Category', align: 'left' },
  { key: 'units_sold', label: 'Units', align: 'right' },
  {
    key: 'total_profit',
    label: 'Total Profit',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  {
    key: 'margin_pct',
    label: 'Margin %',
    align: 'right',
    format: (val) => `${Number(val).toFixed(1)}%`
  },
];

export default function ItemsByProfit() {
  return (
    <ReportLayout
      title="Items by Total Profit"
      fetchData={getItemsByProfit}
      columns={columns}
      needsDateRange={true}
    />
  );
}