#!/usr/bin/env python3
"""
Update item categories from Excel spreadsheet.
Reads the category mapping from the Excel file and updates both
the items and transactions tables.
"""

import sqlite3
import pandas as pd

DB_PATH = '../database/cafe_reports.db'
EXCEL_PATH = 'newcatalog.xlsx'


def read_category_mapping(excel_path: str) -> dict:
    """
    Read category mapping from Excel file.

    Returns:
        Dictionary mapping item_id -> lowercase_category
    """
    print("Reading Excel file...")

    # Read Excel - assuming first sheet, columns are: product_id, product_name, category, ...
    df = pd.read_excel(excel_path)

    # Get column names
    print(f"Found columns: {list(df.columns)}")

    # Extract mapping - convert category to lowercase for database
    mapping = {}
    for _, row in df.iterrows():
        item_id = int(row.iloc[0])  # First column = product_id
        category = str(row.iloc[2]).strip()  # Third column = category

        # Convert to lowercase for database
        category_lower = category.lower()
        mapping[item_id] = category_lower

    print(f"✓ Read {len(mapping)} items from Excel")
    return mapping


def get_database_items(db_path: str) -> list:
    """
    Get all items from database.

    Returns:
        List of (item_id, item_name, current_category) tuples
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT item_id, item_name, category FROM items ORDER BY item_id")
    items = cursor.fetchall()
    conn.close()

    print(f"✓ Found {len(items)} items in database")
    return items


def update_items_table(db_path: str, category_mapping: dict) -> tuple:
    """
    Update categories in items table.

    Returns:
        (updated_count, missing_count, missing_items)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all items
    cursor.execute("SELECT item_id, item_name, category FROM items")
    db_items = cursor.fetchall()

    updated_count = 0
    missing_items = []

    for item_id, item_name, old_category in db_items:
        if item_id in category_mapping:
            new_category = category_mapping[item_id]

            # Only update if category changed
            if new_category != old_category:
                cursor.execute(
                    "UPDATE items SET category = ? WHERE item_id = ?",
                    (new_category, item_id)
                )
                updated_count += 1
        else:
            # Item in database but not in spreadsheet - this is a problem!
            missing_items.append((item_id, item_name, old_category))

    conn.commit()
    conn.close()

    return updated_count, len(missing_items), missing_items


def update_transactions_table(db_path: str) -> int:
    """
    Update transaction categories to match items table.

    Returns:
        Number of transactions updated
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        UPDATE transactions
        SET category = (
            SELECT category
            FROM items
            WHERE items.item_id = transactions.item_id
        )
    """

    cursor.execute(query)
    updated_count = cursor.rowcount

    conn.commit()
    conn.close()

    return updated_count


def verify_categories(db_path: str):
    """
    Show category distribution after update.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, COUNT(*) as count
        FROM items
        GROUP BY category
        ORDER BY count DESC
    """)

    results = cursor.fetchall()
    conn.close()

    print("\nCategory Distribution (Items Table):")
    print(f"{'Category':<20} {'Count':<10}")
    print("-" * 30)
    for category, count in results:
        print(f"{category:<20} {count:<10}")


def main():
    print("=" * 80)
    print("Update Item Categories from Excel Spreadsheet")
    print("=" * 80)
    print()

    try:
        # Read category mapping from Excel
        category_mapping = read_category_mapping(EXCEL_PATH)

        # Get database items
        db_items = get_database_items(DB_PATH)

        print()
        print("Updating items table...")

        # Update items table
        updated_count, missing_count, missing_items = update_items_table(
            DB_PATH, category_mapping
        )

        print(f"✓ Updated {updated_count} items")

        # Check for missing mappings
        if missing_count > 0:
            print()
            print("=" * 80)
            print(f"⚠ WARNING: {missing_count} items in database NOT found in spreadsheet!")
            print("=" * 80)
            print()
            print("Missing items:")
            print(f"{'ID':<8} {'Name':<50} {'Category':<20}")
            print("-" * 80)
            for item_id, item_name, category in missing_items[:20]:
                print(f"{item_id:<8} {item_name:<50} {category:<20}")

            if len(missing_items) > 20:
                print(f"... and {len(missing_items) - 20} more")

            print()
            response = input("Continue with transaction update? (yes/no): ").lower().strip()
            if response != 'yes':
                print("Aborted.")
                return

        print()
        print("Updating transactions table...")

        # Update transactions table
        trans_updated = update_transactions_table(DB_PATH)
        print(f"✓ Updated {trans_updated} transactions")

        # Show final distribution
        print()
        print("=" * 80)
        verify_categories(DB_PATH)

        print()
        print("=" * 80)
        print("✓ Done! Categories updated successfully.")
        print("  - Items table: categories updated")
        print("  - Transactions table: synced with items")
        print("=" * 80)
        print()
        print("💡 Restart your backend server to see the changes in reports.")

    except FileNotFoundError as e:
        print(f"✗ Error: File not found - {e}")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
