# Cafe Analytics: Vivonet Migration Guide

## Where We Were

The cafe's point-of-sale (POS) system switched from **TouchNet** to **Infor/Vivonet**.
The old system exported Excel spreadsheets that you'd manually import. The new system
has a live API you can pull data from automatically.

Your analytics app (Flask backend + React frontend) still works perfectly for reports,
charts, labor tracking, etc. The *only* thing that changed is **how data gets into the
database**. Instead of importing Excel files, we now pull from the Vivonet API.

I built the new ingestion pipeline. Here's what it includes:

| File | What it does |
|------|-------------|
| `database/vivonet_service.py` | The brain. Talks to the API, converts timestamps, matches product names, inserts into the database. |
| `database/import_vivonet_data.py` | A command you run to import one day (defaults to yesterday). |
| `database/backfill_vivonet.py` | A command to bulk-import a range of dates (e.g., all of February). |
| `database/seed_vivonet_products.py` | Maps Vivonet product names to your existing database items. **This is the part that needs your review.** |
| `database/test_import_vivonet.py` | 22 automated tests that verify everything works. |
| `backend/admin/admin.py` | Added a button/endpoint so you can trigger an import from the web. |

---

## What Needs to Happen (The Full Checklist)

### Tonight (You Can Do These)

**Step 1: Drop the files in**

```bash
cd ~/Droppbox/programming/projects/cafe-analytics
unzip -o vivonet-migration-01.zip
```

This puts the new files into `database/` and updates `backend/admin/admin.py`.
Nothing existing gets broken. The old TouchNet import script is untouched.

**Step 2: Run the tests**

```bash
cd database/
pip install requests   # if not already installed
python -m pytest test_import_vivonet.py -v
```

You should see 22 tests pass. If something fails, let me know the error.

**Step 3: Verify the API still works**

Pull one day of real data to make sure your API key is still active:

```bash
curl -s "https://api.vivonet.com/v1/companies/83832/stores/192328/data/orders?startTime=20260322&endTime=20260323" \
  -H "X-API-Key: 36771b1160ae4d20de39790c42d70650" | python3 -c "
import json, sys
orders = json.load(sys.stdin)
print(f'Got {len(orders)} orders')
"
```

If you get a number (like "Got 287 orders"), you're good. If you get an error,
the API key may have changed. That's a question for the database team.

**Step 4: Check the product name mapping (DRY RUN)**

This is the most important step. Vivonet uses slightly different product names
than what's in your database. For example:

- Vivonet says "Lrg Latte", your DB says "Large Latte"
- Vivonet says "ChocolateChunkCookie", your DB says "Chocolate Chunk Cookie"
- Vivonet has new items like "Raspberry Beignets" that don't exist in your DB yet

Run the mapping script in dry-run mode (no changes, just shows what it would do):

```bash
python seed_vivonet_products.py --dry-run
```

**What to look for:**

- Lines starting with `🔄` = name changes (review these, make sure the right product is being matched)
- Lines starting with `🆕` = new items being added (check the categories make sense)
- Lines starting with `❌` = errors (an item_id I referenced doesn't exist in your DB)

**⚠️ The item_id numbers in my mapping might be wrong.** I pulled them from
a CSV file in your repo (`scripts/data/items_with_current_prices.csv`), but
your live database might have different IDs. If you see `❌ NOT FOUND` errors,
you'll need to look up the correct item_id in your actual database:

```bash
cd database/
sqlite3 cafe_reports.db "SELECT item_id, item_name FROM items WHERE item_name LIKE '%latte%'"
```

Then update the `VIVONET_TO_ITEM_ID` dict in `seed_vivonet_products.py` with
the correct IDs.

**Step 5: Apply the mapping (once you're happy with the dry run)**

```bash
python seed_vivonet_products.py
```

This updates product names and adds new items. It's a one-time operation.

**Step 6: Do a test import**

```bash
python import_vivonet_data.py --start 20260322 --end 20260323
```

You should see output like:

```
🚀 Vivonet Import: 20260322 → 20260323 (cafe)
  ✅ 287 orders fetched
  📊 +412 inserted, 0 dupes, 3 voids, 0 unmapped
```

Check the numbers make sense. If "unmapped" is high, some products still
don't have matches. Check `database/vivonet_review.log` for details.

**Step 7: Verify in the app**

Start your Flask server and check that the new data shows up in your reports:

```bash
cd ~/Droppbox/programming/projects/cafe-analytics/backend
python app.py
# Open http://localhost:5500 and check a report
```

---

### After Tonight (Backfill)

Once the single-day import works, backfill all historical data since the
Vivonet switch:

```bash
cd database/
python backfill_vivonet.py --start 20260201 --end 20260324
```

This runs in 7-day chunks with a 1-second pause between each chunk, so it
won't overwhelm the API. It's idempotent, meaning you can run it again
safely and it won't create duplicate records.

---

### What You'll Probably Need From the Database Team

Here's what to ask them about. I'd frame it as a short email or Slack message:

**1. Item ID reconciliation**

> "We need a mapping between Vivonet productIds and our internal item_ids.
> Right now I'm matching by product name, which works for ~85% of items,
> but some names are slightly different between systems. Can you provide a
> CSV or spreadsheet of: vivonet_productId, vivonet_productName, our_item_id?"

This would let us replace the fuzzy name matching with exact ID-based lookups.

**2. How voids/refunds work**

> "We've confirmed that voids show up as negative-quantity line items in
> separate orders. Is this the only way voids appear? Are there other void
> types we should watch for (e.g., order-level cancellations, modified orders)?"

I built the script to handle negative quantities defensively, but there might
be edge cases.

**3. Store IDs and new positions**

> "We're seeing 16 unique positionId values in the API data. In TouchNet we
> had 3 register numbers (1, 3, 4). Do the positionIds map to physical
> registers? Do we need to track them differently?"

**4. Discounts in reporting**

> "The API includes discount data at the check level (e.g., '$1 Coffee Happy
> Hour'). Currently we're recording the full menu price, not the discounted
> price. Should we subtract discounts for revenue reporting?"

---

## What the Schema Changes Look Like

Two new columns were added to the `transactions` table. They're nullable,
so all existing data is unaffected:

- `vivonet_order_id` — the order number from the Vivonet API
- `vivonet_line_item_id` — a unique ID for each line item (used to prevent duplicates)

Old TouchNet rows will have these as NULL. New Vivonet rows will have values.
Your existing reports, queries, and frontend code don't reference these columns,
so nothing breaks.

---

## Quick Reference Commands

```bash
# Import yesterday's data
python import_vivonet_data.py

# Import a specific date
python import_vivonet_data.py --start 20260315 --end 20260316

# Import for the events store instead of the cafe
python import_vivonet_data.py --start 20260315 --end 20260316 --store events

# Backfill a date range
python backfill_vivonet.py --start 20260201 --end 20260324

# Trigger import from the web API
curl -X POST http://localhost:5500/api/admin/sync-vivonet

# Check for unmapped products or voids
cat database/vivonet_review.log

# Run tests
cd database/ && python -m pytest test_import_vivonet.py -v
```

---

## Git Commit (After Everything Works)

```bash
git add database/vivonet_service.py database/import_vivonet_data.py \
        database/backfill_vivonet.py database/seed_vivonet_products.py \
        database/test_import_vivonet.py backend/admin/admin.py
git commit -m "feat: Vivonet API ingestion pipeline (replaces TouchNet CSV)

- vivonet_service.py: core logic (API, product mapping, idempotent insert)
- import_vivonet_data.py: daily CLI wrapper
- backfill_vivonet.py: historical backfill in 7-day chunks
- seed_vivonet_products.py: product name mapping for Vivonet catalog
- POST /api/admin/sync-vivonet endpoint
- 22 tests covering timezone, voids, modifiers, idempotency"
```
