#!/usr/bin/env python3
"""
Compare two CSVs to find item IDs that exist in one but not the other.

Usage:
    python compare_item_ids.py <db_items.csv> <spreadsheet_costs.csv>
    python compare_item_ids.py db_items.csv spreadsheet_costs.csv

Both CSVs should have item_id as the first column.
"""

import csv
import sys
import os


def load_item_ids(csv_path, id_column=0):
    """Load item IDs from a CSV file. Returns dict of {item_id: item_name}."""
    items = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader, None)  # Skip header
        
        for row in reader:
            if len(row) < 2:
                continue
            try:
                item_id = int(row[id_column])
                item_name = row[1] if len(row) > 1 else ""
                items[item_id] = item_name
            except ValueError:
                continue
    
    return items


def compare_csvs(db_csv_path, cost_csv_path):
    """Compare two CSVs and report differences."""
    
    if not os.path.exists(db_csv_path):
        print(f"❌ File not found: {db_csv_path}")
        return
    
    if not os.path.exists(cost_csv_path):
        print(f"❌ File not found: {cost_csv_path}")
        return
    
    db_items = load_item_ids(db_csv_path)
    cost_items = load_item_ids(cost_csv_path)
    
    db_ids = set(db_items.keys())
    cost_ids = set(cost_items.keys())
    
    in_db_only = db_ids - cost_ids
    in_cost_only = cost_ids - db_ids
    in_both = db_ids & cost_ids
    
    print(f"📊 Comparison Results")
    print(f"=" * 50)
    print(f"  Database CSV: {len(db_ids)} items")
    print(f"  Cost CSV:     {len(cost_ids)} items")
    print(f"  In both:      {len(in_both)} items")
    print()
    
    if in_db_only:
        print(f"🔵 In DATABASE but NOT in cost spreadsheet ({len(in_db_only)} items):")
        print("-" * 50)
        for item_id in sorted(in_db_only):
            print(f"  {item_id}: {db_items[item_id]}")
        print()
        
        # Export missing items to CSV for easy import into Google Sheets
        output_path = "missing_from_spreadsheet.csv"
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['item_id', 'item_name', 'TOTAL COST TO BUY/MAKE'])
            for item_id in sorted(in_db_only):
                writer.writerow([item_id, db_items[item_id], '$0.00'])
        print(f"📄 Exported to: {output_path}")
        print("   → Open this CSV and copy/paste rows into your Google Sheet")
        print()
    
    if in_cost_only:
        print(f"🟡 In COST SPREADSHEET but NOT in database ({len(in_cost_only)} items):")
        print("-" * 50)
        for item_id in sorted(in_cost_only):
            print(f"  {item_id}: {cost_items[item_id]}")
        print()
    
    if not in_db_only and not in_cost_only:
        print("✅ Perfect match! All item IDs exist in both files.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python compare_item_ids.py <database_csv> <cost_csv>")
        print("Example: python compare_item_ids.py items_export.csv item_costs.csv")
        sys.exit(1)
    
    db_csv = sys.argv[1]
    cost_csv = sys.argv[2]
    
    compare_csvs(db_csv, cost_csv)
