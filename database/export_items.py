#!/usr/bin/env python3
"""
Export items from database to CSV.

Exports: item_id, item_name, current_price, current_cost

Usage:
    python export_items.py [output_file.csv]
    python export_items.py                    # defaults to items_export.csv
    python export_items.py my_items.csv
"""

import csv
import sqlite3
import os
import sys


def export_items(db_path, output_path):
    """Export items from database to CSV."""
    
    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT item_id, item_name, current_price, current_cost
        FROM items
        ORDER BY item_id
    """)
    
    rows = cursor.fetchall()
    conn.close()
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['item_id', 'item_name', 'current_price', 'current_cost'])
        
        for row in rows:
            item_id, item_name, price, cost = row
            # Format cost as empty string if NULL
            cost_str = f"${cost:.2f}" if cost is not None else ""
            price_str = f"${price:.2f}" if price is not None else ""
            writer.writerow([item_id, item_name, price_str, cost_str])
    
    print(f"✅ Exported {len(rows)} items to: {output_path}")
    return True


if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "db_items.csv"
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "cafe_reports.db")
    output_path = os.path.join(script_dir, output_file)
    
    export_items(db_path, output_path)
