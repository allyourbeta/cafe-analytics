#!/usr/bin/env python3
"""
Auto-categorize missing items from the database based on item names.
This script will:
1. Read the existing CSV to see which items are already categorized
2. Query the database for items NOT in the CSV
3. Auto-categorize based on keywords
4. Create a complete CSV with all items
"""

import sqlite3
import csv
import os
from typing import Dict, List, Tuple

# Database path (adjust if needed)
DB_PATH = '../database/cafe_reports.db'
INPUT_CSV = 'edmonds_product_catalog_template_-_product_catalog_template.csv'
OUTPUT_CSV = 'complete_product_catalog.csv'

# Category keyword mappings
CATEGORY_RULES = {
    'coffeetea': [
        'latte', 'cappuccino', 'mocha', 'macchiato', 'espresso', 'coffee',
        'americano', 'chai', 'tea', 'matcha', 'london fog', 'cafe au lait',
        'flat white', 'brewed coffee', 'hot chocolate', 'honey latte', 'carrier',
        'javalanche', 'peppermint', 'peppermnt', 'greek', 'pumpkin'
    ],
    'cold coffeetea': [
        'iced', 'cold brew', 'cold foam', 'arnold palmer', 'refresher',
        'dragonfruit', 'acai', 'pink drink', 'vanilla sweet cream cold',
        'frankenstein', 'dirty cherry'
    ],
    'baked goods': [
        'croissant', 'bagel', 'cookie', 'muffin', 'danish', 'bun', 'donut',
        'pretzel', 'loaf', 'marshmallow bar'
    ],
    'food': [
        'sandwich', 'burrito', 'breakfast', 'yogurt', 'cream cheese',
        'banana', 'sunbutter', 'meal', 'bacon', 'sausage', 'pesto', 'cubano',
        'eggything', 'chile verde', 'bean', 'cheese', 'vegan', 'chicken'
    ],
    'beer': [
        'beer', 'ipa', 'cider', 'lager', 'kombucha', 'pitcher', 'draft',
        'paulaner', 'raddler', 'oski', 'nelson', 'orale', 'sirena',
        'vato loco', 'crispin', 'east bros', 'eb mex'
    ],
    'wine': [
        'wine', 'sauvignon', 'pinot', 'chardonnay'
    ],
    'other drinks': [
        'lemonade', 'water', 'pellegrino', 'steamed milk',
        'soda', 'yerba mate', 'fizz', 'protein shake',
        'liquid death', 'izze', 'mocktail'
    ],
    'retail': [
        't-shirt', 'tote', 'hat', 'mug', 'sticker', 'chips', 'bar', 'protein bar',
        'nature valley', 'buddy fruit', 'clear bag', 'bubble wand', 'voucher'
    ],
    'add-ons': [
        'oat milk', 'almond milk', 'soy milk', 'flavor', 'hot water cup'
    ],
    'space rental': [
        'reservation', 'rental', 'patio', 'cafe', 'event', 'deal', 'combo',
        'creature', 'bulk', 'tab', '$1 off', 'herbal center'
    ]
}

# Happy hour mappings
HH_PREFIXES = ['hh ', 'happy hour ', 'happy-hour ']


def normalize_category(category: str) -> str:
    """Convert category to lowercase for database consistency."""
    return category.lower().strip()


def auto_categorize_item(item_name: str) -> str:
    """
    Auto-categorize an item based on its name using keyword matching.

    Args:
        item_name: The name of the item to categorize

    Returns:
        The determined category
    """
    item_lower = item_name.lower()

    # Check for happy hour items first
    for prefix in HH_PREFIXES:
        if item_lower.startswith(prefix):
            # Check if it's beer or wine
            if any(kw in item_lower for kw in CATEGORY_RULES['wine']):
                return 'hh wine'
            else:
                return 'hh beer'  # Default HH items to beer

    # Check cold coffee/tea before regular coffee/tea (iced takes precedence)
    if any(kw in item_lower for kw in CATEGORY_RULES['cold coffeetea']):
        return 'cold coffeetea'

    # Check all other categories
    for category, keywords in CATEGORY_RULES.items():
        if category in ['cold coffeetea']:  # Already checked
            continue

        for keyword in keywords:
            if keyword in item_lower:
                return category

    # Default to 'other drinks' if no match found
    return 'other drinks'


def read_existing_csv(csv_path: str) -> Dict[int, Tuple[str, str]]:
    """
    Read the existing CSV and return a dictionary of categorized items.

    Args:
        csv_path: Path to the existing CSV file

    Returns:
        Dictionary mapping product_id to (product_name, category)
    """
    categorized = {}

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                product_id = int(row['product_id'])
                product_name = row['product_name']
                category = normalize_category(row['category'])
                categorized[product_id] = (product_name, category)

        print(f"✓ Read {len(categorized)} items from existing CSV")
        return categorized

    except FileNotFoundError:
        print(f"⚠ CSV file not found: {csv_path}")
        return {}
    except Exception as e:
        print(f"⚠ Error reading CSV: {e}")
        return {}


def get_all_items_from_db(db_path: str) -> List[Tuple[int, str, str, float, float]]:
    """
    Query the database for all items.

    Args:
        db_path: Path to the SQLite database

    Returns:
        List of tuples: (item_id, item_name, category, current_price, current_cost)
    """
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        query = """
            SELECT item_id, item_name, category, current_price, current_cost
            FROM items
            ORDER BY item_name
        """

        cursor.execute(query)
        items = cursor.fetchall()
        conn.close()

        print(f"✓ Found {len(items)} total items in database")
        return items

    except sqlite3.Error as e:
        print(f"✗ Database error: {e}")
        return []
    except FileNotFoundError:
        print(f"✗ Database file not found: {db_path}")
        return []


def create_complete_csv(
    categorized_items: Dict[int, Tuple[str, str]],
    all_items: List[Tuple[int, str, str, float, float]],
    output_path: str
) -> None:
    """
    Create a complete CSV with all items, auto-categorizing missing ones.

    Args:
        categorized_items: Dictionary of already categorized items from CSV
        all_items: List of all items from database
        output_path: Path to save the output CSV
    """
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Write header
        writer.writerow([
            'product_id',
            'product_name',
            'category',
            'current_price',
            'current_COGS (including paper, plastic)',
            'Traci comment',
            'AUTO_CATEGORIZED'
        ])

        auto_categorized_count = 0
        manual_categorized_count = 0

        for item_id, item_name, db_category, price, cost in all_items:
            # Check if item was in the CSV (manually categorized)
            if item_id in categorized_items:
                csv_name, csv_category = categorized_items[item_id]
                writer.writerow([
                    item_id,
                    item_name,  # Use DB name in case of discrepancies
                    csv_category.title(),  # Use title case for display
                    f'${price:.2f}',
                    f'${cost:.2f}',
                    '',
                    'NO'  # Not auto-categorized
                ])
                manual_categorized_count += 1
            else:
                # Auto-categorize this item
                auto_category = auto_categorize_item(item_name)
                writer.writerow([
                    item_id,
                    item_name,
                    auto_category.title(),  # Use title case for display
                    f'${price:.2f}',
                    f'${cost:.2f}',
                    '',
                    'YES'  # Auto-categorized
                ])
                auto_categorized_count += 1

    print(f"\n✓ Created complete CSV: {output_path}")
    print(f"  - {manual_categorized_count} items from your original CSV")
    print(f"  - {auto_categorized_count} items auto-categorized")
    print(f"  - {manual_categorized_count + auto_categorized_count} total items")
    print(f"\nℹ Items marked 'YES' in AUTO_CATEGORIZED column should be reviewed!")


def main():
    """Main execution function."""
    print("=" * 70)
    print("Auto-Categorization Tool for Cafe Items")
    print("=" * 70)
    print()

    # Read existing categorized items from CSV
    categorized_items = read_existing_csv(INPUT_CSV)

    # Get all items from database
    all_items = get_all_items_from_db(DB_PATH)

    if not all_items:
        print("\n✗ No items found. Please check database path and connection.")
        return

    # Create complete CSV
    create_complete_csv(categorized_items, all_items, OUTPUT_CSV)

    print("\n" + "=" * 70)
    print("✓ Done! Review the output CSV and adjust any incorrect categories.")
    print("=" * 70)


if __name__ == '__main__':
    main()
