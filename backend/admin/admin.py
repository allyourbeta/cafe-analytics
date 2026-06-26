"""
Admin and System Endpoints

Health checks, cache management, and other administrative functions.
"""

import sys
import os

from flask import Blueprint, jsonify, request, current_app
from database import with_database
from extensions import cache

try:
    from utils import success_response, error_response
except ImportError:
    from ..utils import success_response, error_response

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/api/health', methods=['GET'])
def health_check():
    print("HEALTH ENDPOINT HIT", file=sys.stderr)
    print("=== HEALTH DEBUG ===", file=sys.stderr)
    print("cwd:", os.getcwd(), file=sys.stderr)

    # *** CRITICAL TEST ***
    try:
        import backend.labor_utils as blu
        print("health: IMPORT backend.labor_utils OK", file=sys.stderr)
    except Exception as e:
        print("health: IMPORT backend.labor_utils FAILED:", repr(e), file=sys.stderr)

    print("====================", file=sys.stderr)
    return jsonify({"status": "ok"})


@admin_bp.route('/api/admin/clear-cache', methods=['POST'])
def clear_cache_endpoint():
    """Clear all cached data - useful after database updates"""
    try:
        cache.clear()
        return jsonify(success_response(None, message='Cache cleared successfully'))
    except Exception as e:
        return error_response(e)


@admin_bp.route('/api/admin/sync-vivonet', methods=['POST'])
def sync_vivonet():
    """
    Trigger Vivonet import for a date range.

    POST body (JSON, all optional):
        start: "YYYYMMDD" (default: yesterday)
        end:   "YYYYMMDD" (default: start + 1 day)
        store: "cafe" | "events" (default: "cafe")

    Example:
        curl -X POST http://localhost:5500/api/admin/sync-vivonet
        curl -X POST http://localhost:5500/api/admin/sync-vivonet \
             -H "Content-Type: application/json" \
             -d '{"start": "20260301", "end": "20260302"}'
    """
    from datetime import datetime, timedelta

    # Resolve import path: database/ is a sibling of backend/
    db_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          '..', '..', 'database')
    db_dir = os.path.normpath(db_dir)

    # Add database/ to sys.path so the import works
    if db_dir not in sys.path:
        sys.path.insert(0, db_dir)

    try:
        from import_vivonet_data import import_vivonet
    except ImportError as e:
        try:
            from vivonet_service import import_vivonet
        except ImportError:
            return error_response(f"Could not load vivonet import module: {e}", 500)

    body = request.get_json(silent=True) or {}
    store = body.get("store", "cafe")

    if store not in ("cafe", "events"):
        return error_response("store must be 'cafe' or 'events'", 400)

    # Default: yesterday
    if "start" not in body:
        yesterday = datetime.now() - timedelta(days=1)
        start = yesterday.strftime("%Y%m%d")
    else:
        start = body["start"]

    if "end" not in body:
        end_dt = datetime.strptime(start, "%Y%m%d") + timedelta(days=1)
        end = end_dt.strftime("%Y%m%d")
    else:
        end = body["end"]

    db_path = os.path.join(db_dir, "cafe_reports.db")

    try:
        stats = import_vivonet(start, end, store, db_path)
        # Clear cache after successful import
        cache.clear()
        return jsonify(success_response(stats,
                                        message="Vivonet sync complete"))
    except Exception as e:
        return error_response(e)