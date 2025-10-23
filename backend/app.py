from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3

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

        items = []
        for row in rows:
            items.append({
                'item_name': row['item_name'],
                'category': row['category'],
                'units_sold': row['units_sold'],
                'revenue': row['revenue']
            })

        conn.close()

        return jsonify({
            'success': True,
            'data': items,
            'date_range': {'start': start_date, 'end': end_date}
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Backend starting...")
    print("📊 Running at: http://localhost:5000")
    print("🔍 Test: http://localhost:5000/api/health")
    app.run(debug=True, port=5500, host='0.0.0.0')
