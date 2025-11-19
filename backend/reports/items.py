from flask import Blueprint, jsonify, request

from database import with_database
from extensions import cache

# Import shared utilities
try:
    from utils import get_default_date_range, success_response, error_response
except ImportError:
    from ..utils import get_default_date_range, success_response, error_response

items_bp = Blueprint('items', __name__)


# R3: Items by Revenue
@items_bp.route('/api/reports/items-by-revenue', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_revenue(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    item_type = request.args.get('item_type', 'all')  # 'all', 'purchased', 'house-made'

    query = '''
        SELECT 
            i.item_id,
            i.item_name,
            i.category,
            i.is_resold,
            SUM(t.quantity) as units_sold,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
    '''

    # Add item_type filter if specified
    params = [start_date, end_date]
    if item_type == 'purchased':
        query += ' AND i.is_resold = 1'
    elif item_type == 'house-made':
        query += ' AND i.is_resold = 0'

    query += '''
        GROUP BY t.item_id, i.item_name, i.category, i.is_resold
        ORDER BY revenue DESC
    '''

    cursor.execute(query, params)
    rows = cursor.fetchall()

    items = [dict(row) for row in rows]

    return jsonify(success_response(items, date_range={'start': start_date, 'end': end_date}))


# R4: Items by Total Profit
@items_bp.route('/api/reports/items-by-profit', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_profit(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    item_type = request.args.get('item_type', 'all')  # 'all', 'purchased', 'house-made'

    # Base query with is_resold field
    query = '''
        SELECT 
            i.item_id,
            i.item_name,
            i.category,
            i.is_resold,
            SUM(t.quantity) as units_sold,

            ROUND(SUM((t.unit_price - i.current_cost) * t.quantity), 2) as total_profit,
            ROUND(SUM((t.unit_price - i.current_cost) * t.quantity) / NULLIF(SUM(t.unit_price * t.quantity), 0) * 100, 2) as margin_pct
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
    '''

    # Add item_type filter if specified
    params = [start_date, end_date]
    if item_type == 'purchased':
        query += ' AND i.is_resold = 1'
    elif item_type == 'house-made':
        query += ' AND i.is_resold = 0'

    query += '''
        GROUP BY t.item_id, i.item_name, i.category, i.is_resold
        ORDER BY total_profit DESC
    '''

    cursor.execute(query, params)
    rows = cursor.fetchall()

    data = [dict(row) for row in rows]

    return success_response(
        data,
        date_range={'start': start_date, 'end': end_date},
        item_type=item_type
    )


# R5: Items by Profitability %
@items_bp.route('/api/reports/items-by-margin', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_margin(cursor):
    item_type = request.args.get('item_type', 'all')  # 'all', 'purchased', 'house-made'

    query = '''
        SELECT 
            item_id,
            item_name,
            category,
            is_resold,
            current_price,
            current_cost,
            ROUND(current_price - current_cost, 2) as profit_per_unit,
            ROUND((current_price - current_cost) / current_price * 100, 2) as margin_pct
        FROM items
        WHERE current_price > 0
    '''

    # Add item_type filter if specified
    params = []
    if item_type == 'purchased':
        query += ' AND is_resold = 1'
    elif item_type == 'house-made':
        query += ' AND is_resold = 0'

    query += ' ORDER BY margin_pct DESC'

    cursor.execute(query, params)
    rows = cursor.fetchall()

    data = [dict(row) for row in rows]

    return success_response(data, item_type=item_type)


# R9: Item heatmap data (hourly × daily patterns)
@items_bp.route('/api/reports/item-heatmap', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def item_heatmap(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    item_id = request.args.get('item_id')

    if not item_id:
        return error_response('item_id required', 400)

    query = '''
        WITH daily_hourly_totals AS (
            SELECT 
                DATE(transaction_date) as sale_date,
                CAST(strftime('%w', transaction_date) AS INTEGER) as day_num,
                CAST(strftime('%H', transaction_date) AS INTEGER) as hour,
                SUM(total_amount) as daily_revenue,
                SUM(quantity) as daily_units
            FROM transactions
            WHERE item_id = ?
              AND DATE(transaction_date) BETWEEN ? AND ?
            GROUP BY sale_date, day_num, hour
        )
        SELECT 
            CASE day_num
                WHEN 0 THEN 'Sunday'
                WHEN 1 THEN 'Monday'
                WHEN 2 THEN 'Tuesday'
                WHEN 3 THEN 'Wednesday'
                WHEN 4 THEN 'Thursday'
                WHEN 5 THEN 'Friday'
                WHEN 6 THEN 'Saturday'
            END as day_of_week,
            day_num,
            hour,
            ROUND(AVG(daily_revenue), 2) as revenue,
            ROUND(AVG(daily_units), 1) as units
        FROM daily_hourly_totals
        GROUP BY day_num, hour
        ORDER BY day_num, hour
    '''

    cursor.execute(query, (item_id, start_date, end_date))
    rows = cursor.fetchall()

    data = [dict(row) for row in rows]

    return success_response(data, date_range={'start': start_date, 'end': end_date})


# R10: Time Period Comparison
@items_bp.route('/api/reports/time-period-comparison', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def time_period_comparison(cursor):
    """
    Compare revenue for a specific item between two time periods.

    Params:
    - item_id: The item to analyze
    - start: Overall date range start
    - end: Overall date range end
    - period_a_days: Comma-separated day numbers (0=Sunday, 6=Saturday)
    - period_a_start_hour: Start hour (0-23)
    - period_a_end_hour: End hour (0-23)
    - period_b_days: Comma-separated day numbers
    - period_b_start_hour: Start hour (0-23)
    - period_b_end_hour: End hour (0-23)
    """
    item_id = request.args.get('item_id', type=int)
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)

    # Period A parameters
    period_a_days = request.args.get('period_a_days', '1,2,3,4,5')  # Default: Weekdays
    period_a_start_hour = request.args.get('period_a_start_hour', type=int, default=9)
    period_a_end_hour = request.args.get('period_a_end_hour', type=int, default=12)

    # Period B parameters
    period_b_days = request.args.get('period_b_days', '1,2,3,4,5')  # Default: Weekdays
    period_b_start_hour = request.args.get('period_b_start_hour', type=int, default=14)
    period_b_end_hour = request.args.get('period_b_end_hour', type=int, default=17)

    if not item_id:
        return error_response('item_id is required', 400)

    # Convert day strings to lists
    period_a_day_list = [int(d.strip()) for d in period_a_days.split(',')]
    period_b_day_list = [int(d.strip()) for d in period_b_days.split(',')]

    # Helper function to calculate revenue for a period
    def get_period_revenue(day_list, start_hour, end_hour):
        # Create placeholders for days
        day_placeholders = ','.join('?' * len(day_list))

        query = f'''
            SELECT 
                ROUND(SUM(t.total_amount), 2) as revenue,
                COUNT(DISTINCT DATE(t.transaction_date)) as days_counted,
                SUM(t.quantity) as units_sold
            FROM transactions t
            WHERE t.item_id = ?
            AND DATE(t.transaction_date) BETWEEN ? AND ?
            AND CAST(strftime('%w', t.transaction_date) AS INTEGER) IN ({day_placeholders})
            AND CAST(strftime('%H', t.transaction_date) AS INTEGER) >= ?
            AND CAST(strftime('%H', t.transaction_date) AS INTEGER) < ?
        '''

        # Execute query with parameters: item_id, start_date, end_date, days, start_hour, end_hour
        params = [item_id, start_date, end_date] + day_list + [start_hour, end_hour]
        cursor.execute(query, params)
        result = cursor.fetchone()

        revenue = result['revenue'] if result['revenue'] is not None else 0
        days_counted = result['days_counted'] if result['days_counted'] is not None else 0
        units_sold = result['units_sold'] if result['units_sold'] is not None else 0

        return {
            'revenue': revenue,
            'days_counted': days_counted,
            'units_sold': units_sold,
            'avg_per_day': round(revenue / days_counted, 2) if days_counted > 0 else 0
        }

    # Get item name
    cursor.execute('SELECT item_name, category FROM items WHERE item_id = ?', (item_id,))
    item_row = cursor.fetchone()
    if not item_row:
        return error_response('Item not found', 404)

    item_name = item_row['item_name']
    category = item_row['category']

    # Calculate revenues for both periods
    period_a_data = get_period_revenue(period_a_day_list, period_a_start_hour, period_a_end_hour)
    period_b_data = get_period_revenue(period_b_day_list, period_b_start_hour, period_b_end_hour)

    return success_response({
        'item_id': item_id,
        'item_name': item_name,
        'category': category,
        'date_range': {
            'start': start_date,
            'end': end_date
        },
        'period_a': {
            'days': period_a_day_list,
            'start_hour': period_a_start_hour,
            'end_hour': period_a_end_hour,
            **period_a_data
        },
        'period_b': {
            'days': period_b_day_list,
            'start_hour': period_b_start_hour,
            'end_hour': period_b_end_hour,
            **period_b_data
        }
    })