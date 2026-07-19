#!/usr/bin/env python3
"""
Apply reviewed Vivonet categories directly to the dev SQLite database.

This avoids the Google Sheets / CSV export round trip.

Source of truth:
- AI-generated category review for the obvious rows
- Ashish's confirmed overrides for the remaining questioned rows

Default DB:
    database/cafe_reports_vivonet_dev.db

Dry run:
    python scripts/apply_reviewed_vivonet_categories.py

Apply:
    python scripts/apply_reviewed_vivonet_categories.py --apply
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path


CATEGORY_BY_PRODUCT_ID_RAW = {
    "17188351": "beer",
    "17188352": "beer",
    "17188353": "beer",
    "17188354": "beer",
    "17188355": "beer",
    "17188357": "beer",
    "17188358": "beer",
    "17188360": "beer",
    "17188376": "beer",
    "17188377": "beer",
    "17188378": "beer",
    "17188380": "beer",
    "17188381": "beer",
    "17188383": "beer",
    "17188403": "hh beer",
    "17188404": "beer",
    "17188405": "beer",
    "17188406": "beer",
    "17188407": "hh beer",
    "17188409": "beer",
    "17188410": "beer",
    "17188418": "beer",
    "17188419": "beer",
    "17188420": "hh beer",
    "17188421": "beer",
    "17188424": "beer",
    "17188425": "beer",
    "17188426": "wine",
    "17188429": "other drinks",
    "17188436": "coffeetea",
    "17188438": "coffeetea",
    "17188440": "coffeetea",
    "17188441": "coffeetea",
    "17188442": "coffeetea",
    "17188444": "coffeetea",
    "17188453": "coffeetea",
    "17188454": "coffeetea",
    "17188455": "coffeetea",
    "17188456": "coffeetea",
    "17188458": "coffeetea",
    "17188459": "coffeetea",
    "17188460": "cold coffeetea",
    "17188461": "cold coffeetea",
    "17188462": "cold coffeetea",
    "17188464": "cold coffeetea",
    "17188466": "cold coffeetea",
    "17188467": "cold coffeetea",
    "17188468": "cold coffeetea",
    "17188469": "cold coffeetea",
    "17188471": "cold coffeetea",
    "17188473": "cold coffeetea",
    "17188478": "coffeetea",
    "17188480": "cold coffeetea",
    "17188482": "cold coffeetea",
    "17188483": "other drinks",
    "17188485": "coffeetea",
    "17188487": "coffeetea",
    "17188488": "coffeetea",
    "17188490": "coffeetea",
    "17188491": "other drinks",
    "17188492": "coffeetea",
    "17188493": "coffeetea",
    "17188495": "coffeetea",
    "17188496": "coffeetea",
    "17188500": "coffeetea",
    "17188501": "coffeetea",
    "17188502": "coffeetea",
    "17188503": "coffeetea",
    "17188504": "coffeetea",
    "17188505": "coffeetea",
    "17188506": "cold coffeetea",
    "17188507": "cold coffeetea",
    "17188508": "coffeetea",
    "17188509": "cold coffeetea",
    "17188510": "cold coffeetea",
    "17188511": "coffeetea",
    "17188512": "cold coffeetea",
    "17188513": "coffeetea",
    "17188515": "cold coffeetea",
    "17188516": "hh beer",
    "17188518": "cold coffeetea",
    "17188534": "cold coffeetea",
    "17188536": "cold coffeetea",
    "17188537": "cold coffeetea",
    "17188538": "cold coffeetea",
    "17188539": "cold coffeetea",
    "17188540": "cold coffeetea",
    "17188541": "cold coffeetea",
    "17188563": "food",
    "17188564": "baked goods",
    "17188565": "baked goods",
    "17188566": "baked goods",
    "17188567": "baked goods",
    "17188568": "baked goods",
    "17188569": "baked goods",
    "17188570": "baked goods",
    "17188571": "baked goods",
    "17188572": "baked goods",
    "17188578": "baked goods",
    "17188610": "baked goods",
    "17188685": "food",
    "17188686": "retail",
    "17188687": "food",
    "17188688": "food",
    "17188689": "food",
    "17188690": "food",
    "17188691": "food",
    "17188693": "cold coffeetea",
    "17188695": "coffeetea",
    "17188696": "space rental",
    "17188697": "retail",
    "17188698": "retail",
    "17188699": "other drinks",
    "17188700": "retail",
    "17188701": "retail",
    "17188702": "retail",
    "17188703": "space rental",
    "17188704": "other drinks",
    "17188706": "retail",
    "17188707": "other drinks",
    "17188708": "retail",
    "17188709": "retail",
    "17188710": "baked goods",
    "17188713": "baked goods",
    "17188714": "baked goods",
    "17188720": "baked goods",
    "17190364": "retail",
    "17190365": "baked goods",
    "17190441": "coffeetea",
    "17190442": "coffeetea",
    "17190443": "coffeetea",
    "17190444": "cold coffeetea",
    "17190445": "cold coffeetea",
    "17190449": "food",
    "17190920": "baked goods",
    "17200051": "baked goods",
    "17206819": "retail",
    "17207938": "coffeetea",
    "17211033": "wine",
    "17211045": "hh wine",
    "17211046": "hh wine",
    "17211047": "hh beer",
    "17215414": "cold coffeetea",
    "17223434": "cold coffeetea",
    "17223435": "cold coffeetea",
    "17223436": "coffeetea",
    "17223716": "coffeetea",
    "17224086": "coffeetea",
    "17224332": "food",
    "17225305": "baked goods",
    "17244023": "coffeetea",
    "17272889": "cold coffeetea",
    "17272890": "cold coffeetea",
    "17273442": "cold coffeetea",
    "17273443": "cold coffeetea",
    "17293343": "baked goods",
    "17299404": "hh beer",
    "17326716": "baked goods",
    "17402983": "other drinks",
    "17402984": "hh beer",
    "17403694": "cold coffeetea",
    "17403736": "retail",
    "17403776": "coffeetea",
    "17403777": "coffeetea",
    "17403778": "coffeetea",
    "17403779": "coffeetea",
    "17403780": "coffeetea",
    "17403781": "coffeetea",
    "17403782": "coffeetea",
    "17403783": "coffeetea",
    "17403784": "coffeetea",
    "17403785": "cold coffeetea",
    "17403787": "cold coffeetea",
    "17403788": "cold coffeetea",
    "17403789": "cold coffeetea",
    "17403790": "cold coffeetea",
    "17403791": "coffeetea",
    "17403792": "coffeetea",
    "17403793": "coffeetea",
    "17403794": "coffeetea",
    "17403795": "cold coffeetea",
    "17403834": "coffeetea",
    "17403888": "cold coffeetea",
    "17403889": "coffeetea",
    "17403890": "coffeetea",
    "17403891": "cold coffeetea",
    "17404060": "coffeetea",
    "17410603": "hh beer",
    "17411780": "food",
    "17411798": "beer",
    "17411799": "beer",
    "17411800": "beer",
    "17411801": "beer",
    "17411802": "beer",
    "17411803": "beer",
    "17411804": "beer",
    "17411805": "beer",
    "17412066": "beer",
    "17412067": "beer",
    "17434266": "food",
    "17490267": "retail",
    "17490269": "wine",
    "17518693": "baked goods",
    "17533044": "other drinks",
    "17573329": "food",
    "17573330": "food",
    "17573331": "food"
}

PRODUCT_NAME_BY_ID_RAW = {
    "17188351": "IPA Pitcher",
    "17188352": "Cider Draft",
    "17188353": "Oski Beer",
    "17188354": "IPA Draft",
    "17188355": "Small Beer Can (12oz)",
    "17188357": "IPA Can",
    "17188358": "Cider Pitcher",
    "17188360": "Large Beer Can (16oz)",
    "17188376": "Paulaner Pitcher",
    "17188377": "Paulaner Draft",
    "17188378": "Cider Can",
    "17188380": "Vato Loco Draft",
    "17188381": "Pilsner Pitcher",
    "17188383": "Jiant Hard Tea Can",
    "17188403": "HH Sincere Cider Draft",
    "17188404": "HH Oski Can",
    "17188405": "HH Mexican Lager Pitcher",
    "17188406": "HH Mexican Lager Draft",
    "17188407": "HH Sincere Cider Pitcher",
    "17188409": "HH Paulaner Pitcher",
    "17188410": "HH Paulaner Draft",
    "17188418": "HH Paulaner Can",
    "17188419": "HH IPA Pitcher",
    "17188420": "HH Cider Can",
    "17188421": "HH IPA Draft",
    "17188424": "HH Vato Loco",
    "17188425": "HH Vato Loco Pitcher",
    "17188426": "Pinot Noir",
    "17188429": "Kombucha Can",
    "17188436": "Lrg Hot Chocolate",
    "17188438": "Lrg Brewed Coffee",
    "17188440": "Lrg Latte",
    "17188441": "Lrg Americano",
    "17188442": "Lrg Mocha",
    "17188444": "Lrg Chocolate Truffle Mocha",
    "17188453": "Lrg London Fog",
    "17188454": "Lrg Chai Tea Latte",
    "17188455": "Lrg Cappuccino",
    "17188456": "Lrg Hot Caramel Macchiato",
    "17188458": "Lrg Matcha Latte",
    "17188459": "Lrg Hot Tea",
    "17188460": "Lrg Strawberry Acai Refresher",
    "17188461": "Lrg Iced Americano",
    "17188462": "Lrg Iced Tea",
    "17188464": "Lrg Iced Matcha",
    "17188466": "Lrg Iced Mocha",
    "17188467": "Lrg Iced Chai Tea Latte",
    "17188468": "Lrg Iced CTM",
    "17188469": "Lrg Iced Caramel Macchiato",
    "17188471": "Lrg Iced Strawberry Matcha",
    "17188473": "Lrg VSCCB",
    "17188478": "Cafe Au Lait",
    "17188480": "Lrg Cold Brew",
    "17188482": "Lrg Iced Peppermint Mocha",
    "17188483": "Lrg Arnold Palmer",
    "17188485": "Espresso",
    "17188487": "Brewed Coffee",
    "17188488": "Caramel Macchiato Hot",
    "17188490": "Chai Tea Latte (Hot)",
    "17188491": "Hot Water Cup",
    "17188492": "Americano",
    "17188493": "London Fog",
    "17188495": "Hot Tea",
    "17188496": "Hot Chocolate",
    "17188500": "Cappuccino",
    "17188501": "Latte (Hot)",
    "17188502": "Chocolate Truffle Mocha (Hot)",
    "17188503": "Flat White",
    "17188504": "Mocha (Hot)",
    "17188505": "Matcha Latte (Hot)",
    "17188506": "Iced Tea",
    "17188507": "Cold Brew",
    "17188508": "Strawberry Matcha",
    "17188509": "Mocha (Iced)",
    "17188510": "Latte (Iced)",
    "17188511": "Almond Milk",
    "17188512": "Caramel Macchiato (Iced)",
    "17188513": "Oat Milk",
    "17188515": "Matcha Latte (Iced)",
    "17188516": "HH Wed Drink (Iced)",
    "17188518": "Arnold Palmer",
    "17188534": "Peppermnt Mocha (Iced)",
    "17188536": "CTM (Iced)",
    "17188537": "Lemonade",
    "17188538": "Chai Tea Latte (Iced)",
    "17188539": "Americano (Iced)",
    "17188540": "VSCCB",
    "17188541": "Strawberry Acai Refresher",
    "17188563": "Monday Meal Deal",
    "17188564": "Cinnamon Raisin Bagel",
    "17188565": "Plain Bagel",
    "17188566": "Everything Bagel",
    "17188567": "Sesame Bagel",
    "17188568": "Day-Old Pastries",
    "17188569": "Sea Salt Pretzel",
    "17188570": "Banana Walnut Loaf",
    "17188571": "ChocolateChunkCookie",
    "17188572": "Almond Croissant",
    "17188578": "Butter Croissant",
    "17188610": "Chocolate Croissant",
    "17188685": "Bacon Breakfast Burrito",
    "17188686": "Plain Cream Cheese",
    "17188687": "Chile Verde Burrito",
    "17188688": "Eggything Sandwich",
    "17188689": "Plant Based Burrito",
    "17188690": "Turkey Pesto",
    "17188691": "Chx Sausage Sandwich",
    "17188693": "Cold Foam",
    "17188695": "Flavor",
    "17188696": "Patio Reservation",
    "17188697": "Edmonds T-Shirt",
    "17188698": "NuGo Bar",
    "17188699": "Proud Source Water",
    "17188700": "RX Protein Bar",
    "17188701": "Banana",
    "17188702": "Kind Protein Bar",
    "17188703": "Cafe Reservation",
    "17188704": "Yerba Mate",
    "17188706": "Edmonds Sticker",
    "17188707": "Soda Can",
    "17188708": "Chobani Yogurt",
    "17188709": "Chips",
    "17188710": "Red Velvet Muffin",
    "17188713": "StrawberriesNCream Donut",
    "17188714": "Ube Donut",
    "17188720": "Chocolate Donut",
    "17190364": "...Plain Cream Cheese",
    "17190365": "...Chive Cream Cheese",
    "17190441": "...$Almond Milk",
    "17190442": "...Extra Shot",
    "17190443": "...Flavor Syrup",
    "17190444": "...$Cold Foam",
    "17190445": "...$Lemonade",
    "17190449": "...Before Today 2005",
    "17190920": "Ham & Chz Croissant",
    "17200051": "Rainbow Donut",
    "17206819": "Edmonds Tote Bag",
    "17207938": "...$Extra Sweet",
    "17211033": "Sauvignon Blanc",
    "17211045": "HH Red Wine",
    "17211046": "HH White Wine",
    "17211047": "HH Kombucha Can",
    "17215414": "Lrg Lemonade",
    "17223434": "Vanilla Latte (iced)",
    "17223435": "Lrg Vanilla Latte (iced)",
    "17223436": "Vanilla Latte (hot)",
    "17223716": "...2 Extra Shots",
    "17224086": "Lrg Vanilla Latte",
    "17224332": "Chorizo Burrito",
    "17225305": "Brownie Muffin",
    "17244023": "Coffee Carrier",
    "17272889": "Lrg Iced Cookie Cold Brew",
    "17272890": "Cookie Cold Brew",
    "17273442": "Pink Drink",
    "17273443": "Lrg Pink Drink",
    "17293343": "Black Sesame Donut",
    "17299404": "HH Wed Drink.",
    "17326716": "Raspberry Beignets",
    "17402983": "Margarita",
    "17402984": "HH margarita",
    "17403694": "Caramel Mocha Iced",
    "17403736": "Test Item",
    "17403776": "Espresso.",
    "17403777": "Americano.",
    "17403778": "Cappucino.",
    "17403779": "Latte.",
    "17403780": "Vanilla Latte.",
    "17403781": "Caramel Macchiato.",
    "17403782": "Mocha.",
    "17403783": "Hot Chocolate.",
    "17403784": "Brewed Coffee.",
    "17403785": "Vanilla Sweet Cream Cold Brew",
    "17403787": "Strawberry Acai Refresher.",
    "17403788": "Organic Iced Tea.",
    "17403789": "Arnold Palmer.",
    "17403790": "Lemonade.",
    "17403791": "Hot Tea.",
    "17403792": "London Fog.",
    "17403793": "Chai Tea Latte.",
    "17403794": "Matcha tea Latte.",
    "17403795": "Cold Brew.",
    "17403834": "Caramel Mocha.",
    "17403888": "Pink Drink.",
    "17403889": "Cafe Au Lait.",
    "17403890": "Cortado",
    "17403891": "Cookie Cold Brew.",
    "17404060": "Strawberry Matcha.",
    "17410603": "HH Wed Drink.",
    "17411780": "4/20 Special.",
    "17411798": "GS Dry Apple Cider draft",
    "17411799": "GS Hibiscus Cider draft",
    "17411800": "GS Pineapple Cider draft",
    "17411801": "Trumer Pilsner draft",
    "17411802": "GS Dry Apple Cider pitcher",
    "17411803": "GS Hibiscus Cider pitcher",
    "17411804": "GS Pineapple Cider pitcher",
    "17411805": "Trumer Pilsner pitcher",
    "17412066": "HH Taco Truck Lager Pitcher",
    "17412067": "HH Taco Truck Lager Draft",
    "17434266": "Nacho Bar",
    "17490267": "Grad Bear",
    "17490269": "Mimosa",
    "17518693": "Guava Cheesecake Donut",
    "17533044": "Crystal Geyser Water",
    "17573329": "Cheese Pizza Slice",
    "17573330": "Pepp Pizza Slice",
    "17573331": "GF Wild Mushroom Pizza"
}

CATEGORY_BY_PRODUCT_ID = {int(product_id): category for product_id, category in CATEGORY_BY_PRODUCT_ID_RAW.items()}
PRODUCT_NAME_BY_ID = {int(product_id): name for product_id, name in PRODUCT_NAME_BY_ID_RAW.items()}


VALID_CATEGORIES = {
    "baked goods",
    "beer",
    "coffeetea",
    "cold coffeetea",
    "food",
    "hh beer",
    "hh wine",
    "other drinks",
    "retail",
    "space rental",
    "wine",
}


def category_counts(conn: sqlite3.Connection) -> list[tuple[str, int]]:
    return conn.execute(
        """
        SELECT i.category, COUNT(DISTINCT i.item_id) AS product_count
        FROM items i
        JOIN transactions t ON t.item_id = i.item_id
        WHERE t.vivonet_line_item_id IS NOT NULL
        GROUP BY i.category
        ORDER BY i.category
        """
    ).fetchall()


def print_counts(title: str, counts: list[tuple[str, int]]) -> None:
    print()
    print(title)
    for category, count in counts:
        print(f"  {category}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply reviewed Vivonet categories. v2 fixes integer product IDs.")
    parser.add_argument(
        "--db",
        default="database/cafe_reports_vivonet_dev.db",
        help="SQLite database to update.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write changes. Omit for dry run.",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    invalid = sorted(set(CATEGORY_BY_PRODUCT_ID.values()) - VALID_CATEGORIES)
    if invalid:
        raise SystemExit(f"Invalid categories in mapping: {invalid}")

    print(f"DB: {db_path}")
    print(f"Reviewed category mappings: {len(CATEGORY_BY_PRODUCT_ID)}")

    print()
    print("Reviewed category totals to apply:")
    for category, count in sorted(Counter(CATEGORY_BY_PRODUCT_ID.values()).items()):
        print(f"  {category}: {count}")

    conn = sqlite3.connect(db_path)
    try:
        existing_ids = {
            int(row[0])
            for row in conn.execute(
                """
                SELECT DISTINCT i.item_id
                FROM items i
                JOIN transactions t ON t.item_id = i.item_id
                WHERE t.vivonet_line_item_id IS NOT NULL
                """
            ).fetchall()
        }

        missing_ids = sorted(set(CATEGORY_BY_PRODUCT_ID) - existing_ids)
        if missing_ids:
            raise SystemExit(
                "Product IDs not found in Vivonet imported products: "
                + ", ".join(str(x) for x in missing_ids[:25])
            )

        before_counts = category_counts(conn)
        print_counts("Before category counts:", before_counts)

        rows = conn.execute(
            """
            SELECT item_id, item_name, category
            FROM items
            WHERE item_id IN (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ORDER BY item_name
            """,
            list(CATEGORY_BY_PRODUCT_ID.keys()),
        ).fetchall()

        changed = []
        for item_id, item_name, old_category in rows:
            new_category = CATEGORY_BY_PRODUCT_ID[int(item_id)]
            if (old_category or "").strip().lower() != new_category:
                changed.append((item_id, item_name, old_category, new_category))

        print()
        print(f"Products that would change category: {len(changed)}")
        for item_id, item_name, old_category, new_category in changed[:40]:
            print(f"  {item_id} | {item_name} | {old_category} -> {new_category}")
        if len(changed) > 40:
            print(f"  ... and {len(changed) - 40} more")

        if not args.apply:
            print()
            print("DRY RUN ONLY. No database changes made.")
            print("Run again with --apply to write these categories.")
            return 0

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = db_path.with_name(
            f"{db_path.stem}_before_categories_{timestamp}{db_path.suffix}"
        )
        shutil.copy2(db_path, backup_path)
        print()
        print(f"Backup created: {backup_path}")

        with conn:
            conn.executemany(
                "UPDATE items SET category = ? WHERE item_id = ?",
                [(category, product_id) for product_id, category in CATEGORY_BY_PRODUCT_ID.items()],
            )

        after_counts = category_counts(conn)
        print_counts("After category counts:", after_counts)

        print()
        print(f"Applied categories for {len(CATEGORY_BY_PRODUCT_ID)} Vivonet products.")
        print("Done.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
