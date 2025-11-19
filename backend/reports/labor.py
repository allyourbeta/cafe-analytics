from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta

from database import with_database
from extensions import cache

# Import shared utilities
try:
    from utils import get_default_date_range, success_response
except ImportError:
    from ..utils import get_default_date_range, success_response

# Import labor utilities
try:
    from labor_utils import calculate_hourly_labor_costs
except ImportError:
    from ..labor_utils import calculate_hourly_labor_costs

labor_bp = Blueprint('labor', __name__)


# R1: Sales per Labor Hour
@labor_bp.route('/api/reports/sales-per-hour', methods=['GET'])
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

        return success_response(data, mode='single', date=target_date)

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

        return success_response(data, mode='day-of-week', date_range={'start': start_date, 'end': end_date})

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

        return success_response(
            data,
            mode='average',
            date_range={'start': start_date, 'end': end_date},
            metadata={
                'total_days_in_range': total_days_in_range,
                'days_with_data': days_with_data_count,
                'missing_days': missing_days_count
            }
        )


# R2: Labor % per Labor Hour (with accurate proration)
@labor_bp.route('/api/reports/labor-percent', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)  # 12 hours
@with_database
def labor_percent(cursor):
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    include_salaried = request.args.get('include_salaried', 'true').lower() == 'true'

    # First, check if there's any revenue data in this date range
    revenue_check_query = '''
        SELECT COUNT(*) as transaction_count
        FROM transactions
        WHERE DATE(transaction_date) BETWEEN ? AND ?
    '''
    cursor.execute(revenue_check_query, (start_date, end_date))
    has_revenue_data = cursor.fetchone()['transaction_count'] > 0

    # If no revenue data, return empty result (like items_by_revenue does)
    if not has_revenue_data:
        return success_response(
            [],
            date_range={'start': start_date, 'end': end_date},
            include_salaried=include_salaried
        )

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

    return success_response(
        data,
        date_range={'start': start_date, 'end': end_date},
        include_salaried=include_salaried
    )