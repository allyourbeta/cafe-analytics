#!/usr/bin/env python3
"""
Generate Vivonet category suggestions using old TouchNet item categories.

Read-only script. It does not modify either database.

Run from project root:
    python scripts/generate_vivonet_category_suggestions.py

Output:
    data_audits/vivonet_category_suggestions.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class TouchNetItem:
    item_id: int
    item_name: str
    category: str
    norm: str


@dataclass(frozen=True)
class VivonetProduct:
    product_id: int
    item_name: str
    current_category: str
    current_price: float
    current_cost: float
    rows: int
    units_sold: float
    revenue: float
    first_seen: str
    last_seen: str
    norm: str


def normalize_name(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"^[>.\s$]+", "", s)
    s = s.replace("&", " and ")
    s = re.sub(r"[()_\-/]+", " ", s)
    s = re.sub(r"[^a-z0-9\s]+", " ", s)

    replacements = {
        "cappucino": "cappuccino",
        "chx": "chicken",
        "vscb": "vanilla sweet cream cold brew",
        "nugo": "nu go",
    }
    words = [replacements.get(w, w) for w in s.split()]
    words = [w for w in words if w not in {"the", "a", "an"}]
    return " ".join(words)


def load_touchnet_items(db_path: Path) -> list[TouchNetItem]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT item_id, item_name, category
            FROM items
            WHERE category IS NOT NULL
              AND TRIM(category) != ''
            ORDER BY item_name
            """
        ).fetchall()
    finally:
        conn.close()

    return [
        TouchNetItem(int(item_id), str(name), str(category), normalize_name(str(name)))
        for item_id, name, category in rows
    ]


def load_vivonet_products(db_path: Path) -> list[VivonetProduct]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            """
            SELECT
                i.item_id,
                i.item_name,
                i.category,
                ROUND(i.current_price, 2),
                ROUND(i.current_cost, 2),
                COUNT(t.transaction_id),
                SUM(t.quantity),
                ROUND(SUM(t.total_amount), 2),
                MIN(DATE(t.transaction_date)),
                MAX(DATE(t.transaction_date))
            FROM items i
            JOIN transactions t ON t.item_id = i.item_id
            WHERE t.vivonet_line_item_id IS NOT NULL
            GROUP BY i.item_id, i.item_name, i.category, i.current_price, i.current_cost
            ORDER BY LOWER(i.item_name)
            """
        ).fetchall()
    finally:
        conn.close()

    return [
        VivonetProduct(
            int(product_id),
            str(name),
            str(category or ""),
            float(price or 0),
            float(cost or 0),
            int(rows or 0),
            float(units or 0),
            float(revenue or 0),
            str(first_seen or ""),
            str(last_seen or ""),
            normalize_name(str(name)),
        )
        for product_id, name, category, price, cost, rows, units, revenue, first_seen, last_seen in rows
    ]


def best_fuzzy_match(name: str, items: Iterable[TouchNetItem]) -> tuple[TouchNetItem | None, float]:
    best_item = None
    best_score = 0.0
    for item in items:
        if not item.norm:
            continue
        score = SequenceMatcher(None, name, item.norm).ratio()
        if name and item.norm and (name in item.norm or item.norm in name):
            score = min(score + 0.08, 1.0)
        if score > best_score:
            best_item = item
            best_score = score
    return best_item, best_score


def keyword_suggestion(name: str) -> tuple[str, str, str]:
    n = name.lower()

    rules = [
        ("hh beer", "keyword: happy hour beer", "high", ["hh beer", "happy hour beer"]),
        ("hh wine", "keyword: happy hour wine", "high", ["hh wine", "happy hour wine"]),
        ("wine", "keyword: wine", "high", ["wine", "chardonnay", "cabernet", "pinot", "merlot", "rose", "rosé"]),
        ("beer", "keyword: beer", "high", ["beer", "pilsner", "ipa", "lager", "ale", "pitcher"]),
        ("cold coffeetea", "keyword: cold coffee/tea", "high", ["cold brew", "iced", "refresher", "cold foam", "frapp"]),
        ("coffeetea", "keyword: coffee/tea", "medium", ["latte", "americano", "cappuccino", "cappucino", "macchiato", "mocha", "espresso", "coffee", "chai", "tea", "hot chocolate", "extra shot", "flavor syrup", "almond milk", "oat milk", "non fat milk", "soy milk"]),
        ("baked goods", "keyword: baked goods", "high", ["croissant", "bagel", "muffin", "cookie", "scone", "beignet", "pastry", "cream cheese", "pretzel", "loaf"]),
        ("food", "keyword: food", "high", ["sandwich", "burrito", "meal deal", "salad", "pesto", "turkey", "bacon", "sausage", "egg", "eggything", "chicken", "chx", "breakfast"]),
        ("other drinks", "keyword: other drinks", "high", ["lemonade", "arnold palmer", "yerba", "mate", "water", "soda", "juice", "sparkling", "nuun", "energy"]),
        ("retail", "keyword: retail", "medium", ["bar", "protein", "retail", "merch", "mug", "bottle", "chips", "gum"]),
        ("space rental", "keyword: space rental", "high", ["space rental", "room rental", "rental"]),
    ]

    for category, method, confidence, terms in rules:
        if any(term in n for term in terms):
            return category, method, confidence
    return "", "", ""


def build_suggestion(
    product: VivonetProduct,
    exact: dict[str, list[TouchNetItem]],
    touchnet_items: list[TouchNetItem],
) -> dict[str, object]:
    exact_candidates = exact.get(product.norm, [])
    keyword_category, keyword_method, keyword_confidence = keyword_suggestion(product.item_name)
    fuzzy_item, fuzzy_score = best_fuzzy_match(product.norm, touchnet_items)
    fuzzy_score = round(float(fuzzy_score), 3)

    if exact_candidates:
        item = exact_candidates[0]
        return {
            "suggested_category": item.category,
            "suggestion_method": "exact TouchNet name match",
            "suggestion_confidence": "high",
            "matched_touchnet_item_id": item.item_id,
            "matched_touchnet_item": item.item_name,
            "matched_touchnet_category": item.category,
            "match_score": 1.0,
            "review_status": "needs quick review",
            "notes": "",
        }

    # Strong keyword rules help avoid fuzzy errors like "Latte (Iced)" -> hot latte.
    if keyword_category and keyword_confidence == "high":
        return {
            "suggested_category": keyword_category,
            "suggestion_method": keyword_method,
            "suggestion_confidence": "high",
            "matched_touchnet_item_id": fuzzy_item.item_id if fuzzy_item else "",
            "matched_touchnet_item": fuzzy_item.item_name if fuzzy_item else "",
            "matched_touchnet_category": fuzzy_item.category if fuzzy_item else "",
            "match_score": fuzzy_score,
            "review_status": "needs quick review",
            "notes": "keyword suggestion; compare TouchNet match if present",
        }

    if fuzzy_item and fuzzy_score >= 0.88:
        return {
            "suggested_category": fuzzy_item.category,
            "suggestion_method": "fuzzy TouchNet name match",
            "suggestion_confidence": "high",
            "matched_touchnet_item_id": fuzzy_item.item_id,
            "matched_touchnet_item": fuzzy_item.item_name,
            "matched_touchnet_category": fuzzy_item.category,
            "match_score": fuzzy_score,
            "review_status": "needs quick review",
            "notes": "",
        }

    if keyword_category:
        return {
            "suggested_category": keyword_category,
            "suggestion_method": keyword_method,
            "suggestion_confidence": keyword_confidence,
            "matched_touchnet_item_id": fuzzy_item.item_id if fuzzy_item else "",
            "matched_touchnet_item": fuzzy_item.item_name if fuzzy_item else "",
            "matched_touchnet_category": fuzzy_item.category if fuzzy_item else "",
            "match_score": fuzzy_score,
            "review_status": "review",
            "notes": "medium-confidence keyword suggestion",
        }

    if fuzzy_item and fuzzy_score >= 0.72:
        return {
            "suggested_category": fuzzy_item.category,
            "suggestion_method": "low-confidence fuzzy TouchNet match",
            "suggestion_confidence": "low",
            "matched_touchnet_item_id": fuzzy_item.item_id,
            "matched_touchnet_item": fuzzy_item.item_name,
            "matched_touchnet_category": fuzzy_item.category,
            "match_score": fuzzy_score,
            "review_status": "review",
            "notes": "low-confidence suggestion; verify manually",
        }

    return {
        "suggested_category": "",
        "suggestion_method": "",
        "suggestion_confidence": "",
        "matched_touchnet_item_id": fuzzy_item.item_id if fuzzy_item else "",
        "matched_touchnet_item": fuzzy_item.item_name if fuzzy_item else "",
        "matched_touchnet_category": fuzzy_item.category if fuzzy_item else "",
        "match_score": fuzzy_score,
        "review_status": "manual review",
        "notes": "no reliable suggestion",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Vivonet category suggestions.")
    parser.add_argument("--touchnet-db", default="database/cafe_reports.db")
    parser.add_argument("--vivonet-db", default="database/cafe_reports_vivonet_dev.db")
    parser.add_argument("--output", default="data_audits/vivonet_category_suggestions.csv")
    args = parser.parse_args()

    touchnet_db = Path(args.touchnet_db)
    vivonet_db = Path(args.vivonet_db)
    output = Path(args.output)

    if not touchnet_db.exists():
        raise SystemExit(f"TouchNet DB not found: {touchnet_db}")
    if not vivonet_db.exists():
        raise SystemExit(f"Vivonet DB not found: {vivonet_db}")

    touchnet_items = load_touchnet_items(touchnet_db)
    vivonet_products = load_vivonet_products(vivonet_db)

    exact: dict[str, list[TouchNetItem]] = {}
    for item in touchnet_items:
        exact.setdefault(item.norm, []).append(item)

    output.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "vivonet_product_id",
        "vivonet_item_name",
        "current_category",
        "suggested_category",
        "suggestion_method",
        "suggestion_confidence",
        "matched_touchnet_item_id",
        "matched_touchnet_item",
        "matched_touchnet_category",
        "match_score",
        "final_category",
        "review_status",
        "notes",
        "current_price",
        "current_cost",
        "rows",
        "units_sold",
        "revenue",
        "first_seen",
        "last_seen",
    ]

    counts: dict[str, int] = {}

    with output.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for product in sorted(vivonet_products, key=lambda p: p.item_name.lower()):
            suggestion = build_suggestion(product, exact, touchnet_items)
            cat = str(suggestion["suggested_category"] or "")
            counts[cat or "NO SUGGESTION"] = counts.get(cat or "NO SUGGESTION", 0) + 1

            writer.writerow({
                "vivonet_product_id": product.product_id,
                "vivonet_item_name": product.item_name,
                "current_category": product.current_category,
                "suggested_category": cat,
                "suggestion_method": suggestion["suggestion_method"],
                "suggestion_confidence": suggestion["suggestion_confidence"],
                "matched_touchnet_item_id": suggestion["matched_touchnet_item_id"],
                "matched_touchnet_item": suggestion["matched_touchnet_item"],
                "matched_touchnet_category": suggestion["matched_touchnet_category"],
                "match_score": suggestion["match_score"],
                "final_category": "",
                "review_status": suggestion["review_status"],
                "notes": suggestion["notes"],
                "current_price": product.current_price,
                "current_cost": product.current_cost,
                "rows": product.rows,
                "units_sold": product.units_sold,
                "revenue": product.revenue,
                "first_seen": product.first_seen,
                "last_seen": product.last_seen,
            })

    print(f"Wrote {len(vivonet_products)} Vivonet product suggestions to {output}")
    print()
    print("Suggested category counts:")
    for category, count in sorted(counts.items()):
        print(f"  {category}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
