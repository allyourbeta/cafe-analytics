from flask import Blueprint, jsonify, request

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