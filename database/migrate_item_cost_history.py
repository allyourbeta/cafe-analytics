#!/usr/bin/env python3
"""
Create and seed date-aware item cost history.

This migration preserves the existing convention:
- NULL cost = unknown cost
- 0 cost = legitimately free item
- positive cost = known cost

By default, seed rows use the earliest transaction date in the database so
historical reports before 2026 do not lose every cost row. You can override the
seed date when you have a more precise source date.

Usage:
    python database/migrate_item_cost_history.py
    python database/migrate_item_cost_history.py --db database/cafe_reports_vivonet_dev.db
    python database/migrate_item_cost_history.py --effective-date 2024-07-01
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS item_cost_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    cost DECIMAL(10,2) NOT NULL CHECK(cost >= 0),
    effective_date DATE NOT NULL,
    source TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
)
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_item_cost_history_item_date
ON item_cost_history (item_id, effective_date)
"""

CREATE_UNIQUE_INDEX_SQL = """
CREATE UNIQUE INDEX IF NOT EXISTS idx_item_cost_history_unique_item_date
ON item_cost_history (item_id, effective_date)
"""


def default_db_path() -> Path:
    script_dir = Path(__file__).resolve().parent
    env_path = os.environ.get("CAFE_DB_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()
    return script_dir / "cafe_reports.db"


def get_earliest_transaction_date(cursor: sqlite3.Cursor) -> str:
    cursor.execute("SELECT DATE(MIN(transaction_date)) FROM transactions")
    value = cursor.fetchone()[0]
    return value or "2026-01-01"


def migrate(db_path: Path, effective_date: str | None = None) -> bool:
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return False

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")

    print(f"Database: {db_path}")
    print("Creating item_cost_history table and indexes...")
    cursor.execute(CREATE_TABLE_SQL)
    cursor.execute(CREATE_INDEX_SQL)
    cursor.execute(CREATE_UNIQUE_INDEX_SQL)

    seed_date = effective_date or get_earliest_transaction_date(cursor)
    print(f"Seed effective_date: {seed_date}")

    cursor.execute("""
        INSERT OR IGNORE INTO item_cost_history
            (item_id, cost, effective_date, source, notes)
        SELECT
            item_id,
            current_cost,
            ?,
            'seed_from_current_cost',
            'Initial seed from items.current_cost; review/replace with source cost data when available'
        FROM items
        WHERE current_cost IS NOT NULL
    """, (seed_date,))
    seeded = cursor.rowcount

    cursor.execute("SELECT COUNT(*) FROM item_cost_history")
    total_history_rows = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM items WHERE current_cost IS NULL")
    unknown_current_cost_items = cursor.fetchone()[0]

    conn.commit()
    conn.close()

    print("Done.")
    print(f"  Seeded new rows: {seeded}")
    print(f"  Total item_cost_history rows: {total_history_rows}")
    print(f"  Items with NULL/unknown current_cost: {unknown_current_cost_items}")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Create and seed item_cost_history")
    parser.add_argument("--db", default=None, help="Path to SQLite database")
    parser.add_argument(
        "--effective-date",
        default=None,
        help="Seed date for current_cost rows. Defaults to earliest transaction date.",
    )
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve() if args.db else default_db_path()
    return 0 if migrate(db_path, args.effective_date) else 1


if __name__ == "__main__":
    raise SystemExit(main())
