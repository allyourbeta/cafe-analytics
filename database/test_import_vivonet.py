#!/usr/bin/env python3
"""
Tests for the Vivonet import pipeline.

Covers:
    - Vivonet timestamp parsing (API values are already local cafe time)
    - Modifier filtering (> prefix skipped, ... prefix kept if priced)
    - Void/negative quantity flagging
    - Idempotent re-ingestion (vivonet_line_item_id dedup)
    - Product name matching (exact, case-insensitive, unmapped)
    - Schema migration (new columns added safely)
    - Backfill chunking logic
    - End-to-end order ingestion

Run:
    cd database/
    python -m pytest test_import_vivonet.py -v
    # or just:
    python test_import_vivonet.py
"""

import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Ensure we can import from this directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vivonet_service import (
    utc_to_pacific,
    is_modifier,
    build_product_map,
    resolve_product,
    ensure_vivonet_columns,
    ingest_orders,
    import_vivonet,
    fetch_orders,
    setup_logging,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_test_db(path):
    """Create a minimal test database with schema + seed items."""
    conn = sqlite3.connect(path)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE items (
            item_id INTEGER PRIMARY KEY,
            item_name TEXT NOT NULL,
            category TEXT NOT NULL,
            current_price DECIMAL(10,2) NOT NULL,
            current_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_resold BOOLEAN DEFAULT 0
        )
    """)

    c.execute("""
        CREATE TABLE transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_date TIMESTAMP NOT NULL,
            item_id INTEGER NOT NULL,
            item_name TEXT NOT NULL,
            category TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            register_num INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (item_id) REFERENCES items(item_id)
        )
    """)

    c.execute("""
        CREATE UNIQUE INDEX idx_transactions_unique
        ON transactions(transaction_date, item_id, register_num)
    """)

    # Seed items matching Vivonet product names
    seed_items = [
        (101, "Brewed Coffee", "coffeetea", 3.50, 0.40),
        (102, "Lrg Latte", "coffeetea", 6.25, 0.80),
        (103, "Raspberry Beignets", "baked goods", 3.00, 0.50),
        (104, "Mocha (Hot)", "coffeetea", 6.25, 0.90),
        (105, "Oat Milk", "coffeetea", 0.50, 0.15),
        (106, "...Chive Cream Cheese", "food", 1.75, 0.30),
        (107, "Plain Bagel", "baked goods", 4.00, 0.60),
    ]
    c.executemany(
        "INSERT INTO items VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)",
        seed_items,
    )

    conn.commit()
    return conn


def make_order(order_id, closed_ts, position_id, line_items):
    """Build a minimal Vivonet order dict for testing."""
    return {
        "orderId": order_id,
        "closedTimestamp": closed_ts,
        "createdTimestamp": closed_ts,
        "positionId": position_id,
        "checks": [{
            "charges": [],
            "discounts": [],
            "payments": [],
            "orderLineItems": line_items,
            "checkId": order_id,
            "guestNumber": 1,
        }],
    }


def make_line_item(line_id, product_id, product_name, qty, price,
                   modifiers=None):
    """Build a minimal Vivonet line item dict."""
    return {
        "orderLineItemId": line_id,
        "productId": product_id,
        "productName": product_name,
        "quantity": qty,
        "price": price,
        "modifiers": modifiers or [],
        "discounts": [],
        "onHold": False,
        "restricted": False,
        "ignorePrice": False,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFetchOrders(unittest.TestCase):

    @patch("vivonet_service.requests.get")
    def test_no_content_response_returns_empty_list(self, mock_get):
        """Vivonet returns 204 No Content for valid days with no orders."""
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        mock_resp.text = ""
        mock_get.return_value = mock_resp

        orders = fetch_orders("cafe", "20260712", "20260713")

        self.assertEqual(orders, [])
        mock_resp.raise_for_status.assert_not_called()

    @patch("vivonet_service.requests.get")
    def test_empty_response_returns_empty_list(self, mock_get):
        """Blank API body should be treated as no orders, not a crash."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = ""
        mock_get.return_value = mock_resp

        orders = fetch_orders("cafe", "20260712", "20260713")

        self.assertEqual(orders, [])
        mock_resp.raise_for_status.assert_called_once()


class TestVivonetTimestampParsing(unittest.TestCase):

    def test_basic_timestamp_preserved(self):
        """Vivonet timestamps are already local cafe time; preserve them."""
        result = utc_to_pacific("2026-01-15 20:00:00")
        self.assertEqual(result, datetime(2026, 1, 15, 20, 0, 0))

    def test_summer_timestamp_preserved(self):
        """Do not subtract PDT offset from summer Vivonet timestamps."""
        result = utc_to_pacific("2026-07-15 20:00:00")
        self.assertEqual(result, datetime(2026, 7, 15, 20, 0, 0))

    def test_no_date_rollback_across_midnight(self):
        """Early local times remain on the same local date."""
        result = utc_to_pacific("2026-03-01 05:00:00")
        self.assertEqual(result, datetime(2026, 3, 1, 5, 0, 0))


class TestModifierFiltering(unittest.TestCase):

    def test_angle_bracket_modifier_skipped(self):
        self.assertTrue(is_modifier(">Whole Milk"))
        self.assertTrue(is_modifier(">No Room"))
        self.assertTrue(is_modifier(">Cup Needs a Sleeve"))

    def test_ellipsis_modifier_not_skipped(self):
        """'...' prefix items are priced add-ons, NOT skipped."""
        self.assertFalse(is_modifier("...Chive Cream Cheese"))
        self.assertFalse(is_modifier("...Plain Cream Cheese"))

    def test_regular_product_not_skipped(self):
        self.assertFalse(is_modifier("Brewed Coffee"))
        self.assertFalse(is_modifier("Raspberry Beignets"))


class TestProductMapping(unittest.TestCase):

    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        self.conn = create_test_db(self.db_path)
        self.cursor = self.conn.cursor()
        self.name_map = build_product_map(self.cursor)
        self.logger = setup_logging()

    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_exact_match(self):
        result = resolve_product(
            "Brewed Coffee", 17188487, self.name_map, self.logger, "2026-01-01"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result[0], 101)  # item_id
        self.assertEqual(result[1], "Brewed Coffee")

    def test_case_insensitive_match(self):
        result = resolve_product(
            "brewed coffee", 17188487, self.name_map, self.logger, "2026-01-01"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result[0], 101)

    def test_unmapped_returns_none(self):
        result = resolve_product(
            "Unicorn Frappuccino", 99999, self.name_map, self.logger, "2026-01-01"
        )
        self.assertIsNone(result)

    def test_ellipsis_modifier_maps(self):
        result = resolve_product(
            "...Chive Cream Cheese", 17190365, self.name_map,
            self.logger, "2026-01-01"
        )
        self.assertIsNotNone(result)
        self.assertEqual(result[0], 106)


class TestSchemaMigration(unittest.TestCase):

    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        self.conn = create_test_db(self.db_path)
        self.cursor = self.conn.cursor()

    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_adds_new_columns(self):
        ensure_vivonet_columns(self.cursor)
        self.conn.commit()

        self.cursor.execute("PRAGMA table_info(transactions)")
        col_names = {row[1] for row in self.cursor.fetchall()}
        self.assertIn("vivonet_order_id", col_names)
        self.assertIn("vivonet_line_item_id", col_names)

    def test_idempotent_migration(self):
        """Running migration twice doesn't crash."""
        ensure_vivonet_columns(self.cursor)
        self.conn.commit()
        ensure_vivonet_columns(self.cursor)  # Should not raise
        self.conn.commit()


class TestIngestOrders(unittest.TestCase):

    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        self.conn = create_test_db(self.db_path)
        self.cursor = self.conn.cursor()
        ensure_vivonet_columns(self.cursor)
        self.conn.commit()
        self.name_map = build_product_map(self.cursor)
        self.logger = setup_logging()

    def tearDown(self):
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def test_basic_insert(self):
        """A normal order with one line item gets inserted."""
        orders = [make_order(
            1001, "2026-02-17 18:00:00", 7898454,
            [make_line_item(50001, 17188487, "Brewed Coffee", 1, 3.50)]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        self.assertEqual(stats["inserted"], 1)
        self.cursor.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(self.cursor.fetchone()[0], 1)

        # Verify the row
        self.cursor.execute(
            "SELECT item_name, quantity, unit_price, vivonet_line_item_id "
            "FROM transactions WHERE vivonet_line_item_id = 50001"
        )
        row = self.cursor.fetchone()
        self.assertEqual(row[0], "Brewed Coffee")
        self.assertEqual(row[1], 1)
        self.assertAlmostEqual(row[2], 3.50)
        self.assertEqual(row[3], 50001)

    def test_idempotent_reinsert(self):
        """Same order ingested twice → second time all skipped."""
        orders = [make_order(
            1001, "2026-02-17 18:00:00", 7898454,
            [make_line_item(50001, 17188487, "Brewed Coffee", 1, 3.50)]
        )]

        stats1 = ingest_orders(orders, self.cursor, self.name_map,
                               self.logger, "cafe")
        self.conn.commit()
        self.assertEqual(stats1["inserted"], 1)

        stats2 = ingest_orders(orders, self.cursor, self.name_map,
                               self.logger, "cafe")
        self.conn.commit()
        self.assertEqual(stats2["inserted"], 0)
        self.assertEqual(stats2["skipped"], 1)

        # Still only 1 row in DB
        self.cursor.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(self.cursor.fetchone()[0], 1)

    def test_void_flagged_not_inserted(self):
        """Negative-quantity line items are flagged, not inserted."""
        orders = [make_order(
            1002, "2026-02-19 15:12:31", 7897622,
            [
                make_line_item(70939, 17188440, "Lrg Latte", -1, 6.25),
                make_line_item(70940, 17188513, "Oat Milk", -1, 0.50),
            ]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        self.assertEqual(stats["flagged"], 2)
        self.assertEqual(stats["inserted"], 0)

        self.cursor.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(self.cursor.fetchone()[0], 0)

    def test_modifier_skipped(self):
        """'>' modifiers are silently skipped."""
        orders = [make_order(
            1003, "2026-02-17 18:05:00", 7898454,
            [make_line_item(
                50010, 17188504, "Mocha (Hot)", 1, 6.25,
                modifiers=[
                    make_line_item(50011, 17206930, ">Whole Milk", 1, 0),
                    make_line_item(50012, 17199943, ">Add Whip", 1, 0),
                ]
            )]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        # Only the parent item inserted, not the modifiers
        self.assertEqual(stats["inserted"], 1)
        self.cursor.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(self.cursor.fetchone()[0], 1)

    def test_priced_ellipsis_modifier_inserted(self):
        """'...' modifiers with a price are inserted as separate items."""
        orders = [make_order(
            1004, "2026-02-17 18:10:00", 7898454,
            [make_line_item(
                50020, 17188565, "Plain Bagel", 1, 4.00,
                modifiers=[
                    make_line_item(
                        50021, 17190365, "...Chive Cream Cheese", 1, 1.75
                    ),
                ]
            )]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        # Bagel + cream cheese = 2 inserts
        self.assertEqual(stats["inserted"], 2)
        self.cursor.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(self.cursor.fetchone()[0], 2)

    def test_unknown_vivonet_product_auto_created(self):
        """Unknown Vivonet products are auto-created using productId."""
        orders = [make_order(
            1005, "2026-02-17 18:15:00", 7898454,
            [make_line_item(50030, 99999, "Mystery Item", 1, 10.00)]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        self.assertEqual(stats["unmapped"], 0)
        self.assertEqual(stats["inserted"], 1)

        self.cursor.execute(
            "SELECT item_id, item_name, category, current_price "
            "FROM items WHERE item_id = 99999"
        )
        row = self.cursor.fetchone()
        self.assertEqual(row[0], 99999)
        self.assertEqual(row[1], "Mystery Item")
        self.assertEqual(row[2], "food")
        self.assertAlmostEqual(row[3], 10.00)

    def test_multi_item_order(self):
        """Order with multiple line items all get inserted."""
        orders = [make_order(
            1006, "2026-02-17 18:20:00", 7898454,
            [
                make_line_item(50040, 17188487, "Brewed Coffee", 1, 3.50),
                make_line_item(50041, 17326716, "Raspberry Beignets", 2, 3.00),
            ]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.conn.commit()

        self.assertEqual(stats["inserted"], 2)

        # Verify quantity and total for beignets
        self.cursor.execute(
            "SELECT quantity, total_amount FROM transactions "
            "WHERE vivonet_line_item_id = 50041"
        )
        row = self.cursor.fetchone()
        self.assertEqual(row[0], 2)
        self.assertAlmostEqual(row[1], 6.00)

    def test_zero_quantity_skipped(self):
        """Zero-quantity items are silently skipped."""
        orders = [make_order(
            1007, "2026-02-17 18:25:00", 7898454,
            [make_line_item(50050, 17188487, "Brewed Coffee", 0, 3.50)]
        )]
        stats = ingest_orders(orders, self.cursor, self.name_map,
                              self.logger, "cafe")
        self.assertEqual(stats["inserted"], 0)
        self.assertEqual(stats["flagged"], 0)

    def test_vivonet_timestamp_preserved(self):
        """Stored transaction_date should preserve Vivonet local timestamp."""
        orders = [make_order(
            1008, "2026-02-17 20:00:00", 7898454,
            [make_line_item(50060, 17188487, "Brewed Coffee", 1, 3.50)]
        )]
        ingest_orders(orders, self.cursor, self.name_map, self.logger, "cafe")
        self.conn.commit()

        self.cursor.execute(
            "SELECT transaction_date FROM transactions "
            "WHERE vivonet_line_item_id = 50060"
        )
        ts_str = self.cursor.fetchone()[0]
        ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S")
        self.assertEqual(ts.hour, 20)


class TestImportVivonetEndToEnd(unittest.TestCase):
    """Test the full import_vivonet function with mocked API."""

    def setUp(self):
        self.db_fd, self.db_path = tempfile.mkstemp(suffix=".db")
        self.conn = create_test_db(self.db_path)
        self.conn.close()

    def tearDown(self):
        os.close(self.db_fd)
        os.unlink(self.db_path)

    @patch("vivonet_service.fetch_orders")
    def test_full_pipeline(self, mock_fetch):
        """End-to-end: mock API → DB insertion → stats returned."""
        mock_fetch.return_value = [
            make_order(
                2001, "2026-02-17 18:00:00", 7898454,
                [
                    make_line_item(60001, 17188487, "Brewed Coffee", 1, 3.50),
                    make_line_item(60002, 17326716, "Raspberry Beignets", 1, 3.00),
                ]
            ),
            make_order(
                2002, "2026-02-17 18:05:00", 7898454,
                [make_line_item(60003, 17188440, "Lrg Latte", -1, 6.25)]
            ),
        ]

        stats = import_vivonet("20260217", "20260218", "cafe", self.db_path)

        self.assertEqual(stats["total_orders"], 2)
        self.assertEqual(stats["inserted"], 2)
        self.assertEqual(stats["flagged"], 1)  # the void

        # Verify DB
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM transactions")
        self.assertEqual(c.fetchone()[0], 2)
        conn.close()


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
