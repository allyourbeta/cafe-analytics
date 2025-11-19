from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from database import with_database
from extensions import cache

# Import shared utilities
try:
    from utils import success_response
except ImportError:
    from ..utils import success_response

forecasts_bp = Blueprint('forecasts', __name__)


# P1: Daily Sales Forecast (next 21 days)
@forecasts_bp.route('/api/forecasts/daily', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def daily_forecast(cursor):
    today = datetime.now().date()

    # Single query: Get ALL daily sales for the past 28 days
    # This replaces 84 separate queries (21 days × 4 historical dates)
    query = '''
        SELECT 
            DATE(transaction_date) as sale_date,
            SUM(total_amount) as daily_sales
        FROM transactions
        WHERE DATE(transaction_date) >= DATE(?, '-28 days')
          AND DATE(transaction_date) < ?
        GROUP BY DATE(transaction_date)
    '''
    cursor.execute(query, (today.isoformat(), today.isoformat()))

    # Build a lookup dictionary: {date_string: sales_amount}
    sales_by_date = {row['sale_date']: row['daily_sales'] for row in cursor.fetchall()}

    forecasts = []

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

        # Look up sales data from our pre-fetched dictionary
        for historical_date in historical_dates:
            if historical_date < today:
                date_key = historical_date.isoformat()
                sales = sales_by_date.get(date_key, 0)

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

    return success_response(forecasts)


# P2: Hourly Sales Forecast (next 21 days)
@forecasts_bp.route('/api/forecasts/hourly', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def hourly_forecast(cursor):
    today = datetime.now().date()

    # Get target labor percentage from query params (default 28%)
    target_pct = request.args.get('target_pct', 28, type=int)
    if target_pct < 15 or target_pct > 40:
        target_pct = 28  # Fallback to default if out of bounds

    # Fetch student hourly wage rate from settings
    cursor.execute("SELECT setting_value FROM settings WHERE setting_key = 'hourly_labor_rate'")
    wage_row = cursor.fetchone()
    student_wage = float(wage_row['setting_value']) if wage_row else 24.19  # fallback to current rate

    # Helper function to calculate student hours range
    def calculate_student_hours_range(sales, target_percent, wage):
        """Calculate student hours range for scheduling"""
        import math

        labor_budget = sales * (target_percent / 100)
        exact_hours = labor_budget / wage

        # Round to nearest 0.5
        lower_bound = math.floor(exact_hours * 2) / 2  # Floor to 0.5
        upper_bound = math.ceil(exact_hours * 2) / 2  # Ceil to 0.5

        # If exact match to 0.5 boundary, return single value
        if lower_bound == upper_bound:
            return f"{exact_hours:.1f} hrs"

        return f"{lower_bound:.1f}-{upper_bound:.1f} hrs"

    # Single query: Get ALL hourly sales for the past 28 days
    # This replaces 84 separate queries (21 days × 4 historical dates)
    query = '''
        SELECT 
            DATE(transaction_date) as sale_date,
            strftime('%H', transaction_date) as hour_num,
            SUM(total_amount) as sales
        FROM transactions
        WHERE DATE(transaction_date) >= DATE(?, '-28 days')
          AND DATE(transaction_date) < ?
        GROUP BY sale_date, hour_num
    '''
    cursor.execute(query, (today.isoformat(), today.isoformat()))

    # Build a nested lookup dictionary: {date: {hour: sales}}
    sales_by_date_hour = {}
    for row in cursor.fetchall():
        date_key = row['sale_date']
        hour_key = row['hour_num']
        sales = row['sales']

        if date_key not in sales_by_date_hour:
            sales_by_date_hour[date_key] = {}
        sales_by_date_hour[date_key][hour_key] = sales

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

        # Look up hourly sales data from our pre-fetched dictionary
        hourly_sales_data = {}
        for date in historical_dates:
            if date < today:
                date_key = date.isoformat()
                if date_key in sales_by_date_hour:
                    hourly_sales_data[date_key] = sales_by_date_hour[date_key]

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

            # Calculate student hours range for this forecast
            student_hours = calculate_student_hours_range(avg_sales, target_pct, student_wage)

            hourly_forecasts.append({
                'hour': f"{hour_str}:00",
                'avg_sales': round(avg_sales, 2),
                'student_hours': student_hours
            })

        all_forecasts.append({
            'date': forecast_date.isoformat(),
            'day_of_week': day_of_week,
            'hourly_data': hourly_forecasts,
            'basis': f'Avg of last {len(hourly_sales_data)} valid weeks'
        })

    return success_response(all_forecasts)


# P3: Item Demand Forecast (next 21 days, grouped by week)
@forecasts_bp.route('/api/forecasts/items', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def item_demand_forecast(cursor):
    today = datetime.now().date()

    # Get all items from the menu
    cursor.execute('SELECT item_id, item_name, category FROM items ORDER BY item_name')
    items = cursor.fetchall()

    # Single query: Get ALL item sales for the past 28 days
    # This replaces 16,800 separate queries (200 items × 21 days × 4 historical dates)
    query = '''
        SELECT 
            item_id,
            DATE(transaction_date) as sale_date,
            SUM(quantity) as total_qty
        FROM transactions
        WHERE DATE(transaction_date) >= DATE(?, '-28 days')
          AND DATE(transaction_date) < ?
        GROUP BY item_id, DATE(transaction_date)
    '''
    cursor.execute(query, (today.isoformat(), today.isoformat()))

    # Build a nested lookup dictionary: {item_id: {date: quantity}}
    sales_by_item_date = {}
    for row in cursor.fetchall():
        item_id = row['item_id']
        date_key = row['sale_date']
        qty = row['total_qty']

        if item_id not in sales_by_item_date:
            sales_by_item_date[item_id] = {}
        sales_by_item_date[item_id][date_key] = qty

    all_forecasts = []

    for item in items:
        item_id = item['item_id']
        item_name = item['item_name']
        category = item['category']

        daily_forecasts = []
        is_new_item = True  # Assume new until we find historical data

        # Get this item's historical sales (if any)
        item_sales = sales_by_item_date.get(item_id, {})

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

            # Look up quantities from our pre-fetched dictionary
            quantities = []
            for date in historical_dates:
                if date < today:
                    date_key = date.isoformat()
                    qty = item_sales.get(date_key)

                    if qty is not None:
                        quantities.append(qty)
                        is_new_item = False  # Found historical data

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
@forecasts_bp.route('/api/forecasts/categories', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
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

    return success_response(all_forecasts)
