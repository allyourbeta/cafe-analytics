"""Tests for the date_range helper module (Phase 1 performance optimization)."""

import os
import sys

import pytest

# Match the sys.path convention already used by test_query_builder.py so this
# module is importable whether pytest is run from backend/ or the repo root.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from date_range import (
    parse_report_date,
    to_midnight_timestamp,
    inclusive_date_range_to_timestamps,
)


def test_same_day_range_is_one_day_wide():
    start, end = inclusive_date_range_to_timestamps('2026-07-21', '2026-07-21')
    assert start == '2026-07-21 00:00:00'
    assert end == '2026-07-22 00:00:00'


def test_seven_day_range():
    start, end = inclusive_date_range_to_timestamps('2026-07-15', '2026-07-21')
    assert start == '2026-07-15 00:00:00'
    assert end == '2026-07-22 00:00:00'  # day after the inclusive end date


def test_month_boundary():
    start, end = inclusive_date_range_to_timestamps('2026-01-01', '2026-01-31')
    assert start == '2026-01-01 00:00:00'
    assert end == '2026-02-01 00:00:00'


def test_year_boundary():
    start, end = inclusive_date_range_to_timestamps('2025-12-25', '2025-12-31')
    assert start == '2025-12-25 00:00:00'
    assert end == '2026-01-01 00:00:00'


def test_leap_day_boundary():
    # 2028 is a leap year; Feb 29 exists and Feb 28 -> Feb 29 must not skip to March.
    start, end = inclusive_date_range_to_timestamps('2028-02-28', '2028-02-29')
    assert start == '2028-02-28 00:00:00'
    assert end == '2028-03-01 00:00:00'


def test_leap_day_rejected_in_non_leap_year():
    with pytest.raises(ValueError):
        inclusive_date_range_to_timestamps('2026-02-28', '2026-02-29')


def test_invalid_date_format_raises_value_error():
    with pytest.raises(ValueError):
        inclusive_date_range_to_timestamps('not-a-date', '2026-07-21')
    with pytest.raises(ValueError):
        inclusive_date_range_to_timestamps('2026-07-21', '07/21/2026')


def test_end_before_start_does_not_raise_and_yields_empty_range():
    # Matches the previous DATE(transaction_date) BETWEEN ? AND ? behavior:
    # end < start silently matches zero rows rather than erroring.
    start, end = inclusive_date_range_to_timestamps('2026-07-21', '2026-07-01')
    assert start == '2026-07-21 00:00:00'
    assert end == '2026-07-02 00:00:00'
    assert start > end  # exclusive upper bound precedes lower bound -> no rows match


def test_parse_report_date_valid():
    d = parse_report_date('2026-07-21')
    assert d.isoformat() == '2026-07-21'


def test_parse_report_date_invalid_raises():
    with pytest.raises(ValueError):
        parse_report_date('2026-13-01')
    with pytest.raises(ValueError):
        parse_report_date(None)


def test_to_midnight_timestamp_accepts_string_or_date():
    d = parse_report_date('2026-07-21')
    assert to_midnight_timestamp(d) == '2026-07-21 00:00:00'
    assert to_midnight_timestamp('2026-07-21') == '2026-07-21 00:00:00'
