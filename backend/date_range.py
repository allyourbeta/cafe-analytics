"""
Date-range helpers for transaction-date filtering.

Report endpoints accept an inclusive [start, end] date range from users in
'YYYY-MM-DD' form, but `transactions.transaction_date` is a raw timestamp
column. Filtering with `DATE(transaction_date) BETWEEN ? AND ?` forces
SQLite to evaluate DATE() on every row, which prevents it from using
idx_transactions_date (see performance_audit_2026-07-22.md).

Converting the inclusive end date to the following midnight lets callers
filter with a half-open, raw-column range instead:

    transaction_date >= '2026-07-21 00:00:00'
    AND transaction_date <  '2026-07-22 00:00:00'

which SQLite can satisfy with a bounded index search.
"""

from datetime import datetime, timedelta

DATE_FORMAT = '%Y-%m-%d'


def parse_report_date(date_str):
    """
    Parse a 'YYYY-MM-DD' string into a date object.

    Raises:
        ValueError: if date_str is not a valid 'YYYY-MM-DD' date.
    """
    try:
        return datetime.strptime(date_str, DATE_FORMAT).date()
    except (TypeError, ValueError):
        raise ValueError(f"Invalid date {date_str!r}; expected YYYY-MM-DD")


def to_midnight_timestamp(value):
    """
    Format a date (or 'YYYY-MM-DD' string) as a 'YYYY-MM-DD 00:00:00'
    timestamp string suitable for comparison against transaction_date.
    """
    if isinstance(value, str):
        value = parse_report_date(value)
    return f"{value.isoformat()} 00:00:00"


def inclusive_date_range_to_timestamps(start_date, end_date):
    """
    Convert a user-facing inclusive [start_date, end_date] range into a
    half-open raw-column timestamp range for filtering transaction_date.

    Args:
        start_date (str): Range start, 'YYYY-MM-DD', inclusive.
        end_date (str): Range end, 'YYYY-MM-DD', inclusive.

    Returns:
        tuple: (start_timestamp, end_exclusive_timestamp), e.g.
            ('2026-07-21 00:00:00', '2026-07-22 00:00:00')

    Raises:
        ValueError: if either date is not valid 'YYYY-MM-DD'.

    Note: if end_date < start_date, this does not raise -- it returns a
    range where the exclusive upper bound is before the lower bound, so a
    `transaction_date >= start AND transaction_date < end_exclusive` filter
    naturally matches zero rows. This preserves the behavior of the
    previous `DATE(transaction_date) BETWEEN ? AND ?` predicate, which also
    matched zero rows (rather than erroring) when end preceded start.
    """
    start = parse_report_date(start_date)
    end = parse_report_date(end_date)
    end_exclusive = end + timedelta(days=1)
    return to_midnight_timestamp(start), to_midnight_timestamp(end_exclusive)
