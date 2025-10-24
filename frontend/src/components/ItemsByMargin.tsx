import ReportLayout, { type Column } from './ReportLayout';
import { getItemsByMargin } from '../utils/api';

const columns: Column[] = [
  { key: 'item_name', label: 'Item', align: 'left' },
  { key: 'category', label: 'Category', align: 'left' },
  {
    key: 'current_price',
    label: 'Price',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  {
    key: 'current_cost',
    label: 'Cost',
    align: 'right',
    format: (val) => `$${Number(val).toFixed(2)}`
  },
  {
    key: 'profit_per_unit',
    label: 'Profit/Unit',
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

export default function ItemsByMargin() {
  return (
    <ReportLayout
      title="Items by Profitability %"
      fetchData={getItemsByMargin}
      columns={columns}
      needsDateRange={false}
    />
  );
}
