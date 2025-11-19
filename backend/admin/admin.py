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