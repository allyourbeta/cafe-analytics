#!/usr/bin/env python3
"""
Import TouchNet Excel data into cafe database.
Preserves TouchNet item IDs as primary keys.
Handles cancellations:
  - Full cancellation (qty -N matches original qty N): deletes transaction
  - Partial cancellation (qty -1 on original qty 2): reduces quantity to 1

Usage:
    python import_touchnet_data.py <excel_file1> <excel_file2> ...

Example:
    python import_touchnet_data.py data/*.xls
"""

import sqlite3
import sys
import re
from datetime import datetime
from collections import defaultdict
import csv

# Category mapping from backup CSV
CATEGORY_MAPPING = {}


def load_category_mapping(csv_path):
    """Load item_id → category mapping from CSV."""
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_id = int(row['item_id'])
            CATEGORY_MAPPING[item_id] = {
                'category': row['category'],
                'price': float(row['current_price']),
                'cost': float(row['current_cost'])
            }
    print(f"✅ Loaded {len(CATEGORY_MAPPING)} category mappings")


def parse_excel_file(excel_path):
    """
    Parse TouchNet Excel file and extract items + transactions.

    Returns:
        items: dict {touchnet_id: {'name': str, 'category': str, 'price': float, 'cost': float}}
        transactions: list of dicts
    """
    print(f"\n📄 Processing: {excel_path}")

    import xlrd
    wb = xlrd.open_workbook(excel_path)
    sheet = wb.sheet_by_index(0)

    items = {}
    transactions = []
    current_item_id = None
    current_item_name = None
    current_category = None

    for row_idx in range(sheet.nrows):
        # Get first two columns
        col1_val = sheet.cell_value(row_idx, 1) if sheet.ncols > 1 else ''
        col1 = str(col1_val).strip()

        # Check if this is an item header (e.g., "101 Espresso")
        item_match = re.match(r'^(\d+)\s+(.+)$', col1)

        if item_match:
            # New item header found
            current_item_id = int(item_match.group(1))
            current_item_name = item_match.group(2).strip()

            # Get category info from mapping (or default to 'other drinks')
            if current_item_id in CATEGORY_MAPPING:
                mapping = CATEGORY_MAPPING[current_item_id]
                current_category = mapping['category']
                price = mapping['price']
                cost = mapping['cost']
            else:
                print(
                    f"  ⚠️  Item not in mapping: {current_item_id} {current_item_name} (defaulting to 'other drinks')")
                current_category = 'other drinks'
                price = 0.0
                cost = 0.0

            # Store item info (will update price if we see higher values in transactions)
            if current_item_id not in items:
                items[current_item_id] = {
                    'name': current_item_name,
                    'category': current_category,
                    'price': price,
                    'cost': cost
                }

        elif current_item_id is not None:
            # This might be a transaction row under the current item
            try:
                # Check if col1 is a register number
                if col1 and col1 != 'nan' and col1 != 'REG #':
                    try:
                        register_num = int(float(col1))
                    except ValueError:
                        continue

                    if register_num not in [1, 3, 4]:
                        continue

                    # Parse transaction data
                    # Column 3: timestamp (Excel date serial number)
                    # Column 4: quantity
                    # Column 12 (last): amount

                    if sheet.ncols < 5:
                        continue

                    timestamp_val = sheet.cell_value(row_idx, 3)
                    quantity_val = sheet.cell_value(row_idx, 4)
                    amount_val = sheet.cell_value(row_idx, sheet.ncols - 1)

                    # Parse quantity
                    try:
                        quantity = int(float(quantity_val)) if quantity_val else 0
                    except:
                        continue

                    # Skip zero quantities
                    if quantity == 0:
                        continue

                    # Parse amount
                    try:
                        amount = float(amount_val) if amount_val else 0.0
                    except:
                        continue

                    # Calculate unit cost
                    unit_price = amount / quantity if quantity > 0 else 0.0

                    # Parse timestamp
                    try:
                        if isinstance(timestamp_val, float):
                            # Excel date serial number
                            dt = xlrd.xldate_as_datetime(timestamp_val, wb.datemode)
                        else:
                            # String timestamp
                            timestamp_str = str(timestamp_val).strip()
                            if '.' in timestamp_str:
                                dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S.%f")
                            else:
                                dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                    except Exception as e:
                        continue

                    # Update item's current price if this transaction has a higher price
                    if unit_price > items[current_item_id]['price']:
                        items[current_item_id]['price'] = unit_price

                    # Store transaction
                    transactions.append({
                        'timestamp': dt,
                        'item_id': current_item_id,
                        'item_name': current_item_name,
                        'category': current_category,
                        'quantity': quantity,
                        'register_num': register_num,
                        'unit_price': unit_price,
                        'total_amount': amount
                    })

            except Exception as e:
                # Not a transaction row, skip
                pass

    print(f"  ✅ Found {len(items)} unique items")
    print(f"  ✅ Found {len(transactions)} transactions")

    return items, transactions


def import_data(db_path, excel_files, category_csv):
    """Import all data from Excel files into database."""

    # Load category mappings first
    load_category_mapping(category_csv)

    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    all_items = {}
    all_transactions = []

    # Process each Excel file
    for excel_file in excel_files:
        items, transactions = parse_excel_file(excel_file)

        # Merge items (keep highest price/cost seen)
        for item_id, item_data in items.items():
            if item_id in all_items:
                # Update with highest price
                if item_data['price'] > all_items[item_id]['price']:
                    all_items[item_id]['price'] = item_data['price']
                if item_data['cost'] > all_items[item_id]['cost']:
                    all_items[item_id]['cost'] = item_data['cost']
            else:
                all_items[item_id] = item_data

        all_transactions.extend(transactions)

    # Insert items
    print(f"\n💾 Inserting {len(all_items)} items...")
    for item_id, item_data in sorted(all_items.items()):
        try:
            cursor.execute("""
                INSERT INTO items (item_id, item_name, category, current_price, current_cost)
                VALUES (?, ?, ?, ?, ?)
            """, (
                item_id,
                item_data['name'],
                item_data['category'],
                item_data['price'],
                item_data['cost']
            ))
        except sqlite3.IntegrityError as e:
            print(f"  ⚠️  Duplicate item_id {item_id}: {item_data['name']}")

    # Insert transactions
    print(f"💾 Processing {len(all_transactions)} transactions...")

    # Sort by timestamp for consistency
    all_transactions.sort(key=lambda t: t['timestamp'])

    insert_count = 0
    delete_count = 0
    update_count = 0

    for txn in all_transactions:
        if txn['quantity'] < 0:
            # This is a cancellation - find the matching positive transaction
            cancel_qty = abs(txn['quantity'])

            cursor.execute("""
                SELECT transaction_id, quantity, unit_price
                FROM transactions
                WHERE transaction_date = ?
                  AND item_id = ?
                  AND register_num = ?
                  AND quantity > 0
                LIMIT 1
            """, (
                txn['timestamp'],
                txn['item_id'],
                txn['register_num']
            ))

            result = cursor.fetchone()
            if result:
                txn_id, original_qty, unit_price = result

                if cancel_qty >= original_qty:
                    # Full cancellation - delete the transaction
                    cursor.execute("DELETE FROM transactions WHERE transaction_id = ?", (txn_id,))
                    delete_count += 1
                else:
                    # Partial cancellation - reduce quantity and total_amount
                    new_qty = original_qty - cancel_qty
                    new_total = new_qty * unit_price
                    cursor.execute("""
                        UPDATE transactions 
                        SET quantity = ?, total_amount = ?
                        WHERE transaction_id = ?
                    """, (new_qty, new_total, txn_id))
                    update_count += 1
        else:
            # Positive quantity - insert the transaction
            try:
                cursor.execute("""
                    INSERT INTO transactions (
                        transaction_date, item_id, item_name, category,
                        quantity, register_num, unit_price, total_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    txn['timestamp'],
                    txn['item_id'],
                    txn['item_name'],
                    txn['category'],
                    txn['quantity'],
                    txn['register_num'],
                    txn['unit_price'],
                    txn['total_amount']
                ))
                insert_count += 1
            except sqlite3.IntegrityError:
                # Duplicate transaction, skip
                pass

    print(f"  ✅ Inserted {insert_count} transactions")
    print(f"  ✅ Deleted {delete_count} cancelled transactions")
    if update_count > 0:
        print(f"  ✅ Updated {update_count} partial cancellations")

    conn.commit()
    conn.close()

    print("\n✅ Import complete!")
    print(f"   Items: {len(all_items)}")
    print(f"   Transactions: {insert_count}")


def verify_import(db_path):
    """Verify the import worked correctly."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("\n🔍 Verification:")

    # Check items
    cursor.execute("SELECT COUNT(*) FROM items")
    item_count = cursor.fetchone()[0]
    print(f"   Items: {item_count}")

    # Check TouchNet IDs
    cursor.execute("SELECT MIN(item_id), MAX(item_id) FROM items")
    min_id, max_id = cursor.fetchone()
    print(f"   Item ID range: {min_id} - {max_id}")

    # Check transactions
    cursor.execute("SELECT COUNT(*) FROM transactions")
    txn_count = cursor.fetchone()[0]
    print(f"   Transactions: {txn_count}")

    # Check date range
    cursor.execute("SELECT MIN(transaction_date), MAX(transaction_date) FROM transactions")
    min_date, max_date = cursor.fetchone()
    print(f"   Date range: {min_date} - {max_date}")

    # Verify item 101 is Espresso
    cursor.execute("SELECT item_id, item_name, category FROM items WHERE item_id = 101")
    result = cursor.fetchone()
    if result:
        print(f"   ✅ Item 101 = {result[1]} ({result[2]})")
    else:
        print(f"   ⚠️  Item 101 not found!")

    # Check for orphaned transactions
    cursor.execute("""
        SELECT COUNT(*) FROM transactions t
        WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.item_id = t.item_id)
    """)
    orphans = cursor.fetchone()[0]
    if orphans > 0:
        print(f"   ⚠️  Warning: {orphans} orphaned transactions!")
    else:
        print(f"   ✅ No orphaned transactions")

    # Check category distribution
    print("\n📊 Category Distribution:")
    cursor.execute("""
        SELECT category, COUNT(*) as count 
        FROM items 
        GROUP BY category 
        ORDER BY count DESC
    """)
    for row in cursor.fetchall():
        print(f"   {row[0]:20} {row[1]:3} items")

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_touchnet_data.py <excel_file1> <excel_file2> ...")
        sys.exit(1)

    db_path = "cafe_reports.db"
    category_csv = "complete_product_list_with_categories.csv"
    excel_files = sys.argv[1:]

    print("🚀 TouchNet Data Import")
    print(f"   Database: {db_path}")
    print(f"   Category mapping: {category_csv}")
    print(f"   Excel files: {len(excel_files)}")

    import_data(db_path, excel_files, category_csv)
    verify_import(db_path)

    print("\n🎉 Done! Check the verification output above.")
