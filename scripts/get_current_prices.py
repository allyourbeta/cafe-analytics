#!/usr/bin/env python3
"""
Extract current prices for all items based on their most recent transaction.
"""

import sqlite3
import csv

DB_PATH = '../database/cafe_reports.db'
OUTPUT_CSV = 'items_with_current_prices.csv'


def get_current_prices(db_path: str) -> list:
    """
    Query the database for all items and their most recent transaction prices.

    Returns:
        List of tuples: (item_id, item_name, most_recent_price)
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    query = """
        SELECT
            t.item_id,
            t.item_name,
            t.unit_price
        FROM transactions t
        INNER JOIN (
            SELECT
                item_id,
                MAX(transaction_datetime) as latest_datetime
            FROM transactions
            GROUP BY item_id
        ) latest ON t.item_id = latest.item_id
                AND t.transaction_datetime = latest.latest_datetime
        GROUP BY t.item_id, t.item_name, t.unit_price
        ORDER BY t.item_id
    """

    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()

    return results


def write_to_csv(items: list, output_path: str) -> None:
    """
    Write items and prices to CSV.

    Args:
        items: List of (item_id, item_name, price) tuples
        output_path: Path to save the CSV
    """
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['item_id', 'item_name', 'most_recent_price'])

        for item_id, item_name, price in items:
            writer.writerow([item_id, item_name, f'${price:.2f}'])

    print(f"✓ Wrote {len(items)} items to {output_path}")


def main():
    print("=" * 70)
    print("Current Price Extraction Tool")
    print("=" * 70)
    print()

    # Get current prices from most recent transactions
    items = get_current_prices(DB_PATH)

    if not items:
        print("✗ No items found in database")
        return

    print(f"✓ Found {len(items)} items with transaction history")

    # Write to CSV
    write_to_csv(items, OUTPUT_CSV)

    print()
    print("=" * 70)
    print("Done!")
    print("=" * 70)


if __name__ == '__main__':
    main()
