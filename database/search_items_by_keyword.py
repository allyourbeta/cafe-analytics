#!/usr/bin/env python3
"""
Search database items by keyword list, grouped by keyword.

Usage:
    python search_items_by_keyword.py

Output: Prints all matching items grouped by keyword, also saves to keyword_search_results.csv
"""

import sqlite3
import csv
import os

KEYWORDS = [
    'latte',
    'tea',
    'traditional',
    'vanilla',
    'matcha',
    'truffle',
    'boichik',
    'lemonade',
    'mocha',
    'organic',
    'espresso',
    'cappuccino',
    'traditional',
    'acai',
    'mocha',
    'london',
    'lemonade',
]


def search_by_keywords(db_path):
    """Search for items matching each keyword."""

    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    all_results = []

    for keyword in KEYWORDS:
        cursor.execute("""
            SELECT item_id, item_name, current_price, category
            FROM items
            WHERE LOWER(item_name) LIKE ?
            ORDER BY item_name
        """, (f'%{keyword.lower()}%',))

        rows = cursor.fetchall()

        print(f"\n=== {keyword.upper()} ({len(rows)} matches) ===")
        for item_id, item_name, price, category in rows:
            price_str = f"${price:.2f}" if price else "N/A"
            print(f"  {item_id}: {item_name:<40} {price_str:<10} {category}")
            all_results.append({
                'keyword': keyword,
                'item_id': item_id,
                'item_name': item_name,
                'price': price_str,
                'category': category
            })

    conn.close()

    # Save to CSV
    output_path = "keyword_search_results.csv"
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['keyword', 'item_id', 'item_name', 'price', 'category'])
        writer.writeheader()
        writer.writerows(all_results)

    print(f"\n📄 Results saved to: {output_path}")


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "cafe_reports.db")

    search_by_keywords(db_path)
