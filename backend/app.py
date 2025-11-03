from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta
import os
from labor_utils import calculate_hourly_labor_costs

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Get absolute path relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '../database/cafe_reports.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")  # Enforce FK constraints
    conn.row_factory = sqlite3.Row
    return conn


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Backend running!'})


# R3: Items by Revenue
@app.route('/api/reports/items-by-revenue', methods=['GET'])
def items_by_revenue():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')

    try:
        conn = get_db()
        cursor = conn.cursor()

        query = '''
            SELECT 
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
        conn.close()

        return jsonify({
            'success': True,
            'data': items,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R1: Sales per Labor Hour
@app.route('/api/reports/sales-per-hour', methods=['GET'])
def sales_per_hour():
    mode = request.args.get('mode', 'average')  # 'average' or 'single'
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    single_date = request.args.get('date')  # For single mode

    try:
        conn = get_db()
        cursor = conn.cursor()

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

            conn.close()

            return jsonify({
                'success': True,
                'mode': 'single',
                'data': data,
                'date': target_date
            })

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

            conn.close()

            return jsonify({
                'success': True,
                'mode': 'average',
                'data': data,
                'date_range': {'start': start_date, 'end': end_date},
                'metadata': {
                    'total_days_in_range': total_days_in_range,
                    'days_with_data': days_with_data_count,
                    'missing_days': missing_days_count
                }
            })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R2: Labor % per Labor Hour (with accurate proration)
@app.route('/api/reports/labor-percent', methods=['GET'])
def labor_percent():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    include_salaried = request.args.get('include_salaried', 'true').lower() == 'true'

    try:
        conn = get_db()
        cursor = conn.cursor()

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

            # Calculate labor percentage with zero sales edge case handling
            if sales == 0:
                if labor_cost == 0:
                    labor_pct = 0  # No sales, no labor = 0%
                else:
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

        conn.close()

        return jsonify({
            'success': True,
            'data': data,
            'date_range': {'start': start_date, 'end': end_date},
            'include_salaried': include_salaried
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R4: Items by Total Profit
@app.route('/api/reports/items-by-profit', methods=['GET'])
def items_by_profit():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')

    try:
        conn = get_db()
        cursor = conn.cursor()

        query = '''
            SELECT 
                i.item_name,
                i.category,
                SUM(t.quantity) as units_sold,

                ROUND(SUM((t.unit_price - i.current_cost) * t.quantity), 2) as total_profit,
                ROUND(SUM((t.unit_price - i.current_cost) * t.quantity) / NULLIF(SUM(t.unit_price * t.quantity), 0) * 100, 2) as margin_pct
            FROM transactions t
            JOIN items i ON t.item_id = i.item_id
            WHERE DATE(t.transaction_date) BETWEEN ? AND ?
            GROUP BY t.item_id, i.item_name, i.category
            ORDER BY total_profit DESC
        '''

        cursor.execute(query, (start_date, end_date))
        rows = cursor.fetchall()

        data = [dict(row) for row in rows]
        conn.close()

        return jsonify({
            'success': True,
            'data': data,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R5: Items by Profitability %
@app.route('/api/reports/items-by-margin', methods=['GET'])
def items_by_margin():
    try:
        conn = get_db()
        cursor = conn.cursor()

        query = '''
            SELECT 
                item_name,
                category,
                current_price,
                current_cost,
                ROUND(current_price - current_cost, 2) as profit_per_unit,
                ROUND((current_price - current_cost) / current_price * 100, 2) as margin_pct
            FROM items
            WHERE current_price > 0
            ORDER BY margin_pct DESC
        '''

        cursor.execute(query)
        rows = cursor.fetchall()

        data = [dict(row) for row in rows]
        conn.close()

        return jsonify({
            'success': True,
            'data': data
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R6: Categories by Revenue (aggregated by category)
@app.route('/api/reports/categories-by-revenue', methods=['GET'])
def categories_by_revenue():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')

    try:
        conn = get_db()
        cursor = conn.cursor()

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
        conn.close()

        return jsonify({
            'success': True,
            'data': categories,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R7: Categories by Profit (aggregated by category)
@app.route('/api/reports/categories-by-profit', methods=['GET'])
def categories_by_profit():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')

    try:
        conn = get_db()
        cursor = conn.cursor()

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
        conn.close()

        return jsonify({
            'success': True,
            'data': categories,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R8: Get top items for heatmap selector
@app.route('/api/reports/top-items', methods=['GET'])
def top_items():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    limit = int(request.args.get('limit', 25))

    try:
        conn = get_db()
        cursor = conn.cursor()

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
        conn.close()

        return jsonify({
            'success': True,
            'data': items,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# R9: Item heatmap data (hourly × daily patterns)
@app.route('/api/reports/item-heatmap', methods=['GET'])
def item_heatmap():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    item_id = request.args.get('item_id')

    if not item_id:
        return jsonify({'success': False, 'error': 'item_id required'}), 400

    try:
        conn = get_db()
        cursor = conn.cursor()

        query = '''
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
                CAST(strftime('%H', transaction_date) AS INTEGER) as hour,
                ROUND(SUM(total_amount), 2) as revenue,
                SUM(quantity) as units
            FROM transactions
            WHERE item_id = ?
              AND DATE(transaction_date) BETWEEN ? AND ?
            GROUP BY day_of_week, day_num, hour
            ORDER BY day_num, hour
        '''

        cursor.execute(query, (item_id, start_date, end_date))
        rows = cursor.fetchall()

        data = [dict(row) for row in rows]
        conn.close()

        return jsonify({
            'success': True,
            'data': data,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# P1: Daily Sales Forecast (next 21 days)
@app.route('/api/forecasts/daily', methods=['GET'])
def daily_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()

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

        conn.close()

        return jsonify({
            'success': True,
            'data': forecasts
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# P2: Hourly Sales Forecast (next 21 days)
@app.route('/api/forecasts/hourly', methods=['GET'])
def hourly_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()
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

        conn.close()

        return jsonify({
            'success': True,
            'data': all_forecasts
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# P3: Item Demand Forecast (next 21 days, grouped by week)
@app.route('/api/forecasts/items', methods=['GET'])
def item_demand_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()
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

            # Group by week
            weekly_forecast = [
                {
                    'week': 1,
                    'quantity': sum(d['quantity'] for d in daily_forecasts[0:7])
                },
                {
                    'week': 2,
                    'quantity': sum(d['quantity'] for d in daily_forecasts[7:14])
                },
                {
                    'week': 3,
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

        conn.close()

        # Sort by total forecast descending
        all_forecasts.sort(key=lambda x: x['total_forecast'], reverse=True)

        return jsonify({
            'success': True,
            'data': all_forecasts
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# P4: Category Demand Forecast (next 21 days, grouped by week)
@app.route('/api/forecasts/categories', methods=['GET'])
def category_demand_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()
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

            # Group by week
            weekly_forecast = [
                {
                    'week': 1,
                    'quantity': sum(d['quantity'] for d in daily_forecasts[0:7])
                },
                {
                    'week': 2,
                    'quantity': sum(d['quantity'] for d in daily_forecasts[7:14])
                },
                {
                    'week': 3,
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

        conn.close()

        # Sort by total forecast descending
        all_forecasts.sort(key=lambda x: x['total_forecast'], reverse=True)

        return jsonify({
            'success': True,
            'data': all_forecasts
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


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
    print("  /api/forecasts/daily")
    print("  /api/forecasts/hourly")
    print("  /api/forecasts/items")
    print("  /api/forecasts/categories")
    app.run(debug=True, port=5500, host='0.0.0.0')