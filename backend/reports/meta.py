from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
from calendar import monthrange

from database import with_database
from extensions import cache

# Import shared utilities
try:
    from utils import get_default_date_range, success_response
except ImportError:
    from ..utils import get_default_date_range, success_response

meta_bp = Blueprint('meta', __name__)


# Total Sales for date range
@meta_bp.route('/api/total-sales', methods=['GET'])
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

    return jsonify(success_response({
        'total_sales': total,
        'start_date': start_date,
        'end_date': end_date
    }))


# Get all items (for dropdowns)
@meta_bp.route('/api/items', methods=['GET'])
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

    return success_response(items)


# R8: Get top items for heatmap selector
@meta_bp.route('/api/reports/top-items', methods=['GET'])
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

    return success_response(items, date_range={'start': start_date, 'end': end_date})


# R11: Weekly and Monthly Revenue Trends
@meta_bp.route('/api/reports/revenue-trends', methods=['GET'])
@cache.cached(timeout=43200, query_string=True)
@with_database
def revenue_trends(cursor):
    """
    Get revenue totals aggregated by week or month.

    Params:
    - start: Start date (YYYY-MM-DD)
    - end: End date (YYYY-MM-DD)
    - granularity: 'week' or 'month'

    Returns only complete periods. Weeks are Mon-Sun.
    """
    default_start, default_end = get_default_date_range()
    start_date = request.args.get('start', default_start)
    end_date = request.args.get('end', default_end)
    granularity = request.args.get('granularity', 'week')

    # Parse dates
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d')

    periods = []
    excluded_partial = None

    if granularity == 'week':
        # Find first Monday on or after start_date
        days_until_monday = (7 - start_dt.weekday()) % 7
        if start_dt.weekday() != 0:  # If not already Monday
            first_monday = start_dt + timedelta(days=days_until_monday)
            # Record the excluded partial week
            excluded_partial = {
                'start': start_date,
                'end': (first_monday - timedelta(days=1)).strftime('%Y-%m-%d'),
                'reason': 'Partial week omitted at start of range'
            }
        else:
            first_monday = start_dt

        # Generate complete weeks (Mon-Sun)
        current_monday = first_monday
        while current_monday <= end_dt:
            current_sunday = current_monday + timedelta(days=6)

            # Only include if the full week is within range
            if current_sunday <= end_dt:
                week_start = current_monday.strftime('%Y-%m-%d')
                week_end = current_sunday.strftime('%Y-%m-%d')

                # Query revenue for this week
                cursor.execute('''
                    SELECT ROUND(SUM(total_amount), 2) as revenue
                    FROM transactions
                    WHERE DATE(transaction_date) BETWEEN ? AND ?
                ''', (week_start, week_end))

                row = cursor.fetchone()
                revenue = row['revenue'] if row['revenue'] is not None else 0

                # Format label like "Nov 4-10"
                start_month = current_monday.strftime('%b')
                start_day = current_monday.day
                end_day = current_sunday.day

                if current_monday.month == current_sunday.month:
                    label = f"{start_month} {start_day}-{end_day}"
                else:
                    end_month = current_sunday.strftime('%b')
                    label = f"{start_month} {start_day} - {end_month} {end_day}"

                periods.append({
                    'label': label,
                    'start_date': week_start,
                    'end_date': week_end,
                    'revenue': revenue,
                    'is_complete': True
                })
            else:
                # Partial week at end - record but don't include
                if not excluded_partial:
                    excluded_partial = {
                        'start': current_monday.strftime('%Y-%m-%d'),
                        'end': end_date,
                        'reason': 'Partial week omitted at end of range'
                    }
                elif excluded_partial.get('reason') == 'Partial week at start of range':
                    # Both start and end have partials
                    excluded_partial = {
                        'start': excluded_partial['start'],
                        'end': excluded_partial['end'],
                        'reason': 'Partial weeks at start and end of range',
                        'end_partial_start': current_monday.strftime('%Y-%m-%d'),
                        'end_partial_end': end_date
                    }

            current_monday += timedelta(days=7)

    elif granularity == 'month':
        # Find first day of first complete month
        if start_dt.day != 1:
            # Start is mid-month, so first complete month starts next month
            if start_dt.month == 12:
                first_complete_month = datetime(start_dt.year + 1, 1, 1)
            else:
                first_complete_month = datetime(start_dt.year, start_dt.month + 1, 1)

            # Record excluded partial
            last_day_of_start_month = monthrange(start_dt.year, start_dt.month)[1]
            excluded_partial = {
                'start': start_date,
                'end': datetime(start_dt.year, start_dt.month, last_day_of_start_month).strftime('%Y-%m-%d'),
                'reason': 'Partial month omitted at start of range'
            }
        else:
            first_complete_month = start_dt

        # Generate complete months
        current_month_start = first_complete_month
        while current_month_start <= end_dt:
            # Get last day of this month
            last_day = monthrange(current_month_start.year, current_month_start.month)[1]
            current_month_end = datetime(current_month_start.year, current_month_start.month, last_day)

            # Only include if the full month is within range
            if current_month_end <= end_dt:
                month_start = current_month_start.strftime('%Y-%m-%d')
                month_end = current_month_end.strftime('%Y-%m-%d')

                # Query revenue for this month
                cursor.execute('''
                    SELECT ROUND(SUM(total_amount), 2) as revenue
                    FROM transactions
                    WHERE DATE(transaction_date) BETWEEN ? AND ?
                ''', (month_start, month_end))

                row = cursor.fetchone()
                revenue = row['revenue'] if row['revenue'] is not None else 0

                # Format label like "November 2024"
                label = current_month_start.strftime('%B %Y')

                periods.append({
                    'label': label,
                    'start_date': month_start,
                    'end_date': month_end,
                    'revenue': revenue,
                    'is_complete': True
                })
            else:
                # Partial month at end
                if not excluded_partial:
                    excluded_partial = {
                        'start': current_month_start.strftime('%Y-%m-%d'),
                        'end': end_date,
                        'reason': 'Partial month omitted at end of range'
                    }

            # Move to next month
            if current_month_start.month == 12:
                current_month_start = datetime(current_month_start.year + 1, 1, 1)
            else:
                current_month_start = datetime(current_month_start.year, current_month_start.month + 1, 1)

    # Calculate average across all periods
    if periods:
        total_revenue = sum(p['revenue'] for p in periods)
        average = round(total_revenue / len(periods), 2)
    else:
        average = 0

    return success_response({
        'periods': periods,
        'average': average,
        'excluded_partial': excluded_partial,
        'granularity': granularity
    }, date_range={'start': start_date, 'end': end_date})