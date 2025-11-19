"""
Shared utility functions for Cafe Analytics Backend

These utilities are used across multiple blueprints and endpoints.
"""

from datetime import datetime, timedelta
from flask import jsonify


def get_default_date_range():
    """
    Calculate sensible default date range for API endpoints.
    Returns (start_date, end_date) as strings in 'YYYY-MM-DD' format.

    Default: Last 90 days of data from today.
    """
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')

    return start_date, end_date


def success_response(data, **metadata):
    """
    Create a standardized success response.

    Args:
        data: The primary data to return (list, dict, or primitive)
        **metadata: Optional additional fields (date_range, mode, etc.)

    Returns:
        dict: {'success': True, 'data': data, **metadata}

    Example:
        success_response(items, date_range={'start': '2024-01-01', 'end': '2024-12-31'})
        # Returns: {'success': True, 'data': items, 'date_range': {...}}
    """
    return {'success': True, 'data': data, **metadata}


def error_response(error, status=500):
    """
    Create a standardized error response.

    Args:
        error: Error message or exception
        status: HTTP status code (default: 500)

    Returns:
        tuple: (jsonify({'success': False, 'error': str(error)}), status)

    Example:
        error_response('Item not found', 404)
        # Returns: (jsonify({'success': False, 'error': 'Item not found'}), 404)
    """
    return jsonify({'success': False, 'error': str(error)}), status