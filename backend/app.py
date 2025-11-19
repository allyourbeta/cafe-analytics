import sys
import os
import traceback
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

# Import extensions and database utilities
from extensions import cache
from database import with_database, get_db

app = Flask(__name__)


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    traceback.print_exc(file=sys.stderr)
    return jsonify({"error": "internal server error"}), 500


CORS(app, resources={r"/api/*": {"origins": "*"}})

# Initialize cache with app
cache.init_app(app, config={
    'CACHE_TYPE': 'SimpleCache',
    'CACHE_DEFAULT_TIMEOUT': 86400
})

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Import and register blueprints
from admin.admin import admin_bp
from forecasts.forecasts import forecasts_bp
from reports.items import items_bp
from reports.labor import labor_bp
from reports.meta import meta_bp

# Register blueprints
app.register_blueprint(admin_bp)
app.register_blueprint(forecasts_bp)
app.register_blueprint(items_bp)
app.register_blueprint(labor_bp)
app.register_blueprint(meta_bp)


# Frontend serving
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