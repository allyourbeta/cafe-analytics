from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_caching import Cache
import sqlite3
from datetime import datetime, timedelta
import os
from functools import wraps
from labor_utils import calculate_hourly_labor_costs

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize cache - 12 hour default timeout since data updates once daily
cache = Cache(app, config={
    'CACHE_TYPE': 'simple',
    'CACHE_DEFAULT_TIMEOUT': 43200  # 12 hours
})

# Get absolute path relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '../database/cafe_reports.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")  # Enforce FK constraints
    conn.row_factory = sqlite3.Row
    return conn


def with_database(f):
    """
    Decorator that provides automatic database connection management.

    Usage:
        @app.route('/api/endpoint')
        @with_database
        def my_endpoint(cursor, **kwargs):
            cursor.execute("SELECT ...")
            return {'data': [...]}

    Benefits:
    - Automatic connection opening and closing
    - Connection closed even if exception occurs
    - Consistent error response formatting
    - Reduces boilerplate by ~12 lines per endpoint
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        conn = None
        try:
            conn = get_db()
            cursor = conn.cursor()

            # Call the wrapped function with cursor
            result = f(cursor=cursor, *args, **kwargs)

            # If result is a dict, wrap it in jsonify
            if isinstance(result, dict):
                return jsonify(result)
            # If it's already a Response object, return as-is
            return result

        except Exception as e:
            # Consistent error response format
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

        finally:
            # Always close connection, even on error
            if conn:
                conn.close()

    return decorated_function


def get_default_date_range():
    """
    Calculate sensible default date range for API endpoints.
    Returns (start_date, end_date) as strings in 'YYYY-MM-DD' format.

    Default: Last 90 days of data from today.
    """
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

    return start_date, end_date


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Backend running!'})


@app.route('/api/admin/clear-cache', methods=['POST'])
def clear_cache():
    """Clear all cached data - useful after database updates"""
    try:
        cache.clear()
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# R3: Items by Revenue
@app.route('/api/reports/items-by-revenue', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_revenue(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)

    query = '''
        SELECT 
            i.item_id,
            i.item_name,
            i.category,
            SUM(t.quantity) as units_sold,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
        GROUP BY t.item_id, i.item_name, i.category
        ORDER BY revenue DESC
    '''

    cursor.execute(query, (start_date, end_date))
    rows = cursor.fetchall()

    items = [dict(row) for row in rows]

    return {
        'success': True,
        'data': items,
        'date_range': {'start': start_date, 'end': end_date}
    }


# Total Sales for date range
@app.route('/api/total-sales', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def total_sales(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)

    query = '''
        SELECT ROUND(SUM(total_amount), 2) as total_sales
        FROM transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
    '''

    cursor.execute(query, (start_date, end_date))
    row = cursor.fetchone()

    total = row['total_sales'] if row['total_sales'] is not None else 0

    return {
        'success': True,
        'data': {
            'total_sales': total,
            'start_date': start_date,
            'end_date': end_date
        }
    }


# R1: Sales per Labor Hour
@app.route('/api/reports/sales-per-hour', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)  # 12 hours
@with_database
def sales_per_hour(cursor):
    mode = request.args.get('mode', 'average')  # 'average', 'single', or 'day-of-week'
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    single_date = request.args.get('date')  # For single mode

    if mode == 'single':
        # Single day mode - show actual sales for specific day
        target_date = single_date if single_date else end_date

        query = '''
            SELECT 
                strftime('%H:00', transaction_date) as hour,
                ROUND(SUM(total_amount), 2) as sales
            FROM transactions
            WHERE DATE(transaction_date) = ?
            GROUP BY hour
            ORDER BY hour
        '''

        cursor.execute(query, (target_date,))
        rows = cursor.fetchall()
        data = [dict(row) for row in rows]

        return {
            'success': True,
            'mode': 'single',
            'data': data,
            'date': target_date
        }

    elif mode == 'day-of-week':
        # Day-of-week mode - calculate average sales per hour for each day of week
        # We need to divide by the count of that specific day of week, not all days
        query = '''
            WITH hourly_sales AS (
                SELECT 
                    CASE CAST(strftime('%w', transaction_date) AS INTEGER)
                        WHEN 0 THEN 'Sunday'
                        WHEN 1 THEN 'Monday'
                        WHEN 2 THEN 'Tuesday'
                        WHEN 3 THEN 'Wednesday'
                        WHEN 4 THEN 'Thursday'
                        WHEN 5 THEN 'Friday'
                        WHEN 6 THEN 'Saturday'
                    END as day_of_week,
                    CAST(strftime('%w', transaction_date) AS INTEGER) as day_num,
                    strftime('%H:00', transaction_date) as hour,
                    DATE(transaction_date) as date,
                    SUM(total_amount) as daily_hourly_sales
                FROM transactions
                WHERE DATE(transaction_date) BETWEEN ? AND ?
                GROUP BY day_of_week, day_num, hour, date
            )
            SELECT 
                day_of_week,
                day_num,
                hour,
                ROUND(AVG(daily_hourly_sales), 2) as sales
            FROM hourly_sales
            GROUP BY day_of_week, day_num, hour
            ORDER BY day_num, hour
        '''

        cursor.execute(query, (start_date, end_date))
        rows = cursor.fetchall()

        # Group data by day of week
        data_by_day = {}
        for row in rows:
            day = row['day_of_week']
            if day not in data_by_day:
                data_by_day[day] = []
            data_by_day[day].append({
                'hour': row['hour'],
                'sales': row['sales']
            })

        # Convert to ordered list format
        day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        data = []
        for day in day_order:
            if day in data_by_day:
                data.append({
                    'day_of_week': day,
                    'hourly_data': data_by_day[day]
                })

        return {
            'success': True,
            'mode': 'day-of-week',
            'data': data,
            'date_range': {'start': start_date, 'end': end_date}
        }

    else:
        # Average mode - calculate average sales per hour across date range
        # First, get all days that have data in the range
        days_query = '''
            SELECT DISTINCT DATE(transaction_date) as day
            FROM transactions
            WHERE DATE(transaction_date) BETWEEN ? AND ?
            ORDER BY day
        '''
        cursor.execute(days_query, (start_date, end_date))
        days_with_data = [row['day'] for row in cursor.fetchall()]

        # Calculate total days in range for missing data note
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        total_days_in_range = (end - start).days + 1
        days_with_data_count = len(days_with_data)
        missing_days_count = total_days_in_range - days_with_data_count

        # Get average sales per hour across all days with data
        query = '''
            SELECT 
                hour,
                ROUND(AVG(hourly_sales), 2) as sales
            FROM (
                SELECT 
                    strftime('%H:00', transaction_date) as hour,
                    DATE(transaction_date) as day,
                    SUM(total_amount) as hourly_sales
                FROM transactions
                WHERE DATE(transaction_date) BETWEEN ? AND ?
                GROUP BY day, hour
            )
            GROUP BY hour
            ORDER BY hour
        '''

        cursor.execute(query, (start_date, end_date))
        rows = cursor.fetchall()
        data = [dict(row) for row in rows]

        return {
            'success': True,
            'mode': 'average',
            'data': data,
            'date_range': {'start': start_date, 'end': end_date},
            'metadata': {
                'total_days_in_range': total_days_in_range,
                'days_with_data': days_with_data_count,
                'missing_days': missing_days_count
            }
        }


# R2: Labor % per Labor Hour (with accurate proration)
@app.route('/api/reports/labor-percent', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)  # 12 hours
@with_database
def labor_percent(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    include_salaried = request.args.get('include_salaried', 'true').lower() == 'true'

    # Get hourly sales from transactions
    sales_query = '''
        SELECT 
            strftime('%Y-%m-%d %H:00:00', transaction_date) as hour,
            ROUND(SUM(total_amount), 2) as sales
        FROM transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
        GROUP BY hour
        ORDER BY hour
    '''

    cursor.execute(sales_query, (start_date, end_date))
    sales_data = {row['hour']: row['sales'] for row in cursor.fetchall()}

    # Calculate hourly labor costs with proper proration and breakdown
    # Returns: {'hour': {'total_cost': X, 'salaried_hours': Y, 'salaried_cost': Z, ...}}
    # Note: calculate_hourly_labor_costs needs connection, not cursor
    conn = cursor.connection
    labor_breakdown = calculate_hourly_labor_costs(conn, start_date, end_date, include_salaried)

    # Combine sales and labor data
    # Get all hours that have either sales or labor
    all_hours = set(sales_data.keys()) | set(labor_breakdown.keys())

    data = []
    for hour in sorted(all_hours):
        sales = sales_data.get(hour, 0)
        breakdown = labor_breakdown.get(hour, {
            'total_cost': 0,
            'salaried_hours': 0,
            'salaried_cost': 0,
            'student_hours': 0,
            'student_cost': 0
        })

        labor_cost = breakdown['total_cost']

        # Skip hours with no activity (no sales and no labor)
        if sales == 0 and labor_cost == 0:
            continue

        # Calculate labor percentage with zero sales edge case handling
        if sales == 0:
            labor_pct = 100  # Labor but no sales = 100% (capped, not infinity)
        else:
            labor_pct = round(labor_cost / sales * 100, 2)

        data.append({
            'hour': hour,
            'sales': sales,
            'labor_cost': round(labor_cost, 2),
            'labor_pct': labor_pct,
            # Breakdown for tooltip
            'salaried_hours': round(breakdown['salaried_hours'], 2),
            'salaried_cost': round(breakdown['salaried_cost'], 2),
            'student_hours': round(breakdown['student_hours'], 2),
            'student_cost': round(breakdown['student_cost'], 2)
        })

    return {
        'success': True,
        'data': data,
        'date_range': {'start': start_date, 'end': end_date},
        'include_salaried': include_salaried
    }


# R4: Items by Total Profit
@app.route('/api/reports/items-by-profit', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_profit(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    item_type = request.args.get('item_type', 'all')  # 'all', 'purchased', 'house-made'

    # Base query with sold_unaltered field
    query = '''
        SELECT 
            i.item_id,
            i.item_name,
            i.category,
            i.sold_unaltered,
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
        query += ' AND i.sold_unaltered = 1'
    elif item_type == 'house-made':
        query += ' AND i.sold_unaltered = 0'

    query += '''
        GROUP BY t.item_id, i.item_name, i.category, i.sold_unaltered
        ORDER BY total_profit DESC
    '''

    cursor.execute(query, params)
    rows = cursor.fetchall()

    data = [dict(row) for row in rows]

    return {
        'success': True,
        'data': data,
        'date_range': {'start': start_date, 'end': end_date},
        'item_type': item_type
    }


# R5: Items by Profitability %
@app.route('/api/reports/items-by-margin', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def items_by_margin(cursor):
    item_type = request.args.get('item_type', 'all')  # 'all', 'purchased', 'house-made'

    query = '''
        SELECT 
            item_id,
            item_name,
            category,
            sold_unaltered,
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
        query += ' AND sold_unaltered = 1'
    elif item_type == 'house-made':
        query += ' AND sold_unaltered = 0'

    query += ' ORDER BY margin_pct DESC'

    cursor.execute(query, params)
    rows = cursor.fetchall()

    data = [dict(row) for row in rows]

    return {
        'success': True,
        'data': data,
        'item_type': item_type
    }


# R6: Categories by Revenue (aggregated by category)
@app.route('/api/reports/categories-by-revenue', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def categories_by_revenue(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)

    query = '''
        SELECT 
            i.category,
            SUM(t.quantity) as units_sold,
            ROUND(SUM(t.total_amount), 2) as revenue
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
        GROUP BY i.category
        ORDER BY revenue DESC
    '''

    cursor.execute(query, (start_date, end_date))
    rows = cursor.fetchall()

    categories = [dict(row) for row in rows]

    return {
        'success': True,
        'data': categories,
        'date_range': {'start': start_date, 'end': end_date}
    }


# R7: Categories by Profit (aggregated by category)
@app.route('/api/reports/categories-by-profit', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def categories_by_profit(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)

    query = '''
        SELECT 
            i.category,
            SUM(t.quantity) as units_sold,
            ROUND(SUM((t.unit_price - i.current_cost) * t.quantity), 2) as total_profit,
            ROUND(SUM((t.unit_price - i.current_cost) * t.quantity) / NULLIF(SUM(t.unit_price * t.quantity), 0) * 100, 2) as margin_pct
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
        GROUP BY i.category
        ORDER BY total_profit DESC
    '''

    cursor.execute(query, (start_date, end_date))
    rows = cursor.fetchall()

    categories = [dict(row) for row in rows]

    return {
        'success': True,
        'data': categories,
        'date_range': {'start': start_date, 'end': end_date}
    }


# R8: Get top items for heatmap selector
@app.route('/api/reports/top-items', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def top_items(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    limit = int(request.args.get('limit', 25))

    query = '''
        SELECT 
            i.item_id,
            i.item_name,
            i.category,
            ROUND(SUM(t.total_amount), 2) as total_revenue
        FROM transactions t
        JOIN items i ON t.item_id = i.item_id
        WHERE DATE(t.transaction_date) BETWEEN ? AND ?
        GROUP BY i.item_id, i.item_name, i.category
        ORDER BY total_revenue DESC
        LIMIT ?
    '''

    cursor.execute(query, (start_date, end_date, limit))
    rows = cursor.fetchall()

    items = [dict(row) for row in rows]

    return {
        'success': True,
        'data': items,
        'date_range': {'start': start_date, 'end': end_date}
    }


# R9: Item heatmap data (hourly × daily patterns)
@app.route('/api/reports/item-heatmap', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def item_heatmap(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    item_id = request.args.get('item_id')

    if not item_id:
        return jsonify({'success': False, 'error': 'item_id required'}), 400

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

    return {
        'success': True,
        'data': data,
        'date_range': {'start': start_date, 'end': end_date}
    }


# P1: Daily Sales Forecast (next 21 days)
@app.route('/api/forecasts/daily', methods=['GET'])
@with_database
def daily_forecast(cursor):
    forecasts = []
    today = datetime.now().date()

    # Generate a forecast for the next 21 days
    for i in range(1, 22):
        forecast_date = today + timedelta(days=i)
        day_of_week = forecast_date.strftime('%A')

        # Always attempt to look at the four previous corresponding weekdays
        historical_dates = [
            forecast_date - timedelta(days=7),
            forecast_date - timedelta(days=14),
            forecast_date - timedelta(days=21),
            forecast_date - timedelta(days=28),
        ]

        sales_points = []

        # Fetch sales data, but only for historical dates that are actually in the past
        for historical_date in historical_dates:
            if historical_date < today:
                query = '''
                    SELECT SUM(total_amount) as daily_sales
                    FROM transactions
                    WHERE DATE(transaction_date) = ?
                '''
                cursor.execute(query, (historical_date.isoformat(),))
                result = cursor.fetchone()
                sales = result['daily_sales'] if result and result['daily_sales'] else 0

                # Only include non-zero sales in the average
                if sales > 0:
                    sales_points.append(sales)

        # Calculate the forecast based on the available, non-zero data points
        if not sales_points:
            forecasted_sales = 0
        else:
            forecasted_sales = sum(sales_points) / len(sales_points)

        forecasts.append({
            'date': forecast_date.isoformat(),
            'day_of_week': day_of_week,
            'forecasted_sales': round(forecasted_sales, 2),
            'basis': f'Avg of last {len(sales_points)} valid weeks'
        })

    return {
        'success': True,
        'data': forecasts
    }


# P2: Hourly Sales Forecast (next 21 days)
@app.route('/api/forecasts/hourly', methods=['GET'])
@with_database
def hourly_forecast(cursor):
    today = datetime.now().date()

    all_forecasts = []

    # Generate forecasts for the next 21 days
    for day_offset in range(1, 22):
        forecast_date = today + timedelta(days=day_offset)
        day_of_week = forecast_date.strftime('%A')

        # Historical dates for this forecast (same day of week)
        historical_dates = [
            forecast_date - timedelta(days=7),
            forecast_date - timedelta(days=14),
            forecast_date - timedelta(days=21),
            forecast_date - timedelta(days=28),
        ]

        # Fetch hourly sales data for each historical date
        hourly_sales_data = {}
        for date in historical_dates:
            if date < today:  # Only look at past dates
                query = '''
                    SELECT 
                        strftime('%H', transaction_date) as hour_num,
                        SUM(total_amount) as sales
                    FROM transactions
                    WHERE DATE(transaction_date) = ?
                    GROUP BY hour_num
                '''
                cursor.execute(query, (date.isoformat(),))
                rows = cursor.fetchall()

                sales_by_hour = {row['hour_num']: row['sales'] for row in rows}
                hourly_sales_data[date.isoformat()] = sales_by_hour

        # Calculate hourly forecasts for this day
        hourly_forecasts = []
        for hour in range(7, 22):
            hour_str = f"{hour:02d}"
            sales_points = []

            # Collect sales from all historical dates for this hour
            for date_key in hourly_sales_data:
                sale = hourly_sales_data[date_key].get(hour_str, 0)
                if sale > 0:
                    sales_points.append(sale)

            # Calculate average
            if not sales_points:
                avg_sales = 0
            else:
                avg_sales = sum(sales_points) / len(sales_points)

            hourly_forecasts.append({
                'hour': f"{hour_str}:00",
                'avg_sales': round(avg_sales, 2)
            })

        all_forecasts.append({
            'date': forecast_date.isoformat(),
            'day_of_week': day_of_week,
            'hourly_data': hourly_forecasts,
            'basis': f'Avg of last {len(hourly_sales_data)} valid weeks'
        })

    return {
        'success': True,
        'data': all_forecasts
    }


# P3: Item Demand Forecast (next 21 days, grouped by week)
@app.route('/api/forecasts/items', methods=['GET'])
@with_database
def item_demand_forecast(cursor):
    today = datetime.now().date()

    # Get all items from the menu
    cursor.execute('SELECT item_id, item_name, category FROM items ORDER BY item_name')
    items = cursor.fetchall()

    all_forecasts = []

    for item in items:
        item_id = item['item_id']
        item_name = item['item_name']
        category = item['category']

        daily_forecasts = []
        is_new_item = True  # Assume new until we find historical data

        # Generate forecasts for the next 21 days
        for day_offset in range(1, 22):
            forecast_date = today + timedelta(days=day_offset)
            day_of_week = forecast_date.strftime('%A')

            # Historical dates for this forecast (same day of week)
            historical_dates = [
                forecast_date - timedelta(days=7),
                forecast_date - timedelta(days=14),
                forecast_date - timedelta(days=21),
                forecast_date - timedelta(days=28),
            ]

            # Fetch quantities sold on historical dates
            quantities = []
            for date in historical_dates:
                if date < today:
                    query = '''
                        SELECT SUM(quantity) as total_qty
                        FROM transactions
                        WHERE item_id = ?
                        AND DATE(transaction_date) = ?
                    '''
                    cursor.execute(query, (item_id, date.isoformat()))
                    result = cursor.fetchone()

                    if result['total_qty'] is not None:
                        quantities.append(result['total_qty'])
                        is_new_item = False  # Found historical data
                    # If NULL, don't add to list (item didn't exist or wasn't sold)

            # Calculate forecast
            if len(quantities) > 0:
                avg_quantity = sum(quantities) / len(quantities)
                forecast_qty = round(avg_quantity)  # Round to whole number
            else:
                forecast_qty = 0

            daily_forecasts.append({
                'date': forecast_date.isoformat(),
                'day_of_week': day_of_week,
                'quantity': forecast_qty
            })

        # Group by week with date ranges
        weekly_forecast = [
            {
                'week': 1,
                'start_date': daily_forecasts[0]['date'],
                'end_date': daily_forecasts[6]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[0:7])
            },
            {
                'week': 2,
                'start_date': daily_forecasts[7]['date'],
                'end_date': daily_forecasts[13]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[7:14])
            },
            {
                'week': 3,
                'start_date': daily_forecasts[14]['date'],
                'end_date': daily_forecasts[20]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[14:21])
            }
        ]

        total_forecast = sum(w['quantity'] for w in weekly_forecast)

        all_forecasts.append({
            'item_id': item_id,
            'item_name': item_name,
            'category': category,
            'is_new': is_new_item,
            'weekly_forecast': weekly_forecast,
            'total_forecast': total_forecast
        })

    # Sort by total forecast descending
    all_forecasts.sort(key=lambda x: x['total_forecast'], reverse=True)

    return {
        'success': True,
        'data': all_forecasts
    }


# P4: Category Demand Forecast (next 21 days, grouped by week)
@app.route('/api/forecasts/categories', methods=['GET'])
@with_database
def category_demand_forecast(cursor):
    today = datetime.now().date()

    # Get all unique categories
    cursor.execute('SELECT DISTINCT category FROM items ORDER BY category')
    categories = [row['category'] for row in cursor.fetchall()]

    all_forecasts = []

    for category in categories:
        # Get all items in this category
        cursor.execute('SELECT item_id FROM items WHERE category = ?', (category,))
        item_ids = [row['item_id'] for row in cursor.fetchall()]

        if not item_ids:
            continue

        daily_forecasts = []
        is_new_category = True

        # Generate forecasts for the next 21 days
        for day_offset in range(1, 22):
            forecast_date = today + timedelta(days=day_offset)
            day_of_week = forecast_date.strftime('%A')

            # Historical dates
            historical_dates = [
                forecast_date - timedelta(days=7),
                forecast_date - timedelta(days=14),
                forecast_date - timedelta(days=21),
                forecast_date - timedelta(days=28),
            ]

            # Fetch total quantities for all items in category
            quantities = []
            for date in historical_dates:
                if date < today:
                    placeholders = ','.join('?' * len(item_ids))
                    query = f'''
                        SELECT SUM(quantity) as total_qty
                        FROM transactions
                        WHERE item_id IN ({placeholders})
                        AND DATE(transaction_date) = ?
                    '''
                    cursor.execute(query, (*item_ids, date.isoformat()))
                    result = cursor.fetchone()

                    if result['total_qty'] is not None:
                        quantities.append(result['total_qty'])
                        is_new_category = False

            # Calculate forecast
            if len(quantities) > 0:
                avg_quantity = sum(quantities) / len(quantities)
                forecast_qty = round(avg_quantity)
            else:
                forecast_qty = 0

            daily_forecasts.append({
                'date': forecast_date.isoformat(),
                'day_of_week': day_of_week,
                'quantity': forecast_qty
            })

        # Group by week with date ranges
        weekly_forecast = [
            {
                'week': 1,
                'start_date': daily_forecasts[0]['date'],
                'end_date': daily_forecasts[6]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[0:7])
            },
            {
                'week': 2,
                'start_date': daily_forecasts[7]['date'],
                'end_date': daily_forecasts[13]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[7:14])
            },
            {
                'week': 3,
                'start_date': daily_forecasts[14]['date'],
                'end_date': daily_forecasts[20]['date'],
                'quantity': sum(d['quantity'] for d in daily_forecasts[14:21])
            }
        ]

        total_forecast = sum(w['quantity'] for w in weekly_forecast)

        all_forecasts.append({
            'category': category,
            'is_new': is_new_category,
            'weekly_forecast': weekly_forecast,
            'total_forecast': total_forecast
        })

    # Sort by total forecast descending
    all_forecasts.sort(key=lambda x: x['total_forecast'], reverse=True)

    return {
        'success': True,
        'data': all_forecasts
    }


# Get all items (for dropdowns)
@app.route('/api/items', methods=['GET'])
@with_database
def get_all_items(cursor):
    query = '''
        SELECT item_id, item_name, category
        FROM items
        ORDER BY item_name
    '''

    cursor.execute(query)
    rows = cursor.fetchall()
    items = [dict(row) for row in rows]

    return {
        'success': True,
        'data': items
    }


# R10: Time Period Comparison
@app.route('/api/reports/time-period-comparison', methods=['GET'])
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
        return jsonify({'success': False, 'error': 'item_id is required'}), 400

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
        return jsonify({'success': False, 'error': 'Item not found'}), 404

    item_name = item_row['item_name']
    category = item_row['category']

    # Calculate revenues for both periods
    period_a_data = get_period_revenue(period_a_day_list, period_a_start_hour, period_a_end_hour)
    period_b_data = get_period_revenue(period_b_day_list, period_b_start_hour, period_b_end_hour)

    return {
        'success': True,
        'data': {
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
        }
    }


from flask import send_from_directory


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    frontend_dir = os.path.join(BASE_DIR, '../frontend/dist')
    if path and os.path.exists(os.path.join(frontend_dir, path)):
        return send_from_directory(frontend_dir, path)
    return send_from_directory(frontend_dir, 'index.html')


if __name__ == '__main__':
    print("🚀 Backend starting...")
    print("📊 Running at: http://localhost:5500")
    print("🔍 Test: http://localhost:5500/api/health")
    print("\n📍 Available endpoints:")
    print("  /api/reports/items-by-revenue")
    print("  /api/reports/sales-per-hour")
    print("  /api/reports/labor-percent")
    print("  /api/reports/items-by-profit")
    print("  /api/reports/items-by-margin")
    print("  /api/reports/time-period-comparison")
    print("  /api/forecasts/daily")
    print("  /api/forecasts/hourly")
    print("  /api/forecasts/items")
    print("  /api/forecasts/categories")
    print("  /api/items")
    app.run(debug=True, port=5500, host='0.0.0.0')