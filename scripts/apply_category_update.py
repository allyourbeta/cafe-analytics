#!/usr/bin/env python3
"""
Apply category updates from the manager's CSV to the database.

Usage:
    python apply_category_update.py

This script:
1. Backs up current items to a timestamped CSV
2. Updates categories in the items table
3. Syncs categories to the transactions table
4. Clears the cache
5. Reports what changed
"""

import csv
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

# Paths (relative to script location)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
DB_PATH = PROJECT_ROOT / 'database' / 'cafe_reports.db'
CACHE_DIR = PROJECT_ROOT / 'cache'
UPDATE_CSV = SCRIPT_DIR / 'updated_categories_2dec2025.csv'

# Category remapping
CATEGORY_REMAP = {
    'events': 'space rental',
}


def load_updates(csv_path: Path) -> dict:
    """Load category updates from CSV. Returns dict of item_id -> new_category."""
    updates = {}

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_id = int(row['product_id'].strip())
            category = row['category'].strip().lower()

            # Apply remapping
            if category in CATEGORY_REMAP:
                category = CATEGORY_REMAP[category]

            updates[item_id] = category

    return updates


def backup_items(conn: sqlite3.Connection, backup_path: Path):
    """Export current items table to CSV as backup."""
    cursor = conn.cursor()
    cursor.execute("SELECT item_id, item_name, category, current_price, current_cost FROM items ORDER BY item_id")
    rows = cursor.fetchall()

    with open(backup_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['item_id', 'item_name', 'category', 'current_price', 'current_cost'])
        writer.writerows(rows)

    return len(rows)


def update_items(conn: sqlite3.Connection, updates: dict) -> tuple:
    """
    Update categories in items table.
    Returns (updated_count, not_found_ids, changes_list)
    """
    cursor = conn.cursor()

    updated = 0
    not_found = []
    changes = []

    for item_id, new_category in updates.items():
        # Get current category
        cursor.execute("SELECT item_name, category FROM items WHERE item_id = ?", (item_id,))
        row = cursor.fetchone()

        if row is None:
            not_found.append(item_id)
            continue

        item_name, old_category = row

        if old_category != new_category:
            cursor.execute(
                "UPDATE items SET category = ?, last_updated = CURRENT_TIMESTAMP WHERE item_id = ?",
                (new_category, item_id)
            )
            updated += 1
            changes.append((item_id, item_name, old_category, new_category))

    return updated, not_found, changes


def sync_transactions(conn: sqlite3.Connection) -> int:
    """Sync transaction categories to match items table."""
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE transactions
        SET category = (
            SELECT category FROM items WHERE items.item_id = transactions.item_id
        )
        WHERE EXISTS (
            SELECT 1 FROM items WHERE items.item_id = transactions.item_id
        )
    """)

    return cursor.rowcount


def clear_cache(cache_dir: Path) -> int:
    """Delete all cached files. Returns count of files deleted."""
    if not cache_dir.exists():
        return 0

    count = 0
    for f in cache_dir.iterdir():
        if f.is_file():
            f.unlink()
            count += 1

    return count


def main():
    print("=" * 70)
    print("APPLY CATEGORY UPDATES")
    print("=" * 70)
    print()

    # Check paths
    if not DB_PATH.exists():
        print(f"✗ Database not found: {DB_PATH}")
        print("  Make sure you're running this from the scripts/ folder")
        return

    if not UPDATE_CSV.exists():
        print(f"✗ Update CSV not found: {UPDATE_CSV}")
        print("  Copy the manager's CSV to the scripts/ folder")
        return

    # Load updates
    print(f"Loading updates from: {UPDATE_CSV.name}")
    updates = load_updates(UPDATE_CSV)
    print(f"  → {len(updates)} items in update file")
    print()

    # Connect to database
    conn = sqlite3.connect(DB_PATH)

    try:
        # Backup
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = SCRIPT_DIR / f'items_backup_{timestamp}.csv'
        print(f"Creating backup: {backup_path.name}")
        backup_count = backup_items(conn, backup_path)
        print(f"  → {backup_count} items backed up")
        print()

        # Update items
        print("Updating items table...")
        updated, not_found, changes = update_items(conn, updates)
        print(f"  → {updated} items updated")

        if not_found:
            print(f"  ⚠ {len(not_found)} IDs not found in database")
        print()

        # Show changes
        if changes:
            print("Changes applied:")
            print("-" * 70)
            for item_id, name, old_cat, new_cat in changes[:20]:
                name_short = name[:30] + '..' if len(name) > 32 else name
                print(f"  {item_id:<7} {name_short:<32} {old_cat} → {new_cat}")
            if len(changes) > 20:
                print(f"  ... and {len(changes) - 20} more")
            print()

        # Sync transactions
        print("Syncing transactions table...")
        trans_count = sync_transactions(conn)
        print(f"  → {trans_count} transactions updated")
        print()

        # Commit
        conn.commit()
        print("✓ Database changes committed")
        print()

        # Clear cache
        print("Clearing cache...")
        cache_count = clear_cache(CACHE_DIR)
        print(f"  → {cache_count} cache files deleted")
        print()

        # Summary
        print("=" * 70)
        print("✓ DONE")
        print(f"  - {updated} items updated")
        print(f"  - {trans_count} transactions synced")
        print(f"  - Backup saved: {backup_path.name}")
        print()
        print("Restart your backend server to see the changes in reports.")
        print("=" * 70)

    except Exception as e:
        conn.rollback()
        print(f"✗ Error: {e}")
        print("  Changes rolled back.")
        raise

    finally:
        conn.close()


if __name__ == '__main__':
    main()
