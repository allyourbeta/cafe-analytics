"""Database connection and decorator utilities."""
import os
import sqlite3
from functools import wraps
from flask import jsonify

# Get absolute path relative to this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, '../database/cafe_reports.db')


def get_db():
    """Get a database connection with proper configuration."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")  # Enforce FK constraints
    conn.row_factory = sqlite3.Row
    return conn


def with_database(f):
    """
    Decorator that provides automatic database connection management.

    Usage:
        @app.route('/api/endpoint')
        @with_database
        def my_endpoint(cursor, **kwargs):
            cursor.execute("SELECT ...")
            return {'data': [...]}

    Benefits:
    - Automatic connection opening and closing
    - Connection closed even if exception occurs
    - Consistent error response formatting
    - Reduces boilerplate by ~12 lines per endpoint
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        conn = None
        try:
            conn = get_db()
            cursor = conn.cursor()

            # Call the wrapped function with cursor
            result = f(cursor=cursor, *args, **kwargs)

            # If result is a dict, wrap it in jsonify
            if isinstance(result, dict):
                return jsonify(result)
            # If it's already a Response object, return as-is
            return result

        except Exception as e:
            # Consistent error response format
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

        finally:
            # Always close connection, even on error
            if conn:
                conn.close()

    return decorated_function
