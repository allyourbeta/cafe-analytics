#!/usr/bin/env python3
"""
Import item costs from CSV and write both:
- item_cost_history for date-aware historical profit reports
- items.current_cost as the current/latest snapshot value

Existing cost convention is preserved:
- blank/unparseable cost = unknown, skipped
- 0 cost = legitimately free item, imported if explicitly entered
- positive cost = known cost

Expected CSV columns, preferred:
    item_id,item_name,cost,effective_date,source,notes

Backwards-compatible CSV format is also accepted:
    item_id,item_name,cost

If effective_date is not present in the CSV, pass --effective-date YYYY-MM-DD.
If neither is provided, today's date is used and printed.

Usage:
    python database/import_item_costs.py item_costs.csv --effective-date 2026-07-01
    python database/import_item_costs.py item_costs.csv --db database/cafe_reports_vivonet_dev.db
"""

from __future__ import annotations

import argparse
import csv
from datetime import date
import os
from pathlib import Path
import re
import sqlite3
from typing import Any


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


def parse_cost(cost_str: Any) -> float | None:
    """Parse cost string like '$2.50' or '2.50'. Blank/invalid means unknown."""
    if cost_str is None:
        return None
    raw = str(cost_str).strip()
    if not raw:
        return None
    cleaned = re.sub(r"[$,\s]", "", raw)
    try:
        cost = float(cleaned)
    except ValueError:
        return None
    if cost < 0:
        return None
    return cost


def get_value(row: dict[str, str], names: list[str], fallback_index: int | None = None) -> str:
    normalized = {k.strip().lower(): v for k, v in row.items() if k is not None}
    for name in names:
        if name in normalized:
            return normalized[name]
    if fallback_index is not None:
        values = list(row.values())
        if fallback_index < len(values):
            return values[fallback_index]
    return ""


def ensure_history_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute(CREATE_TABLE_SQL)
    cursor.execute(CREATE_INDEX_SQL)
    cursor.execute(CREATE_UNIQUE_INDEX_SQL)


def upsert_cost_history(
    cursor: sqlite3.Cursor,
    item_id: int,
    cost: float,
    effective_date: str,
    source: str,
    notes: str,
) -> None:
    cursor.execute(
        """
        UPDATE item_cost_history
        SET cost = ?, source = ?, notes = ?, created_at = CURRENT_TIMESTAMP
        WHERE item_id = ? AND effective_date = ?
        """,
        (cost, source, notes, item_id, effective_date),
    )
    if cursor.rowcount == 0:
        cursor.execute(
            """
            INSERT INTO item_cost_history
                (item_id, cost, effective_date, source, notes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (item_id, cost, effective_date, source, notes),
        )


def refresh_current_cost(cursor: sqlite3.Cursor, item_id: int) -> None:
    cursor.execute(
        """
        SELECT cost
        FROM item_cost_history
        WHERE item_id = ?
        ORDER BY effective_date DESC, id DESC
        LIMIT 1
        """,
        (item_id,),
    )
    row = cursor.fetchone()
    if row is not None:
        cursor.execute(
            "UPDATE items SET current_cost = ?, last_updated = CURRENT_TIMESTAMP WHERE item_id = ?",
            (row[0], item_id),
        )


def import_costs(db_path: Path, csv_path: Path, default_effective_date: str | None = None) -> bool:
    if not db_path.exists():
        print(f"Database not found: {db_path}")
        return False

    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}")
        return False

    fallback_date = default_effective_date or date.today().isoformat()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    ensure_history_table(cursor)

    print(f"Database: {db_path}")
    print(f"Reading costs from: {csv_path}")
    if not default_effective_date:
        print(f"No --effective-date supplied. Rows without an effective_date column use today: {fallback_date}")

    imported = 0
    skipped_unknown = 0
    skipped_bad_id = 0
    not_found = 0

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        print(f"Header: {reader.fieldnames}")

        for row in reader:
            raw_item_id = get_value(row, ["item_id", "product_id", "vivonet_product_id"], 0)
            try:
                item_id = int(str(raw_item_id).strip())
            except ValueError:
                skipped_bad_id += 1
                continue

            item_name = get_value(row, ["item_name", "product_name", "name"], 1)
            cost = parse_cost(get_value(row, ["cost", "current_cost", "item_cost"], 2))
            if cost is None:
                skipped_unknown += 1
                continue

            row_effective_date = get_value(row, ["effective_date", "date", "cost_date"])
            effective_date = row_effective_date.strip() or fallback_date
            source = get_value(row, ["source"]) or "import_item_costs"
            notes = get_value(row, ["notes", "note"])

            cursor.execute("SELECT item_id FROM items WHERE item_id = ?", (item_id,))
            if not cursor.fetchone():
                print(f"Item {item_id} ({item_name}) not found in database")
                not_found += 1
                continue

            upsert_cost_history(cursor, item_id, cost, effective_date, source, notes)
            refresh_current_cost(cursor, item_id)
            imported += 1
            print(f"Imported {item_id}: {item_name} | ${cost:.2f} | effective {effective_date}")

    conn.commit()
    conn.close()

    print("\nSummary:")
    print(f"  Imported/updated history rows: {imported}")
    print(f"  Skipped unknown/blank/bad cost: {skipped_unknown}")
    print(f"  Skipped bad item_id: {skipped_bad_id}")
    if not_found:
        print(f"  Not found: {not_found}")

    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Import dated item costs")
    parser.add_argument("csv_file", help="CSV file containing item costs")
    parser.add_argument("--db", default=None, help="Path to SQLite database")
    parser.add_argument("--effective-date", default=None, help="Default effective date for rows that do not include one")
    args = parser.parse_args()

    db_path = Path(args.db).expanduser().resolve() if args.db else default_db_path()
    csv_path = Path(args.csv_file).expanduser().resolve()
    return 0 if import_costs(db_path, csv_path, args.effective_date) else 1


if __name__ == "__main__":
    raise SystemExit(main())
