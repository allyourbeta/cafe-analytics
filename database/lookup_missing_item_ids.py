#!/usr/bin/env python3
"""
Lookup missing item_ids by matching item names against the database.

Reads a CSV with some blank item_ids, looks up each missing one by name,
and outputs a CSV with candidate matches for manual review.

Usage:
    python lookup_missing_item_ids.py <input_csv>
    python lookup_missing_item_ids.py spreadsheet_costs.csv

Input CSV should have:
- Column A: item_id (some blank)
- Column D: item_name (or adjust ITEM_NAME_COLUMN below)

Output: missing_item_ids_lookup.csv
"""

import csv
import sqlite3
import os
import sys

def lookup_missing_ids(db_path, csv_path):
    """Find candidate item_ids for rows missing item_id."""
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False
    
    if not os.path.exists(csv_path):
        print(f"❌ CSV file not found: {csv_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Load all items from database for matching
    cursor.execute("SELECT item_id, item_name, current_price FROM items")
    db_items = cursor.fetchall()
    conn.close()
    
    # Build lookup by name (lowercase for case-insensitive matching)
    name_to_items = {}
    for item_id, item_name, price in db_items:
        key = item_name.lower().strip()
        if key not in name_to_items:
            name_to_items[key] = []
        name_to_items[key].append((item_id, item_name, price))
    
    print(f"📂 Reading: {csv_path}")
    print(f"💾 Database has {len(db_items)} items")
    
    missing_rows = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if not header:
            print("❌ No header row found")
            return False
        
        # Find columns by header name
        header_lower = [h.lower().strip() for h in header]
        try:
            item_id_col = header_lower.index('item_id')
        except ValueError:
            print(f"❌ 'item_id' column not found in header: {header}")
            return False
        
        try:
            item_name_col = header_lower.index('item name')
        except ValueError:
            print(f"❌ 'item name' column not found in header: {header}")
            return False
        
        print(f"  📋 Header: {header}")
        print(f"  📍 item_id in column {item_id_col}, item name in column {item_name_col}")
        
        for row in reader:
            if len(row) <= max(item_id_col, item_name_col):
                continue
            
            item_id_str = row[item_id_col].strip() if row[item_id_col] else ""
            item_name = row[item_name_col].strip() if row[item_name_col] else ""
            
            # Skip if already has an item_id
            if item_id_str:
                continue
            
            # Skip if no item name
            if not item_name:
                continue
            
            # Look up candidates
            key = item_name.lower().strip()
            candidates = name_to_items.get(key, [])
            
            if candidates:
                candidate_ids = ", ".join(str(c[0]) for c in candidates)
                candidate_prices = ", ".join(f"${c[2]:.2f}" if c[2] else "N/A" for c in candidates)
            else:
                candidate_ids = ""
                candidate_prices = ""
            
            missing_rows.append({
                'item_name': item_name,
                'candidate_item_ids': candidate_ids,
                'candidate_prices': candidate_prices,
                'match_count': len(candidates)
            })
    
    # Write output
    output_path = "missing_item_ids_lookup.csv"
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['item_name', 'candidate_item_ids', 'candidate_prices', 'match_count'])
        writer.writeheader()
        writer.writerows(missing_rows)
    
    # Summary
    no_match = sum(1 for r in missing_rows if r['match_count'] == 0)
    one_match = sum(1 for r in missing_rows if r['match_count'] == 1)
    multi_match = sum(1 for r in missing_rows if r['match_count'] > 1)
    
    print(f"\n📊 Results: {len(missing_rows)} rows missing item_id")
    print(f"  ✅ 1 match (easy):     {one_match}")
    print(f"  ⚠️  Multiple matches:  {multi_match}")
    print(f"  ❌ No match found:     {no_match}")
    print(f"\n📄 Output: {output_path}")
    
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python lookup_missing_item_ids.py <input_csv>")
        print("Example: python lookup_missing_item_ids.py spreadsheet_costs.csv")
        sys.exit(1)
    
    csv_path = sys.argv[1]
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "cafe_reports.db")
    
    lookup_missing_ids(db_path, csv_path)
