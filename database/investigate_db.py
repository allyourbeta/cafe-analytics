#!/usr/bin/env python3
"""
Investigate which items from sharpie25nov.xls are actually missing from the database.
"""

import sqlite3
import sys

# Items from the screenshot that were flagged as "not in mapping"
SUSPECTED_NEW_ITEMS = [
    (20132, "Chive Cream Cheese"),
    (20188, "Happy Hour Cider Sincere draft"),
    (20192, "HH Sincere Cider Pitcher"),
    (20208, "IPA Pitcher"),
    (20209, "HH IPA draft"),
    (20210, "Happy Hour IPA Pitcher"),
    (20252, "HH Mex Lag Pit"),
    (20278, "Large Iced Truffle Mocha"),
    (20389, "Cold Foam"),
    (20390, "Paulaner draft"),
    (20391, "Paulaner Pitcher"),
    (20392, "HH Paulaner"),
    (20393, "HH Paulaner Pitcher"),
    (20464, "TOTE BAG"),
    (20497, "Oski Beer"),
    (20534, "Crispin cider can"),
    (20538, "Lrg Apple Chai Cider"),
    (20539, "Med Apple Chai Cider"),
]


def investigate_database(db_path):
    """Run investigation queries."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("=" * 70)
    print("DATABASE INVESTIGATION")
    print("=" * 70)

    # 1. Total items count
    print("\n1️⃣  TOTAL ITEMS IN DATABASE")
    cursor.execute("SELECT COUNT(*) FROM items")
    total = cursor.fetchone()[0]
    print(f"   Total items: {total}")

    # 2. Item ID range
    print("\n2️⃣  ITEM ID RANGE")
    cursor.execute("SELECT MIN(item_id), MAX(item_id) FROM items")
    min_id, max_id = cursor.fetchone()
    print(f"   Range: {min_id} to {max_id}")

    # 3. Check each suspected new item
    print("\n3️⃣  CHECKING SUSPECTED NEW ITEMS")
    print("-" * 70)
    
    found_count = 0
    missing_count = 0
    
    for item_id, expected_name in SUSPECTED_NEW_ITEMS:
        cursor.execute(
            "SELECT item_id, item_name, category FROM items WHERE item_id = ?",
            (item_id,)
        )
        result = cursor.fetchone()
        
        if result:
            actual_id, actual_name, category = result
            print(f"   ✅ FOUND: {item_id} = {actual_name} ({category})")
            found_count += 1
        else:
            print(f"   ❌ MISSING: {item_id} {expected_name}")
            missing_count += 1

    print("-" * 70)
    print(f"   Found: {found_count} items")
    print(f"   Missing: {missing_count} items")

    # 4. Show all items in the 20000+ range
    print("\n4️⃣  ALL ITEMS IN 20000+ RANGE")
    print("-" * 70)
    cursor.execute("""
        SELECT item_id, item_name, category 
        FROM items 
        WHERE item_id >= 20000 
        ORDER BY item_id
    """)
    
    items_20000 = cursor.fetchall()
    if items_20000:
        print(f"   Found {len(items_20000)} items in 20000+ range:")
        for item_id, name, category in items_20000[:20]:  # Show first 20
            print(f"   {item_id:5d} {name:40s} {category}")
        if len(items_20000) > 20:
            print(f"   ... and {len(items_20000) - 20} more")
    else:
        print("   No items found in 20000+ range")

    # 5. Summary
    print("\n5️⃣  SUMMARY")
    print("-" * 70)
    
    if missing_count == 0:
        print("   🎉 All suspected items are ALREADY in the database!")
        print("   This suggests the import script is working correctly,")
        print("   and the warnings are expected for NEW data files.")
    else:
        print(f"   ⚠️  {missing_count} items are genuinely MISSING from the database")
        print("   These items were not in your CSV mapping file.")
        print("   They will be imported with default category 'other drinks'")
        print("   and price/cost of $0.00 until properly categorized.")

    print("\n" + "=" * 70)

    conn.close()


if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "cafe_reports.db"
    
    try:
        investigate_database(db_path)
    except sqlite3.OperationalError as e:
        print(f"❌ Error: Could not open database '{db_path}'")
        print(f"   {e}")
        print("\nUsage: python investigate_database.py [path/to/database.db]")
        sys.exit(1)
