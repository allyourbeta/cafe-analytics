"""
Vivonet ingestion service — pure functions for API data → database.

No CLI, no argparse, no Flask imports. Called by:
    - import_vivonet_data.py (CLI)
    - backfill_vivonet.py (batch CLI)
    - admin.py (Flask endpoint)
"""

import logging
import os
import sqlite3
from datetime import datetime

try:
    import requests
except ImportError:
    requests = None
API_BASE = "https://api.vivonet.com/v1/companies/83832"
API_KEY = os.environ.get("VIVONET_API_KEY", "c32c16776f038bd6abf7e882463be83f")

STORE_IDS = {
    "cafe": "192328",
    "events": "196842",
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "cafe_reports.db")
LOG_PATH = os.path.join(SCRIPT_DIR, "vivonet_review.log")

def setup_logging():
    """Configure review logger for flagged items."""
    logger = logging.getLogger("vivonet_review")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
        handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        logger.addHandler(handler)
    return logger

def parse_vivonet_timestamp(timestamp_str):
    """
    Parse Vivonet timestamps exactly as provided by the API.

    We verified against live cafe orders on 2026-06-30 that Vivonet's
    closedTimestamp values are already in local cafe time. Do not convert
    them from UTC here, or the hourly reports shift 7 hours too early.
    Returns timezone-naive datetime for SQLite compatibility.
    """
    return datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")

# Backward-compatible name used by the existing tests/importer code.
# Despite the old name, this no longer converts time zones.
utc_to_pacific = parse_vivonet_timestamp

def fetch_orders(store_key, start_date, end_date):
    """
    Fetch orders from Vivonet API for a date range.

    Args:
        store_key: "cafe" or "events"
        start_date / end_date: "YYYYMMDD"

    Returns:
        list of order dicts, or empty list on error
    """
    if requests is None:
        print("  ❌ 'requests' package not installed")
        return []

    store_id = STORE_IDS[store_key]
    url = f"{API_BASE}/stores/{store_id}/data/orders"
    params = {"startTime": start_date, "endTime": end_date}
    headers = {"X-API-Key": API_KEY}

    print(f"  📡 GET {url}?startTime={start_date}&endTime={end_date}")

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=30)

        # Vivonet returns 204 No Content on valid days with no orders.
        # Treat that as a successful empty result so backfills can continue.
        if resp.status_code == 204:
            print("  ℹ️  No orders returned (204 No Content)")
            return []

        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"  ❌ API error: {e}")
        return []

    if not resp.text.strip():
        print("  ℹ️  No orders returned (empty response)")
        return []

    try:
        data = resp.json()
    except ValueError:
        snippet = resp.text[:300].replace("\n", " ")
        print(f"  ❌ Non-JSON response from API: {snippet}")
        return []

    if isinstance(data, dict) and "status" in data:
        print(f"  ❌ API returned error: {data.get('message', data)}")
        return []
    if not isinstance(data, list):
        print(f"  ❌ Unexpected response type: {type(data)}")
        return []

    return data

def build_product_map(cursor):
    """
    Build lookup: lowercase product name → (item_id, item_name, category).
    """
    cursor.execute("SELECT item_id, item_name, category FROM items")
    return {
        row[1].strip().lower(): (row[0], row[1], row[2])
        for row in cursor.fetchall()
    }
def resolve_product(product_name, product_id, name_map, review_logger,
                    date_str, cursor=None, price=0.0):
    """
    Resolve a Vivonet product to (item_id, item_name, category).

    Production behavior:
        Use the Vivonet productId directly as items.item_id. If the item is
        not already present, auto-create it with a safe default category.
        This keeps historical TouchNet rows intact while allowing new Vivonet
        reports to run without a TouchNet-to-Vivonet mapping table.

    Legacy/test behavior:
        If no cursor is supplied, fall back to the old name_map lookup.
    """
    clean_name = (product_name or "").strip()
    if not clean_name:
        clean_name = f"Vivonet product {product_id}"

    # New Vivonet-native path: productId is the item_id.
    if cursor is not None and product_id is not None:
        try:
            item_id = int(product_id)
        except (TypeError, ValueError):
            item_id = None

        if item_id is not None:
            cursor.execute(
                "SELECT item_id, item_name, category FROM items WHERE item_id = ?",
                (item_id,)
            )
            row = cursor.fetchone()
            if row:
                return (row[0], row[1], row[2])

            # Temporary valid category so existing reports can run. Product
            # categories can be refined later from Vivonet metadata/export.
            category = "food"
            try:
                current_price = max(float(price or 0), 0.0)
            except (TypeError, ValueError):
                current_price = 0.0

            cursor.execute("""
                INSERT INTO items (
                    item_id, item_name, category, current_price, current_cost
                ) VALUES (?, ?, ?, ?, ?)
            """, (item_id, clean_name, category, current_price, 0.0))

            review_logger.info(
                f"AUTO_CREATED_ITEM | productId={item_id} | "
                f"productName={clean_name} | category={category} | "
                f"price={current_price} | date={date_str}"
            )
            return (item_id, clean_name, category)

    # Fallback used by older unit tests and any caller not yet passing cursor.
    result = name_map.get(clean_name.lower())
    if result is None:
        review_logger.info(
            f"UNMAPPED | productId={product_id} | "
            f"productName={clean_name} | date={date_str}"
        )
    return result

def ensure_vivonet_columns(cursor):
    """Add Vivonet columns and safe idempotency indexes if missing."""
    cursor.execute("PRAGMA table_info(transactions)")
    existing = {row[1] for row in cursor.fetchall()}

    if "vivonet_order_id" not in existing:
        print("  🔧 Adding column: vivonet_order_id")
        cursor.execute(
            "ALTER TABLE transactions ADD COLUMN vivonet_order_id INTEGER"
        )
    if "vivonet_line_item_id" not in existing:
        print("  🔧 Adding column: vivonet_line_item_id")
        cursor.execute(
            "ALTER TABLE transactions ADD COLUMN vivonet_line_item_id INTEGER"
        )

    # The old TouchNet uniqueness rule was date + item + register. Vivonet can
    # legitimately have multiple rows with the same date/item/register, so
    # Vivonet rows use vivonet_line_item_id for dedupe instead.
    cursor.execute("DROP INDEX IF EXISTS idx_transactions_unique")
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_touchnet_unique
        ON transactions(transaction_date, item_id, register_num)
        WHERE vivonet_line_item_id IS NULL
    """)
    cursor.execute("DROP INDEX IF EXISTS idx_vivonet_line_item_id")
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vivonet_line_item_id
        ON transactions(vivonet_line_item_id)
        WHERE vivonet_line_item_id IS NOT NULL
    """)

def is_modifier(product_name):
    """'>' prefix = zero-price customization (skip). '...' = priced add-on (keep)."""
    return product_name.startswith(">")

def ingest_orders(orders, cursor, name_map, review_logger, store_key):
    """
    Process Vivonet orders into the transactions table.

    Returns dict: {inserted, skipped, flagged, unmapped}
    """
    stats = {"inserted": 0, "skipped": 0, "flagged": 0, "unmapped": 0}

    for order in orders:
        order_id = order.get("orderId")
        closed_ts_utc = order.get("closedTimestamp")
        position_id = order.get("positionId", 0)
        if not closed_ts_utc:
            continue

        local_dt = parse_vivonet_timestamp(closed_ts_utc)
        date_str = local_dt.strftime("%Y-%m-%d")

        for check in order.get("checks", []):
            for li in check.get("orderLineItems", []):
                _process_line_item(
                    li, order_id, local_dt, date_str, position_id,
                    cursor, name_map, review_logger, stats
                )

    return stats
def _process_line_item(li, order_id, local_dt, date_str, position_id,
                       cursor, name_map, review_logger, stats):
    """Process one line item + its priced modifiers."""
    product_name = li.get("productName", "")
    product_id = li.get("productId")
    line_item_id = li.get("orderLineItemId")
    quantity = li.get("quantity", 0)
    price = li.get("price", 0.0)

    if is_modifier(product_name):
        return

    if quantity < 0 or price < 0:
        review_logger.info(
            f"VOID | orderId={order_id} | lineItemId={line_item_id} | "
            f"product={product_name} | qty={quantity} | "
            f"price={price} | date={date_str}"
        )
        stats["flagged"] += 1
        return

    if quantity == 0:
        return

    resolved = resolve_product(
        product_name, product_id, name_map, review_logger, date_str,
        cursor=cursor, price=price
    )
    if resolved is None:
        stats["unmapped"] += 1
        return

    _insert_transaction(
        cursor, local_dt, resolved, quantity, price,
        position_id, order_id, line_item_id, stats
    )

    # Process priced "..." modifiers
    for mod in li.get("modifiers", []):
        mod_name = mod.get("productName", "")
        mod_price = mod.get("price", 0.0)
        if not mod_name.startswith("...") or mod_price <= 0:
            continue

        mod_resolved = resolve_product(
            mod_name, mod.get("productId"), name_map, review_logger, date_str,
            cursor=cursor, price=mod_price
        )
        if mod_resolved is None:
            stats["unmapped"] += 1
            continue

        _insert_transaction(
            cursor, local_dt, mod_resolved, mod.get("quantity", 0),
            mod_price, position_id, order_id, mod.get("orderLineItemId"),
            stats
        )
def _insert_transaction(cursor, local_dt, resolved, quantity, price,
                        position_id, order_id, line_item_id, stats):
    """Insert one transaction row with idempotency guard."""
    item_id, item_name, category = resolved
    total_amount = round(price * quantity, 2)

    try:
        cursor.execute("""
            INSERT INTO transactions (
                transaction_date, item_id, item_name, category,
                quantity, register_num, unit_price, total_amount,
                vivonet_order_id, vivonet_line_item_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            local_dt.strftime("%Y-%m-%d %H:%M:%S"),
            item_id, item_name, category,
            quantity, position_id, price, total_amount,
            order_id, line_item_id,
        ))
        stats["inserted"] += 1
    except sqlite3.IntegrityError:
        stats["skipped"] += 1

def import_vivonet(start_date, end_date, store_key="cafe", db_path=None):
    """Full import pipeline: fetch -> map -> insert -> stats."""
    if db_path is None:
        db_path = DB_PATH
    review_logger = setup_logging()

    print(f"\n🚀 Vivonet Import: {start_date} → {end_date} ({store_key})")

    orders = fetch_orders(store_key, start_date, end_date)
    if not orders:
        print("  ⚠️  No orders returned.")
        return {"inserted": 0, "skipped": 0, "flagged": 0,
                "unmapped": 0, "total_orders": 0}
    print(f"  ✅ {len(orders)} orders fetched")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    ensure_vivonet_columns(cursor)
    conn.commit()

    name_map = build_product_map(cursor)
    stats = ingest_orders(orders, cursor, name_map, review_logger, store_key)
    conn.commit()
    conn.close()

    stats["total_orders"] = len(orders)
    print(f"  📊 +{stats['inserted']} inserted, {stats['skipped']} dupes, "
          f"{stats['flagged']} voids, {stats['unmapped']} unmapped")
    if stats["flagged"] or stats["unmapped"]:
        print(f"  ⚠️  See {LOG_PATH}")

    # Clear Flask cache if running
    try:
        import requests as req
        req.post("http://localhost:5500/api/admin/clear-cache", timeout=2)
    except Exception:
        pass

    return stats
