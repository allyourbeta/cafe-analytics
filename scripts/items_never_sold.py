#!/usr/bin/env python3
"""
Find items in the items table that have no transaction history.
"""

import sqlite3
import csv

DB_PATH = '../database/cafe_reports.db'
OUTPUT_CSV = 'items_never_sold.csv'


def get_items_never_sold(db_path: str) -> list:
    """
    Find items in the items table that have no corresponding transactions.

    Returns:
        List of tuples: (item_id, item_name, category, current_price, current_cost)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        SELECT
            i.item_id,
            i.item_name,
            i.category,
            i.current_price,
            i.current_cost
        FROM items i
        LEFT JOIN transactions t ON i.item_id = t.item_id
        WHERE t.item_id IS NULL
        ORDER BY i.item_id
    """

    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()

    return results


def write_to_csv(items: list, output_path: str) -> None:
    """
    Write items to CSV.

    Args:
        items: List of (item_id, item_name, category, price, cost) tuples
        output_path: Path to save the CSV
    """
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['item_id', 'item_name', 'category', 'current_price', 'current_cost'])

        for item_id, item_name, category, price, cost in items:
            writer.writerow([item_id, item_name, category, f'${price:.2f}', f'${cost:.2f}'])

    print(f"✓ Wrote {len(items)} items to {output_path}")


def main():
    print("=" * 70)
    print("Items Never Sold - Investigation Tool")
    print("=" * 70)
    print()

    # Get items with no transaction history
    items = get_items_never_sold(DB_PATH)

    if not items:
        print("✓ All items in the database have transaction history!")
        return

    print(f"⚠ Found {len(items)} items with NO transaction history")
    print()

    # Show first 10 as preview
    print("Preview of items never sold:")
    print(f"{'ID':<8} {'Name':<40} {'Category':<15} {'Price':<10}")
    print("-" * 75)
    for item_id, item_name, category, price, cost in items[:10]:
        print(f"{item_id:<8} {item_name:<40} {category:<15} ${price:.2f}")

    if len(items) > 10:
        print(f"... and {len(items) - 10} more")

    print()

    # Write to CSV
    write_to_csv(items, OUTPUT_CSV)

    print()
    print("=" * 70)
    print("Done! Check the CSV for the complete list.")
    print("=" * 70)


if __name__ == '__main__':
    main()
