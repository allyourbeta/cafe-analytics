from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

DB_PATH = '../database/cafe_reports.db'

def get_db():
    conn = sqlite3.connect(DB_PATH)
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
                item_name,
                category,
                SUM(quantity) as units_sold,
                ROUND(SUM(total_amount), 2) as revenue
            FROM transactions
            WHERE DATE(transaction_datetime) BETWEEN ? AND ?
            GROUP BY item_name, category
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
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                strftime('%Y-%m-%d %H:00:00', transaction_datetime) as hour,
                ROUND(SUM(total_amount), 2) as sales
            FROM transactions
            WHERE DATE(transaction_datetime) BETWEEN ? AND ?
            GROUP BY hour
            ORDER BY hour
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

# R2: Labor % per Labor Hour
@app.route('/api/reports/labor-percent', methods=['GET'])
def labor_percent():
    start_date = request.args.get('start', '2024-08-01')
    end_date = request.args.get('end', '2024-10-23')
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = '''
            SELECT 
                strftime('%Y-%m-%d %H:00:00', t.transaction_datetime) as hour,
                ROUND(SUM(t.total_amount), 2) as sales,
                ROUND(SUM(l.labor_cost), 2) as labor_cost,
                ROUND(SUM(l.labor_cost) / NULLIF(SUM(t.total_amount), 0) * 100, 2) as labor_pct
            FROM transactions t
            LEFT JOIN labor_hours l ON 
                DATE(l.shift_start) = DATE(t.transaction_datetime) AND
                strftime('%H', l.shift_start) = strftime('%H', t.transaction_datetime)
            WHERE DATE(t.transaction_datetime) BETWEEN ? AND ?
            GROUP BY hour
            ORDER BY hour
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
                item_name,
                category,
                SUM(quantity) as units_sold,
                ROUND(SUM((unit_price - unit_cost) * quantity), 2) as total_profit,
                ROUND((unit_price - unit_cost) / unit_price * 100, 2) as margin_pct
            FROM transactions
            WHERE DATE(transaction_datetime) BETWEEN ? AND ?
            GROUP BY item_name, category
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

# P1: Daily Sales Forecast (next 7 days)
@app.route('/api/forecasts/daily', methods=['GET'])
def daily_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        forecasts = []
        today = datetime.now().date()
        
        for i in range(1, 8):
            forecast_date = today + timedelta(days=i)
            day_of_week = forecast_date.strftime('%A')
            
            # Get last week same day
            last_week = forecast_date - timedelta(days=7)
            
            query = '''
                SELECT ROUND(AVG(daily_sales), 2) as avg_sales
                FROM (
                    SELECT DATE(transaction_datetime) as date, SUM(total_amount) as daily_sales
                    FROM transactions
                    WHERE DATE(transaction_datetime) = ?
                    GROUP BY date
                )
            '''
            
            cursor.execute(query, (last_week.isoformat(),))
            result = cursor.fetchone()
            
            forecasts.append({
                'date': forecast_date.isoformat(),
                'day_of_week': day_of_week,
                'forecasted_sales': result['avg_sales'] if result['avg_sales'] else 0,
                'basis': 'Last week same day'
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': forecasts
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# P2: Hourly Sales Forecast (tomorrow)
@app.route('/api/forecasts/hourly', methods=['GET'])
def hourly_forecast():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        last_week_same_day = tomorrow - timedelta(days=7)
        
        query = '''
            SELECT 
                strftime('%H:00', transaction_datetime) as hour,
                ROUND(AVG(hourly_sales), 2) as avg_sales
            FROM (
                SELECT 
                    transaction_datetime,
                    SUM(total_amount) as hourly_sales
                FROM transactions
                WHERE DATE(transaction_datetime) = ?
                GROUP BY strftime('%Y-%m-%d %H', transaction_datetime)
            )
            GROUP BY hour
            ORDER BY hour
        '''
        
        cursor.execute(query, (last_week_same_day.isoformat(),))
        rows = cursor.fetchall()
        
        forecasts = [dict(row) for row in rows]
        conn.close()
        
        return jsonify({
            'success': True,
            'data': forecasts,
            'forecast_date': tomorrow.isoformat(),
            'basis': 'Last week same day'
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
    app.run(debug=True, port=5500, host='0.0.0.0')
