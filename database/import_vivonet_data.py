#!/usr/bin/env python3
"""
CLI for importing Vivonet/Infor Atrium POS data into cafe database.

Thin wrapper around vivonet_service.py — all logic lives there.

Usage:
    python import_vivonet_data.py                          # Yesterday
    python import_vivonet_data.py --start 20260301 --end 20260302
    python import_vivonet_data.py --start 20260301 --end 20260302 --store events

Void handling (confirmed from live API data):
    Voids appear as negative-quantity line items in a separate order.
    These are logged to vivonet_review.log and skipped (not inserted).

Modifier handling:
    - ">" prefix modifiers (e.g., ">Whole Milk") -> skipped (zero-price)
    - "..." prefix modifiers (e.g., "...Chive Cream Cheese") -> inserted if priced
"""

import argparse
import sys
from datetime import datetime, timedelta

from vivonet_service import import_vivonet


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import Vivonet POS data into cafe database"
    )
    parser.add_argument(
        "--start", type=str, default=None,
        help="Start date YYYYMMDD (default: yesterday)"
    )
    parser.add_argument(
        "--end", type=str, default=None,
        help="End date YYYYMMDD (default: start + 1 day)"
    )
    parser.add_argument(
        "--store", type=str, default="cafe",
        choices=["cafe", "events"],
        help="Store to import (default: cafe)"
    )
    parser.add_argument(
        "--db", type=str, default=None,
        help="Database path override"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    if args.start is None:
        yesterday = datetime.now() - timedelta(days=1)
        args.start = yesterday.strftime("%Y%m%d")
    if args.end is None:
        end_dt = datetime.strptime(args.start, "%Y%m%d") + timedelta(days=1)
        args.end = end_dt.strftime("%Y%m%d")

    import_vivonet(args.start, args.end, args.store, args.db)
