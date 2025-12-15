#!/usr/bin/env python3
"""Audit a tab-separated list of (item_id, sales category, Item name) against cafe_reports.db.

Input format: TSV with header row, e.g.
    item_id\tsales category\tItem name

Rules:
- DB is source-of-truth.
- Treat sheet category as meaningful only when it's HOT or COLD.
  - HOT should correspond to DB category coffeetea and DB name should not look iced/cold.
  - COLD should correspond to DB category 'cold coffeetea' and DB name should not look hot.
- Name mismatch uses conservative fuzzy check: flags only when similarity is obviously low.

Output:
- Writes suspect_rows.tsv in the same folder.

Usage:
    python audit_list_vs_db.py list_to_check_for_discrepencies.txt
"""

from __future__ import annotations

import csv
import os
import re
import sqlite3
import sys
from typing import Dict, List, Set, Tuple


DB_FILENAME = "cafe_reports.db"


# Looser audit thresholds (raise to catch more potential issues)
NAME_SIMILARITY_THRESHOLD = 0.35

# Even looser threshold for "possible issues" output
POSSIBLE_ISSUES_SIMILARITY_THRESHOLD = 0.55

# Semantic classes (to catch obvious conceptual mismatches while ignoring spelling/name variations)
SEM_CLASS_TEA = "tea"
SEM_CLASS_COFFEE = "coffee"

TEA_TOKENS = {
    "tea",
    "chai",
    "matcha",
    "london",  # london fog
    "earl",
}

COFFEE_TOKENS = {
    "coffee",
    "espresso",
    "latte",
    "mocha",
    "cappuccino",
    "macchiato",
    "americano",
    "brew",
    "brewed",
}


def _norm(s: str) -> str:
    s = (s or "").lower().strip()
    # common misspellings / abbreviations
    s = s.replace("cappucino", "cappuccino")
    s = s.replace("peppermnt", "peppermint")
    s = s.replace("lrg", "large")
    s = s.replace("lg", "large")
    # remove parentheticals and punctuation
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _tokens(s: str) -> Set[str]:
    stop = {
        "the",
        "a",
        "an",
        "of",
        "to",
        "and",
        "with",
        "for",
        "in",
        "on",
        "medium",
        "small",
        "sm",
        "side",
        "batch",
    }
    toks = [t for t in _norm(s).split(" ") if t]
    return {t for t in toks if t not in stop}


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _contains_any(s: str, needles: List[str]) -> bool:
    n = _norm(s)
    return any(needle in n for needle in needles)


def _has_word(s: str, word: str) -> bool:
    return word in _tokens(s)


def semantic_class(name: str) -> str | None:
    """Return semantic class for a name.

    Priority: tea-related tokens win over coffee tokens to avoid false positives like
    "Chai Tea Latte" being categorized as coffee due to "latte".
    """

    toks = _tokens(name)
    if toks & TEA_TOKENS:
        return SEM_CLASS_TEA
    if toks & COFFEE_TOKENS:
        return SEM_CLASS_COFFEE
    return None


def audit_one(sheet_cat: str, sheet_name: str, db_cat: str, db_name: str) -> Tuple[List[str], float]:
    flags: List[str] = []

    cat = (sheet_cat or "").strip().upper()

    sheet_n = _norm(sheet_name)
    db_n = _norm(db_name)

    if cat == "HOT":
        if db_cat != "coffeetea":
            flags.append("HOT_sheet_but_db_category_not_coffeetea")
        if _contains_any(db_name, ["iced", "ice", "cold"]):
            flags.append("HOT_sheet_but_db_name_indicates_iced_or_cold")
    elif cat == "COLD":
        if db_cat != "cold coffeetea":
            flags.append("COLD_sheet_but_db_category_not_cold_coffeetea")
        if _contains_any(db_name, ["hot"]):
            flags.append("COLD_sheet_but_db_name_indicates_hot")

    # Looser: also check name-based hot/iced contradictions regardless of sheet category
    sheet_says_hot = "hot" in sheet_n
    sheet_says_iced = any(x in sheet_n for x in ["iced", "ice", "cold"])
    db_says_hot = "hot" in db_n
    db_says_iced = any(x in db_n for x in ["iced", "ice", "cold"])

    if sheet_says_hot and db_says_iced:
        flags.append("NAME_sheet_hot_but_db_iced")
    if sheet_says_iced and db_says_hot:
        flags.append("NAME_sheet_iced_but_db_hot")

    # Looser name similarity
    score = _jaccard(_tokens(sheet_name), _tokens(db_name))
    if score < NAME_SIMILARITY_THRESHOLD:
        flags.append("LOW_name_similarity")

    # Size mismatch checks (looser)
    sheet_large = _has_word(sheet_name, "large")
    db_large = _has_word(db_name, "large")
    if sheet_large and not db_large:
        flags.append("SIZE_sheet_large_but_db_not_large")
    if db_large and not sheet_large:
        flags.append("SIZE_db_large_but_sheet_not_large")

    # High-signal contradictions
    if "matcha" in sheet_n and "mocha" in db_n:
        flags.append("CONTRADICTION_matcha_vs_mocha")
    if "mocha" in sheet_n and "matcha" in db_n:
        flags.append("CONTRADICTION_mocha_vs_matcha")

    return flags, score


def possible_issues(sheet_cat: str, sheet_name: str, db_cat: str, db_name: str) -> Tuple[List[str], float]:
    flags: List[str] = []

    sheet_n = _norm(sheet_name)
    db_n = _norm(db_name)

    score = _jaccard(_tokens(sheet_name), _tokens(db_name))
    if score < POSSIBLE_ISSUES_SIMILARITY_THRESHOLD:
        flags.append("NAME_similarity_below_possible_threshold")

    sheet_large = _has_word(sheet_name, "large")
    db_large = _has_word(db_name, "large")
    if sheet_large and not db_large:
        flags.append("SIZE_sheet_large_but_db_not_large")
    if db_large and not sheet_large:
        flags.append("SIZE_db_large_but_sheet_not_large")

    sheet_medium = _has_word(sheet_name, "medium")
    db_medium = _has_word(db_name, "medium")
    if sheet_medium and not db_medium:
        flags.append("SIZE_sheet_medium_but_db_not_medium")
    if db_medium and not sheet_medium:
        flags.append("SIZE_db_medium_but_sheet_not_medium")

    sheet_says_hot = "hot" in sheet_n
    sheet_says_iced = any(x in sheet_n for x in ["iced", "ice", "cold"])
    db_says_hot = "hot" in db_n
    db_says_iced = any(x in db_n for x in ["iced", "ice", "cold"])

    if sheet_says_hot and db_says_iced:
        flags.append("NAME_sheet_hot_but_db_iced")
    if sheet_says_iced and db_says_hot:
        flags.append("NAME_sheet_iced_but_db_hot")

    cat = (sheet_cat or "").strip().upper()
    if cat == "HOT" and db_says_iced:
        flags.append("HOT_sheet_but_db_name_indicates_iced_or_cold")
    if cat == "COLD" and db_says_hot:
        flags.append("COLD_sheet_but_db_name_indicates_hot")

    if "matcha" in sheet_n and "mocha" in db_n:
        flags.append("CONTRADICTION_matcha_vs_mocha")
    if "mocha" in sheet_n and "matcha" in db_n:
        flags.append("CONTRADICTION_mocha_vs_matcha")

    return flags, score


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python audit_list_vs_db.py <input_tsv>")
        return 1

    input_path = sys.argv[1]

    if not os.path.exists(input_path):
        print(f"❌ Input file not found: {input_path}")
        return 1

    script_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(script_dir, DB_FILENAME)

    if not os.path.exists(db_path):
        print(f"❌ Database not found: {db_path}")
        return 1

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    out_path = os.path.join(script_dir, "suspect_rows.tsv")
    possible_out_path = os.path.join(script_dir, "possible_issues.tsv")
    semantic_out_path = os.path.join(script_dir, "semantic_conflicts.tsv")

    total = 0
    suspect = 0
    possible_count = 0
    semantic_conflict_count = 0

    # Track all sheet names per item_id to detect semantic conflicts across aliases
    sheet_names_by_item_id: Dict[int, List[str]] = {}

    with open(input_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        required = {"item_id", "sales category", "Item name"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            print(f"❌ Unexpected header. Found: {reader.fieldnames}")
            print("Expected TSV header: item_id<TAB>sales category<TAB>Item name")
            return 1

        with open(out_path, "w", encoding="utf-8", newline="") as out, open(
            possible_out_path, "w", encoding="utf-8", newline=""
        ) as possible_out:
            writer = csv.writer(out, delimiter="\t")
            possible_writer = csv.writer(possible_out, delimiter="\t")
            header = [
                "item_id",
                "sheet_category",
                "sheet_name",
                "db_category",
                "db_name",
                "db_price",
                "similarity",
                "flags",
            ]
            writer.writerow(header)
            possible_writer.writerow(header)

            for row in reader:
                total += 1
                item_id_raw = (row.get("item_id") or "").strip()
                sheet_cat = (row.get("sales category") or "").strip()
                sheet_name = (row.get("Item name") or "").strip()

                try:
                    item_id = int(item_id_raw)
                except ValueError:
                    continue

                sheet_names_by_item_id.setdefault(item_id, []).append(sheet_name)

                cursor.execute(
                    "SELECT item_name, category, current_price FROM items WHERE item_id = ?",
                    (item_id,),
                )
                db_row = cursor.fetchone()

                if not db_row:
                    suspect += 1
                    writer.writerow(
                        [
                            item_id,
                            sheet_cat,
                            sheet_name,
                            "",
                            "",
                            "",
                            "0.00",
                            "ITEM_ID_NOT_FOUND_IN_DB",
                        ]
                    )
                    continue

                db_name, db_cat, db_price = db_row
                flags, score = audit_one(sheet_cat, sheet_name, db_cat, db_name)

                possible_flags, possible_score = possible_issues(sheet_cat, sheet_name, db_cat, db_name)

                if flags:
                    suspect += 1
                    price_str = f"${db_price:.2f}" if db_price is not None else ""
                    writer.writerow(
                        [
                            item_id,
                            sheet_cat,
                            sheet_name,
                            db_cat,
                            db_name,
                            price_str,
                            f"{score:.2f}",
                            ",".join(flags),
                        ]
                    )

                if possible_flags:
                    possible_count += 1
                    price_str = f"${db_price:.2f}" if db_price is not None else ""
                    possible_writer.writerow(
                        [
                            item_id,
                            sheet_cat,
                            sheet_name,
                            db_cat,
                            db_name,
                            price_str,
                            f"{possible_score:.2f}",
                            ",".join(possible_flags),
                        ]
                    )

    conn.close()

    # Second pass: detect tea-vs-coffee semantic conflicts across aliases per item_id
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    with open(semantic_out_path, "w", encoding="utf-8", newline="") as semantic_out:
        writer = csv.writer(semantic_out, delimiter="\t")
        writer.writerow(
            [
                "item_id",
                "db_category",
                "db_name",
                "db_price",
                "db_semantic_class",
                "sheet_semantic_classes",
                "sheet_names",
                "flags",
            ]
        )

        for item_id, sheet_names in sorted(sheet_names_by_item_id.items()):
            cursor.execute(
                "SELECT item_name, category, current_price FROM items WHERE item_id = ?",
                (item_id,),
            )
            db_row = cursor.fetchone()
            if not db_row:
                continue

            db_name, db_cat, db_price = db_row
            db_cls = semantic_class(db_name)

            sheet_classes = [semantic_class(n) for n in sheet_names]
            sheet_classes_set = {c for c in sheet_classes if c is not None}

            flags: List[str] = []

            # Conflict within sheet aliases
            if SEM_CLASS_TEA in sheet_classes_set and SEM_CLASS_COFFEE in sheet_classes_set:
                flags.append("SHEET_ALIASES_CONFLICT_TEA_VS_COFFEE")

            # Conflict vs DB classification
            if db_cls in {SEM_CLASS_TEA, SEM_CLASS_COFFEE} and len(sheet_classes_set) == 1:
                only_sheet_cls = next(iter(sheet_classes_set))
                if only_sheet_cls != db_cls:
                    flags.append("SHEET_VS_DB_CONFLICT_TEA_VS_COFFEE")

            if not flags:
                continue

            semantic_conflict_count += 1
            price_str = f"${db_price:.2f}" if db_price is not None else ""
            writer.writerow(
                [
                    item_id,
                    db_cat,
                    db_name,
                    price_str,
                    db_cls or "",
                    ",".join(sorted(sheet_classes_set)),
                    " | ".join([n for n in sheet_names if n]),
                    ",".join(flags),
                ]
            )

    conn.close()

    print("✅ Audit complete")
    print(f"  Input rows read: {total}")
    print(f"  Suspect rows:   {suspect}")
    print(f"  Possible issues:{possible_count}")
    print(f"  Sem. conflicts: {semantic_conflict_count}")
    print(f"  Output:         {out_path}")
    print(f"  Output:         {possible_out_path}")
    print(f"  Output:         {semantic_out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
