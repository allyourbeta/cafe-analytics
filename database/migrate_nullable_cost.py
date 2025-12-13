#!/usr/bin/env python3
"""
Migration script: Make current_cost nullable and set all existing costs to NULL.

This allows us to distinguish between:
- NULL = unknown cost (exclude from profit reports)
- 0 = legitimately free item (include in profit reports)
- >0 = known cost (include in profit reports)

Run this script once to migrate the database.
"""

import sqlite3
import os

def migrate_database(db_path):
    """Migrate items table to allow NULL current_cost."""

    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🔄 Starting migration: Make current_cost nullable...")

    # Check current item count
    cursor.execute("SELECT COUNT(*) FROM items")
    item_count = cursor.fetchone()[0]
    print(f"  📊 Found {item_count} items in database")

    # Step 1: Create new table with nullable current_cost
    print("  1️⃣ Creating new table structure...")
    cursor.execute("""
        CREATE TABLE items_new (
            item_id INTEGER PRIMARY KEY,
            item_name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN (
                'coffeetea',
                'cold coffeetea',
                'beer',
                'hh beer',
                'wine',
                'hh wine',
                'other drinks',
                'baked goods',
                'food',
                'retail',
                'space rental'
            )),
            current_price DECIMAL(10,2) NOT NULL CHECK(current_price >= 0),
            current_cost DECIMAL(10,2),
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_resold BOOLEAN DEFAULT 0
        )
    """)

    # Step 2: Copy data with all costs set to NULL
    print("  2️⃣ Copying data (setting all costs to NULL)...")
    cursor.execute("""
        INSERT INTO items_new
        SELECT item_id, item_name, category, current_price, NULL, last_updated, is_resold
        FROM items
    """)

    # Step 3: Drop old table and rename
    print("  3️⃣ Swapping tables...")
    cursor.execute("DROP TABLE items")
    cursor.execute("ALTER TABLE items_new RENAME TO items")

    # Step 4: Recreate indexes
    print("  4️⃣ Recreating indexes...")
    cursor.execute("CREATE INDEX idx_items_category ON items(category)")
    cursor.execute("CREATE INDEX idx_items_name ON items(item_name)")

    conn.commit()

    # Verify migration
    cursor.execute("SELECT COUNT(*) FROM items WHERE current_cost IS NULL")
    null_count = cursor.fetchone()[0]
    print(f"\n✅ Migration complete!")
    print(f"  📊 {null_count} items now have NULL cost (ready for you to enter actual costs)")

    conn.close()
    return True


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, "cafe_reports.db")

    migrate_database(db_path)
