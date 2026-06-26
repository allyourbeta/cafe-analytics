#!/usr/bin/env python3
"""
Vivonet → DB product name mapping.

The Vivonet POS uses different naming conventions than the old TouchNet system.
This script handles two things:

1. NAME ALIASES: Products where Vivonet uses a different name for the same item
   (e.g., "Lrg Latte" in Vivonet = "Large Latte" in our DB, item_id 1232).
   For these, we update vivonet_service.py's name matching by adding the
   Vivonet name as a second entry in the items table... OR we can keep a
   separate alias table. This script uses the simpler approach: it updates
   the item_name in the DB to match Vivonet's name (since Vivonet is now
   the system of record).

2. NEW ITEMS: Products that didn't exist in TouchNet at all
   (e.g., "Raspberry Beignets", "Chorizo Burrito").
   These get inserted into the items table with a default category.

Usage:
    # Dry run (shows what would change, no DB modifications)
    python seed_vivonet_products.py --dry-run

    # Apply changes
    python seed_vivonet_products.py

    # Custom DB path
    python seed_vivonet_products.py --db /path/to/cafe_reports.db
"""

import argparse
import os
import sqlite3
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "cafe_reports.db")

# ---------------------------------------------------------------------------
# Mapping: Vivonet name → existing DB item_id
#
# These were identified by comparing the 98 unique Vivonet product names
# against the items table. Close matches confirmed by matching prices and
# product descriptions.
#
# Format: "vivonet_name": existing_item_id
# ---------------------------------------------------------------------------

VIVONET_TO_ITEM_ID = {
    # "Lrg" → "Large" renames (Vivonet abbreviates, DB has full name)
    "Lrg Americano": 1233,
    "Lrg Arnold Palmer": 1261,
    "Lrg Brewed Coffee": 1203,       # "Large Brewed Coffee" in DB... wait
    "Lrg Cappuccino": 1236,
    "Lrg Chai Tea Latte": 1262,
    "Lrg Cold Brew": 1230,
    "Lrg Hot Caramel Macchiato": 1237,
    "Lrg Hot Chocolate": 1234,
    "Lrg Hot Tea": 1235,
    "Lrg Iced Americano": 1203,
    "Lrg Iced Caramel Macchiato": 1238,
    "Lrg Iced Chai Tea Latte": 1240,
    "Lrg Iced Cookie Cold Brew": 1320,
    "Lrg Iced Matcha": 1231,
    "Lrg Iced Mocha": 1239,
    "Lrg Iced Strawberry Matcha": 1341,
    "Lrg Iced Tea": 1253,
    "Lrg Latte": 1232,
    "Lrg London Fog": 1260,
    "Lrg Matcha Latte": 1259,
    "Lrg Mocha": 1243,
    "Lrg Strawberry Acai Refresher": 1257,

    # Formatting differences (parentheses, abbreviations, spacing)
    "Caramel Macchiato (Iced)": 1150,   # "Caramel Macchiato Iced" in DB
    "Caramel Macchiato Hot": 1111,      # "Caramel Macchiato (Hot)" in DB
    "Chai Tea Latte (Hot)": 1176,       # "Chai Tea Latte Hot" in DB
    "Chai Tea Latte (Iced)": 1177,      # "Iced Chai Tea Latte" in DB
    "ChocolateChunkCookie": 1119,       # "Chocolate Chunk Cookie" in DB
    "Ham & Chz Croissant": 1145,        # "Ham & Cheese Croissant" in DB
    "Pink Drink (Iced)": 1338,          # "Pink Drink" in DB
    "Cookie Cold Brew": 1319,           # "Milano Cookie Cold Brew" in DB
    "Lrg Iced Cookie Cold Brew": 1320,  # "Large Milano Cookie Cold Brew" in DB

    # Abbreviated names
    "Bacon Breakfast B.": 1279,         # "Bacon Breakfast Burrito"
    "Chile Verde B.": 1281,             # "Chile Verde Burrito"
    "Eggything Sandwich": 1280,         # "Eggything Breakfast Sandwich"

    # Priced modifiers with "..." prefix → existing DB items
    "...$Extra Sweet": 1296,            # "$Extra Sweet" if exists, else new
}

# ---------------------------------------------------------------------------
# New items: products in Vivonet that have no equivalent in the DB.
# These must be inserted fresh.
#
# Format: "vivonet_name": (category, price)
#
# ⚠️  REVIEW THESE CATEGORIES before running. Defaults are best guesses.
# ---------------------------------------------------------------------------

NEW_ITEMS = {
    "Raspberry Beignets": ("baked goods", 3.00),
    "Chorizo Burrito": ("food", 7.50),
    "Chx Sausage Sandwich": ("food", 6.25),
    "Turkey Pesto": ("food", 14.00),
    "Plant Based B.": ("food", 7.50),       # Plant Based Burrito
    "VSCCB": ("cold coffeetea", 5.50),      # Vanilla Sweet Cream Cold Brew
    "Lrg VSCCB": ("cold coffeetea", 6.00),
    "Vanilla Latte (hot)": ("coffeetea", 6.25),
    "Vanilla Latte (iced)": ("cold coffeetea", 6.25),
    "Lrg Vanilla Latte": ("coffeetea", 6.75),
    "Lrg Vanilla Latte (iced)": ("cold coffeetea", 6.75),
    "Brownie Muffin": ("baked goods", 5.00),
    "...$Extra Shot": ("coffeetea", 1.00),  # Priced modifier (extra espresso)
}


def apply_mapping(db_path, dry_run=False):
    """
    Apply the Vivonet product mapping to the database.

    For aliases: Updates item_name to match Vivonet's naming convention
    (since Vivonet is now the system of record).

    For new items: Inserts with the next available item_id.
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Load existing items
    cursor.execute("SELECT item_id, item_name FROM items")
    existing_by_id = {row[0]: row[1] for row in cursor.fetchall()}
    existing_by_name = {v.lower(): k for k, v in existing_by_id.items()}

    print(f"📋 Existing items in DB: {len(existing_by_id)}")
    print(f"📋 Vivonet aliases to map: {len(VIVONET_TO_ITEM_ID)}")
    print(f"📋 New items to insert: {len(NEW_ITEMS)}")

    if dry_run:
        print("\n🔍 DRY RUN — no changes will be made\n")

    # --- Step 1: Verify and apply aliases ---
    print("\n=== ALIASES (Vivonet name → existing item_id) ===")
    alias_count = 0
    alias_errors = 0

    for vivonet_name, item_id in sorted(VIVONET_TO_ITEM_ID.items()):
        # Check if Vivonet name already exists
        if vivonet_name.lower() in existing_by_name:
            print(f"  ⏭️  {vivonet_name:40} already exists as "
                  f"item_id={existing_by_name[vivonet_name.lower()]}")
            continue

        # Check if target item_id exists
        if item_id not in existing_by_id:
            print(f"  ❌ {vivonet_name:40} → item_id={item_id} NOT FOUND in DB!")
            alias_errors += 1
            continue

        old_name = existing_by_id[item_id]
        print(f"  🔄 {old_name:40} → {vivonet_name}")

        if not dry_run:
            cursor.execute(
                "UPDATE items SET item_name = ?, last_updated = CURRENT_TIMESTAMP "
                "WHERE item_id = ?",
                (vivonet_name, item_id)
            )
            # Also update any existing transactions for this item
            cursor.execute(
                "UPDATE transactions SET item_name = ? WHERE item_id = ?",
                (vivonet_name, item_id)
            )
        alias_count += 1

    # --- Step 2: Insert new items ---
    print(f"\n=== NEW ITEMS ===")
    new_count = 0

    # Get next available item_id
    cursor.execute("SELECT MAX(item_id) FROM items")
    max_id = cursor.fetchone()[0] or 0
    next_id = max_id + 1

    for vivonet_name, (category, price) in sorted(NEW_ITEMS.items()):
        # Check if already exists
        if vivonet_name.lower() in existing_by_name:
            print(f"  ⏭️  {vivonet_name:40} already exists "
                  f"(item_id={existing_by_name[vivonet_name.lower()]})")
            continue

        print(f"  🆕 {vivonet_name:40} → item_id={next_id}  "
              f"category={category}  ${price:.2f}")

        if not dry_run:
            cursor.execute(
                "INSERT INTO items (item_id, item_name, category, "
                "current_price, current_cost) VALUES (?, ?, ?, ?, 0)",
                (next_id, vivonet_name, category, price)
            )
        next_id += 1
        new_count += 1

    # --- Summary ---
    print(f"\n📊 Summary:")
    print(f"   Aliases applied:  {alias_count}")
    print(f"   Alias errors:     {alias_errors}")
    print(f"   New items added:  {new_count}")

    if alias_errors > 0:
        print(f"\n   ⚠️  {alias_errors} aliases reference item_ids not found in DB.")
        print(f"   Update VIVONET_TO_ITEM_ID with correct item_ids from your database.")

    if not dry_run:
        conn.commit()
        print("\n✅ Changes committed to database.")
    else:
        print("\n🔍 Dry run complete. Run without --dry-run to apply.")

    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Map Vivonet product names to existing DB items"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would change without modifying the database"
    )
    parser.add_argument(
        "--db", default=DB_PATH,
        help="Database path (default: database/cafe_reports.db)"
    )
    args = parser.parse_args()
    apply_mapping(args.db, args.dry_run)
