#!/usr/bin/env python3
"""
Delete items from the items table that have no transaction history.
Shows preview and asks for confirmation before deletion.
"""

import sqlite3

DB_PATH = '../database/cafe_reports.db'


def find_items_to_delete(db_path: str) -> list:
    """
    Find items with no transaction history.

    Returns:
        List of tuples: (item_id, item_name, category, current_price)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        SELECT
            i.item_id,
            i.item_name,
            i.category,
            i.current_price
        FROM items i
        LEFT JOIN transactions t ON i.item_id = t.item_id
        WHERE t.item_id IS NULL
        ORDER BY i.item_id
    """

    cursor.execute(query)
    items = cursor.fetchall()
    conn.close()

    return items


def delete_items(db_path: str, item_ids: list) -> int:
    """
    Delete items by their IDs.

    Args:
        db_path: Path to database
        item_ids: List of item IDs to delete

    Returns:
        Number of items deleted
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    placeholders = ','.join('?' * len(item_ids))
    query = f"DELETE FROM items WHERE item_id IN ({placeholders})"

    cursor.execute(query, item_ids)
    deleted_count = cursor.rowcount

    conn.commit()
    conn.close()

    return deleted_count


def main():
    print("=" * 80)
    print("Clean Up Items Table - Remove Items With No Transaction History")
    print("=" * 80)
    print()

    # Find items to delete
    print("Searching for items with no transaction history...")
    items_to_delete = find_items_to_delete(DB_PATH)

    if not items_to_delete:
        print("✓ No items to delete! All items in the database have transaction history.")
        return

    print(f"\n⚠ Found {len(items_to_delete)} items with NO transaction history")
    print()

    # Show preview
    print("Preview of items to be deleted:")
    print(f"{'ID':<8} {'Name':<50} {'Category':<20} {'Price':<10}")
    print("-" * 90)

    for item_id, item_name, category, price in items_to_delete[:20]:
        print(f"{item_id:<8} {item_name:<50} {category:<20} ${price:.2f}")

    if len(items_to_delete) > 20:
        print(f"... and {len(items_to_delete) - 20} more items")

    print()
    print("=" * 80)
    print(f"⚠ WARNING: This will permanently delete {len(items_to_delete)} items!")
    print("=" * 80)
    print()

    # Ask for confirmation
    response = input("Type 'DELETE' to proceed, or anything else to cancel: ").strip()

    if response != 'DELETE':
        print("\n✓ Cancelled. No items were deleted.")
        return

    print()
    print("Deleting items...")

    # Delete the items
    item_ids = [item[0] for item in items_to_delete]
    deleted_count = delete_items(DB_PATH, item_ids)

    print(f"✓ Deleted {deleted_count} items from the database")

    # Verify
    remaining = find_items_to_delete(DB_PATH)

    print()
    print("=" * 80)
    print("Verification:")
    print(f"  Items deleted: {deleted_count}")
    print(f"  Items remaining with no transactions: {len(remaining)}")
    print("=" * 80)

    if len(remaining) == 0:
        print("\n✓ Success! All items now have transaction history.")
    else:
        print(f"\n⚠ Note: {len(remaining)} items still have no transactions.")


if __name__ == '__main__':
    main()
