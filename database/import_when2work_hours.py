#!/usr/bin/env python3
"""
Import When2Work labor hours CSV into cafe database.
Handles idempotent imports - running multiple times with same data won't create duplicates.

Usage:
    python import_when2work_hours.py <csv_file1> <csv_file2> ...

Example:
    python import_when2work_hours.py datafiles/edmonds_Q1Nov6_FY26_when2work_hours.csv
"""

import sqlite3
import sys
import csv
from datetime import datetime


def parse_when2work_csv(csv_path):
    """
    Parse When2Work CSV file and extract shift records.
    
    Expected columns:
    - Shift ID
    - Schedule ID
    - Employee Number
    - Position ID
    - Position Name (used to classify salaried vs hourly)
    - Cat
    - Shift Description
    - Date (M/D/YYYY format)
    - Start Time (HH:MM AM/PM format)
    - End Time (HH:MM AM/PM format)
    - Employee Name
    
    Returns:
        List of shift dictionaries with parsed data
    """
    print(f"\n📄 Processing: {csv_path}")
    
    shifts = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            try:
                # Extract fields
                position_name = row['Position Name'].strip()
                employee_name = row['Employee Name'].strip()
                date_str = row['Date'].strip()
                start_time_str = row['Start Time'].strip()
                end_time_str = row['End Time'].strip()
                
                # Classify employee type based on Position Name
                if position_name == 'Leadership':
                    employee_type = 'salaried'
                else:
                    employee_type = 'hourly'
                
                # Parse date (format: M/D/YYYY or MM/DD/YYYY)
                shift_date = datetime.strptime(date_str, '%m/%d/%Y').date()
                
                # Parse start time (format: HH:MM AM/PM)
                start_datetime = datetime.strptime(
                    f"{date_str} {start_time_str}",
                    '%m/%d/%Y %I:%M %p'
                )
                
                # Parse end time (format: HH:MM AM/PM)
                end_datetime = datetime.strptime(
                    f"{date_str} {end_time_str}",
                    '%m/%d/%Y %I:%M %p'
                )
                
                # Handle shifts that cross midnight
                if end_datetime <= start_datetime:
                    # End time is next day
                    from datetime import timedelta
                    end_datetime += timedelta(days=1)
                
                shifts.append({
                    'shift_date': shift_date.isoformat(),
                    'shift_start': start_datetime.isoformat(),
                    'shift_end': end_datetime.isoformat(),
                    'employee_name': employee_name,
                    'employee_type': employee_type,
                    'position_name': position_name  # For debugging
                })
                
            except Exception as e:
                print(f"  ⚠️  Error parsing row: {e}")
                print(f"      Row data: {row}")
                continue
    
    print(f"  ✅ Parsed {len(shifts)} shifts")
    return shifts


def add_unique_constraint(conn):
    """
    Add unique constraint to labor_hours table for idempotent imports.
    This prevents duplicate shift entries.
    
    Unique key: (employee_name, shift_start, shift_date)
    """
    cursor = conn.cursor()
    
    # Check if index already exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name='idx_labor_unique'
    """)
    
    if cursor.fetchone():
        print("  ℹ️  Unique constraint already exists")
        return
    
    print("  🔧 Adding unique constraint for idempotent imports...")
    cursor.execute("""
        CREATE UNIQUE INDEX idx_labor_unique 
        ON labor_hours(employee_name, shift_start, shift_date)
    """)
    conn.commit()
    print("  ✅ Unique constraint added")


def import_shifts(db_path, csv_files):
    """
    Import all shifts from CSV files into database.
    Handles duplicates gracefully - skips shifts that already exist.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Add unique constraint if not exists
    add_unique_constraint(conn)
    
    all_shifts = []
    
    # Parse all CSV files
    for csv_file in csv_files:
        shifts = parse_when2work_csv(csv_file)
        all_shifts.extend(shifts)
    
    # Insert shifts
    print(f"\n💾 Inserting {len(all_shifts)} shifts...")
    
    insert_count = 0
    duplicate_count = 0
    
    for shift in all_shifts:
        try:
            cursor.execute("""
                INSERT INTO labor_hours (
                    shift_date, shift_start, shift_end, 
                    employee_name, employee_type
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                shift['shift_date'],
                shift['shift_start'],
                shift['shift_end'],
                shift['employee_name'],
                shift['employee_type']
            ))
            insert_count += 1
            
        except sqlite3.IntegrityError:
            # Duplicate shift - skip silently (this is expected for idempotency)
            duplicate_count += 1
    
    conn.commit()
    
    print(f"  ✅ Inserted {insert_count} new shifts")
    if duplicate_count > 0:
        print(f"  ℹ️  Skipped {duplicate_count} duplicate shifts (already in database)")
    
    conn.close()
    
    print("\n✅ Import complete!")
    print(f"   New shifts: {insert_count}")
    print(f"   Duplicates skipped: {duplicate_count}")


def verify_import(db_path):
    """
    Verify the import worked correctly.
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("\n🔍 Verification:")
    
    # Check total shifts
    cursor.execute("SELECT COUNT(*) as count FROM labor_hours")
    total_count = cursor.fetchone()['count']
    print(f"   Total shifts: {total_count}")
    
    # Check date range
    cursor.execute("""
        SELECT MIN(shift_date) as min_date, MAX(shift_date) as max_date 
        FROM labor_hours
    """)
    result = cursor.fetchone()
    print(f"   Date range: {result['min_date']} to {result['max_date']}")
    
    # Check employee type distribution
    print("\n📊 Employee Type Distribution:")
    cursor.execute("""
        SELECT 
            employee_type,
            COUNT(*) as shift_count,
            COUNT(DISTINCT employee_name) as employee_count
        FROM labor_hours
        GROUP BY employee_type
        ORDER BY employee_type
    """)
    for row in cursor.fetchall():
        print(f"   {row['employee_type']:10} {row['shift_count']:4} shifts, {row['employee_count']:3} employees")
    
    # Check for any data quality issues
    cursor.execute("""
        SELECT COUNT(*) as count FROM labor_hours
        WHERE shift_end <= shift_start
    """)
    bad_shifts = cursor.fetchone()['count']
    if bad_shifts > 0:
        print(f"\n   ⚠️  Warning: {bad_shifts} shifts have end time <= start time!")
    else:
        print(f"\n   ✅ All shifts have valid time ranges")
    
    # Show sample shifts
    print("\n📋 Sample Shifts:")
    cursor.execute("""
        SELECT 
            shift_date,
            shift_start,
            shift_end,
            employee_name,
            employee_type
        FROM labor_hours
        ORDER BY shift_start
        LIMIT 5
    """)
    for row in cursor.fetchall():
        print(f"   {row['shift_date']} {row['shift_start'][11:16]}-{row['shift_end'][11:16]} | {row['employee_name']:20} | {row['employee_type']}")
    
    # Get labor rates from settings
    print("\n💰 Labor Rates (from settings):")
    cursor.execute("""
        SELECT setting_key, setting_value 
        FROM settings 
        WHERE setting_key IN ('hourly_labor_rate', 'salaried_labor_rate')
    """)
    for row in cursor.fetchall():
        rate_type = 'Hourly' if 'hourly' in row['setting_key'] else 'Salaried'
        print(f"   {rate_type:10} ${row['setting_value']}")
    
    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_when2work_hours.py <csv_file1> <csv_file2> ...")
        print("\nExample:")
        print("  python import_when2work_hours.py datafiles/edmonds_Q1Nov6_FY26_when2work_hours.csv")
        sys.exit(1)
    
    db_path = "cafe_reports.db"
    csv_files = sys.argv[1:]
    
    print("🚀 When2Work Labor Hours Import")
    print(f"   Database: {db_path}")
    print(f"   CSV files: {len(csv_files)}")
    
    import_shifts(db_path, csv_files)
    verify_import(db_path)
    
    print("\n🎉 Done! Check the verification output above.")
    print("\n💡 To test idempotency, run this script again with the same file.")
    print("   It should report 0 new shifts and all duplicates skipped.")
