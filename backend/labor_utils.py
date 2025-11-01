"""
Labor Hour Proration Utilities

This module handles the accurate distribution of labor hours and costs across
clock hours when shifts don't align perfectly with hour boundaries.

Example Problem:
    Shift: 8:15am - 4:30pm (8.25 hours at $20/hr = $165 total)

    Naive approach (WRONG):
        - Assign all 8.25 hours to 8am hour = $165 at 8am
        - 9am-4pm have $0

    Correct approach (proration):
        - 8am hour (8:00-9:00): 0.75 hours worked (8:15-9:00) = $15
        - 9am hour (9:00-10:00): 1.00 hours worked = $20
        - ... (full hours)
        - 4pm hour (4:00-5:00): 0.50 hours worked (4:00-4:30) = $10
        - Total: 8.25 hours = $165 (correctly distributed)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any


def prorate_shift_hours(
        shift_start: datetime,
        shift_end: datetime,
        hourly_rate: float
) -> List[Dict[str, Any]]:
    """
    Distribute a shift's labor hours and cost across clock hours.

    This function takes a shift with arbitrary start/end times and breaks it down
    into contributions to each clock hour (8:00-9:00, 9:00-10:00, etc.).

    Algorithm:
        1. Start at shift_start time
        2. Find the current clock hour bucket (e.g., 8:15am → 8:00am bucket)
        3. Calculate how much work happens in this bucket (8:15am-9:00am = 0.75hr)
        4. Move to next hour bucket and repeat until shift_end

    Args:
        shift_start: When the shift started (datetime object)
        shift_end: When the shift ended (datetime object)
        hourly_rate: Employee's pay rate (dollars per hour)

    Returns:
        List of dictionaries, each containing:
            - 'hour': Clock hour bucket as string 'YYYY-MM-DD HH:00:00'
            - 'hours': Hours worked in this bucket (decimal)
            - 'cost': Labor cost for this bucket (hours * rate)

    Example:
        >>> start = datetime(2024, 10, 30, 8, 15, 0)  # 8:15am
        >>> end = datetime(2024, 10, 30, 16, 30, 0)   # 4:30pm
        >>> prorate_shift_hours(start, end, 20.0)
        [
            {'hour': '2024-10-30 08:00:00', 'hours': 0.75, 'cost': 15.00},
            {'hour': '2024-10-30 09:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 10:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 11:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 12:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 13:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 14:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 15:00:00', 'hours': 1.00, 'cost': 20.00},
            {'hour': '2024-10-30 16:00:00', 'hours': 0.50, 'cost': 10.00}
        ]
        # Total: 8.25 hours, $165.00
    """
    result = []
    current = shift_start

    while current < shift_end:
        # Get the clock hour bucket (floor to the hour)
        # Example: 8:15:00 → 8:00:00, 14:37:00 → 14:00:00
        hour_bucket = current.replace(minute=0, second=0, microsecond=0)

        # Calculate end of this hour bucket
        # Example: 8:00:00 → 9:00:00
        hour_end = hour_bucket + timedelta(hours=1)

        # Calculate how much work happens in THIS hour bucket
        # We work until either:
        # - The shift ends (shift_end), OR
        # - This hour bucket ends (hour_end)
        # Whichever comes first
        work_end = min(shift_end, hour_end)

        # Calculate fraction of this hour worked
        seconds_worked = (work_end - current).total_seconds()
        hours_worked = seconds_worked / 3600  # 3600 seconds in an hour

        # Calculate cost for this hour bucket
        cost = hours_worked * hourly_rate

        # Add to result
        result.append({
            'hour': hour_bucket.strftime('%Y-%m-%d %H:00:00'),
            'hours': round(hours_worked, 4),  # Keep precision for accuracy
            'cost': round(cost, 2)
        })

        # Move to next hour bucket
        current = hour_end

    return result


def calculate_hourly_labor_costs(
        conn,
        start_date: str,
        end_date: str,
        include_salaried: bool = True
) -> Dict[str, Dict[str, float]]:
    """
    Calculate total labor cost for each hour across all shifts in date range.
    Now returns detailed breakdown by employee type (salaried vs hourly/students).

    Labor rates are retrieved from the settings table:
    - 'hourly' employees (students) use 'hourly_labor_rate'
    - 'salaried' employees use 'salaried_labor_rate'

    This function:
    1. Fetches labor rates from settings table
    2. Fetches all shifts in the date range from the database
    3. Prorates each shift across clock hours using prorate_shift_hours()
    4. Aggregates costs by hour across all shifts
    5. Tracks breakdown by employee type

    Args:
        conn: SQLite database connection
        start_date: Start date in 'YYYY-MM-DD' format
        end_date: End date in 'YYYY-MM-DD' format
        include_salaried: If True, includes salaried employees. If False, only hourly (students).

    Returns:
        Dictionary mapping hour strings to breakdown dictionaries
        Example: {
            '2024-10-30 08:00:00': {
                'total_cost': 125.50,
                'salaried_hours': 2.0,
                'salaried_cost': 60.00,
                'student_hours': 3.275,
                'student_cost': 65.50
            },
            ...
        }

    Example:
        >>> conn = sqlite3.connect('cafe_reports.db')
        >>> costs = calculate_hourly_labor_costs(conn, '2024-10-01', '2024-10-31')
        >>> print(costs['2024-10-30 09:00:00'])
        {'total_cost': 180.00, 'salaried_hours': 4.0, 'salaried_cost': 120.00,
         'student_hours': 3.0, 'student_cost': 60.00}
    """
    cursor = conn.cursor()

    # Get labor rates from settings table
    cursor.execute(
        "SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('hourly_labor_rate', 'salaried_labor_rate')")
    settings = {row[0]: float(row[1]) for row in cursor.fetchall()}

    hourly_rate = settings.get('hourly_labor_rate', 20.00)  # Default $20 if not set
    salaried_rate = settings.get('salaried_labor_rate', 30.00)  # Default $30 if not set

    # Build query with optional employee type filter
    if include_salaried:
        # Get all shifts (both hourly students and salaried)
        query = '''
            SELECT 
                shift_start, 
                shift_end, 
                employee_type,
                employee_name
            FROM labor_hours
            WHERE shift_date BETWEEN ? AND ?
            ORDER BY shift_start
        '''
    else:
        # Get only hourly (student) shifts
        query = '''
            SELECT 
                shift_start, 
                shift_end, 
                employee_type,
                employee_name
            FROM labor_hours
            WHERE shift_date BETWEEN ? AND ?
                AND employee_type = 'hourly'
            ORDER BY shift_start
        '''

    cursor.execute(query, (start_date, end_date))
    shifts = cursor.fetchall()

    # Accumulate labor costs by hour with breakdown
    # Structure: {'2024-10-30 08:00:00': {'total_cost': 125.50, 'salaried_hours': 2.0, ...}, ...}
    hourly_breakdown = {}

    for shift in shifts:
        # Convert database strings to datetime objects
        shift_start = datetime.fromisoformat(shift['shift_start'])
        shift_end = datetime.fromisoformat(shift['shift_end'])
        employee_type = shift['employee_type']

        # Determine pay rate based on employee type
        if employee_type == 'salaried':
            pay_rate = salaried_rate
        else:  # 'hourly'
            pay_rate = hourly_rate

        # Prorate this shift across hours
        prorated = prorate_shift_hours(shift_start, shift_end, pay_rate)

        # Add this shift's costs to the totals with breakdown by type
        for hour_data in prorated:
            hour = hour_data['hour']
            hours = hour_data['hours']
            cost = hour_data['cost']

            if hour not in hourly_breakdown:
                hourly_breakdown[hour] = {
                    'total_cost': 0,
                    'salaried_hours': 0,
                    'salaried_cost': 0,
                    'student_hours': 0,
                    'student_cost': 0
                }

            # Add to total
            hourly_breakdown[hour]['total_cost'] += cost

            # Add to appropriate category
            if employee_type == 'salaried':
                hourly_breakdown[hour]['salaried_hours'] += hours
                hourly_breakdown[hour]['salaried_cost'] += cost
            else:  # 'hourly' = students
                hourly_breakdown[hour]['student_hours'] += hours
                hourly_breakdown[hour]['student_cost'] += cost

    return hourly_breakdown


def get_shift_summary(shift_start: datetime, shift_end: datetime, hourly_rate: float) -> Dict[str, Any]:
    """
    Get a human-readable summary of a shift and its proration.

    Useful for debugging and displaying shift details to users.

    Args:
        shift_start: When shift started
        shift_end: When shift ended
        hourly_rate: Pay rate

    Returns:
        Dictionary with shift summary including:
            - total_hours: Total hours worked
            - total_cost: Total labor cost
            - hourly_breakdown: List of hour-by-hour costs

    Example:
        >>> start = datetime(2024, 10, 30, 8, 15)
        >>> end = datetime(2024, 10, 30, 16, 30)
        >>> summary = get_shift_summary(start, end, 20.0)
        >>> print(f"Total: {summary['total_hours']} hours = ${summary['total_cost']}")
        Total: 8.25 hours = $165.00
    """
    prorated = prorate_shift_hours(shift_start, shift_end, hourly_rate)

    total_hours = sum(h['hours'] for h in prorated)
    total_cost = sum(h['cost'] for h in prorated)

    return {
        'shift_start': shift_start.isoformat(),
        'shift_end': shift_end.isoformat(),
        'hourly_rate': hourly_rate,
        'total_hours': round(total_hours, 2),
        'total_cost': round(total_cost, 2),
        'hourly_breakdown': prorated
    }


# Validation function to verify proration is working correctly
def validate_proration(shift_start: datetime, shift_end: datetime, hourly_rate: float) -> bool:
    """
    Validate that proration math is correct.

    Checks:
    1. Sum of prorated hours equals actual shift duration
    2. Sum of prorated costs equals actual shift cost

    Returns:
        True if proration is mathematically correct, False otherwise
    """
    prorated = prorate_shift_hours(shift_start, shift_end, hourly_rate)

    # Calculate expected values
    expected_hours = (shift_end - shift_start).total_seconds() / 3600
    expected_cost = expected_hours * hourly_rate

    # Calculate actual values from proration
    actual_hours = sum(h['hours'] for h in prorated)
    actual_cost = sum(h['cost'] for h in prorated)

    # Allow small floating point differences (within 1 cent)
    hours_match = abs(actual_hours - expected_hours) < 0.01
    cost_match = abs(actual_cost - expected_cost) < 0.01

    if not hours_match or not cost_match:
        print(f"⚠️  Proration validation failed!")
        print(f"   Expected: {expected_hours:.2f} hours = ${expected_cost:.2f}")
        print(f"   Actual:   {actual_hours:.2f} hours = ${actual_cost:.2f}")
        return False

    return True


# Example usage and testing
if __name__ == '__main__':
    """
    Test the proration functions with example data.
    Run with: python labor_utils.py
    """
    print("🧪 Testing Labor Hour Proration\n")

    # Test Case 1: Shift that crosses multiple hours
    print("Test 1: 8:15am - 4:30pm shift at $20/hr")
    start = datetime(2024, 10, 30, 8, 15, 0)
    end = datetime(2024, 10, 30, 16, 30, 0)

    prorated = prorate_shift_hours(start, end, 20.0)

    print("Hour-by-hour breakdown:")
    for hour in prorated:
        print(f"  {hour['hour']}: {hour['hours']:.2f} hours = ${hour['cost']:.2f}")

    total_hours = sum(h['hours'] for h in prorated)
    total_cost = sum(h['cost'] for h in prorated)
    print(f"\n  Total: {total_hours:.2f} hours = ${total_cost:.2f}")

    # Validate
    if validate_proration(start, end, 20.0):
        print("  ✅ Validation passed!\n")
    else:
        print("  ❌ Validation failed!\n")

    # Test Case 2: Shift on exact hour boundaries
    print("Test 2: 9:00am - 5:00pm shift at $25/hr (exact hours)")
    start = datetime(2024, 10, 30, 9, 0, 0)
    end = datetime(2024, 10, 30, 17, 0, 0)

    prorated = prorate_shift_hours(start, end, 25.0)
    total_hours = sum(h['hours'] for h in prorated)
    total_cost = sum(h['cost'] for h in prorated)

    print(f"  Total: {total_hours:.2f} hours = ${total_cost:.2f}")

    if validate_proration(start, end, 25.0):
        print("  ✅ Validation passed!\n")
    else:
        print("  ❌ Validation failed!\n")

    # Test Case 3: Short shift
    print("Test 3: 2:45pm - 3:30pm shift at $18/hr (short shift)")
    start = datetime(2024, 10, 30, 14, 45, 0)
    end = datetime(2024, 10, 30, 15, 30, 0)

    prorated = prorate_shift_hours(start, end, 18.0)

    print("Hour-by-hour breakdown:")
    for hour in prorated:
        print(f"  {hour['hour']}: {hour['hours']:.2f} hours = ${hour['cost']:.2f}")

    total_hours = sum(h['hours'] for h in prorated)
    total_cost = sum(h['cost'] for h in prorated)
    print(f"\n  Total: {total_hours:.2f} hours = ${total_cost:.2f}")

    if validate_proration(start, end, 18.0):
        print("  ✅ Validation passed!\n")
    else:
        print("  ❌ Validation failed!\n")

    print("✅ All tests complete!")