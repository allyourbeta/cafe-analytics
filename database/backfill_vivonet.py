#!/usr/bin/env python3
"""
One-time backfill of historical Vivonet data.

Loops through a date range one day at a time. The Vivonet orders endpoint
rejects ranges greater than 24 hours, so daily chunks are the safe default.
Calls the same ingestion logic as the daily import script.

Usage:
    python backfill_vivonet.py --start 20260201 --end 20260320
    python backfill_vivonet.py --start 20260201 --end 20260320 --store events
    python backfill_vivonet.py --start 20260201 --end 20260320 --db cafe_reports_vivonet_dev.db
"""

import argparse
import sys
import time
from datetime import datetime, timedelta

from vivonet_service import import_vivonet


def backfill(start_str, end_str, store_key="cafe", chunk_days=1, db_path=None):
    """
    Backfill Vivonet data in chunks.

    Args:
        start_str: "YYYYMMDD" — first day to import (inclusive)
        end_str: "YYYYMMDD" — last day to import (exclusive)
        store_key: "cafe" or "events"
        chunk_days: number of days per API call (default 1; max 1 for orders endpoint)
        db_path: database path override
    """
    start_dt = datetime.strptime(start_str, "%Y%m%d")
    end_dt = datetime.strptime(end_str, "%Y%m%d")

    if start_dt >= end_dt:
        print("❌ Start date must be before end date.")
        sys.exit(1)

    if chunk_days != 1:
        print("❌ Vivonet orders endpoint only allows 24-hour ranges; use --chunk-days 1.")
        sys.exit(1)

    total_days = (end_dt - start_dt).days
    print(f"\n{'='*60}")
    print(f"🔄 Vivonet Backfill: {start_str} → {end_str}")
    print(f"   Store: {store_key}")
    print(f"   Total days: {total_days}")
    print(f"   Chunk size: {chunk_days} days")
    print(f"{'='*60}")

    totals = {"inserted": 0, "skipped": 0, "flagged": 0,
              "unmapped": 0, "total_orders": 0, "chunks": 0}

    cursor_dt = start_dt
    while cursor_dt < end_dt:
        chunk_end = min(cursor_dt + timedelta(days=chunk_days), end_dt)

        chunk_start_str = cursor_dt.strftime("%Y%m%d")
        chunk_end_str = chunk_end.strftime("%Y%m%d")

        print(f"\n--- Chunk {totals['chunks'] + 1}: "
              f"{chunk_start_str} → {chunk_end_str} ---")

        stats = import_vivonet(
            chunk_start_str, chunk_end_str, store_key, db_path
        )

        for key in ["inserted", "skipped", "flagged", "unmapped", "total_orders"]:
            totals[key] += stats.get(key, 0)
        totals["chunks"] += 1

        cursor_dt = chunk_end

        # Polite pause between API calls
        if cursor_dt < end_dt:
            time.sleep(1)

    # Grand summary
    print(f"\n{'='*60}")
    print(f"📊 Backfill Complete!")
    print(f"   Chunks processed: {totals['chunks']}")
    print(f"   Total orders:     {totals['total_orders']}")
    print(f"   Inserted:         {totals['inserted']}")
    print(f"   Skipped (dupes):  {totals['skipped']}")
    print(f"   Flagged (voids):  {totals['flagged']}")
    print(f"   Unmapped items:   {totals['unmapped']}")
    print(f"{'='*60}\n")

    return totals


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill historical Vivonet data one day at a time"
    )
    parser.add_argument(
        "--start", required=True,
        help="Start date YYYYMMDD (inclusive)"
    )
    parser.add_argument(
        "--end", required=True,
        help="End date YYYYMMDD (exclusive)"
    )
    parser.add_argument(
        "--store", default="cafe", choices=["cafe", "events"],
        help="Store to import (default: cafe)"
    )
    parser.add_argument(
        "--chunk-days", type=int, default=1,
        help="Days per API chunk (default: 1; Vivonet orders max is 1)"
    )
    parser.add_argument(
        "--db", default=None,
        help="Database path override"
    )
    args = parser.parse_args()

    backfill(args.start, args.end, args.store, args.chunk_days, args.db)
