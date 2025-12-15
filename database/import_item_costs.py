#!/usr/bin/env python3
"""
Import item costs from a CSV file.

CSV format expected:
- Column A: item_id (integer)
- Column B: item_name (ignored, for reference only)
- Column C: cost (e.g., "$2.50" or "2.50")

Only updates items where cost > 0. Items with $0.00 cost are skipped
(they remain NULL in the database, indicating unknown cost).

Usage:
    python import_item_costs.py <csv_file>
    python import_item_costs.py item_costs.csv
"""

import csv
import sqlite3
import os
import sys
import re


def parse_cost(cost_str):
    """Parse cost string like '$2.50' or '2.50' to float."""
    if not cost_str:
        return 0.0
    # Remove $ and any whitespace
    cleaned = re.sub(r'[$,\s]', '', cost_str)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def import_costs(db_path, csv_path):
    """Import costs from CSV into database."""
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print(f"📂 Reading costs from: {csv_path}")
    
    updated_count = 0
    skipped_zero = 0
    not_found = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        
        # Skip header row
        header = next(reader, None)
        if header:
            print(f"  📋 Header: {header}")
        
        for row in reader:
            if len(row) < 3:
                continue
            
            try:
                item_id = int(row[0])
            except ValueError:
                continue
            
            item_name = row[1]
            cost = parse_cost(row[2])
            
            if cost <= 0:
                skipped_zero += 1
                continue
            
            # Check if item exists
            cursor.execute("SELECT item_id FROM items WHERE item_id = ?", (item_id,))
            if not cursor.fetchone():
                print(f"  ⚠️  Item {item_id} ({item_name}) not found in database")
                not_found += 1
                continue
            
            # Update the cost
            cursor.execute(
                "UPDATE items SET current_cost = ? WHERE item_id = ?",
                (cost, item_id)
            )
            updated_count += 1
            print(f"  ✅ {item_id}: {item_name} → ${cost:.2f}")
    
    conn.commit()
    conn.close()
    
    print(f"\n📊 Summary:")
    print(f"  ✅ Updated: {updated_count} items")
    print(f"  ⏭️  Skipped (zero cost): {skipped_zero} items")
    if not_found:
        print(f"  ⚠️  Not found: {not_found} items")
    
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_item_costs.py <csv_file>")
        print("Example: python import_item_costs.py item_costs.csv")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "cafe_reports.db")
    
    import_costs(db_path, csv_path)
