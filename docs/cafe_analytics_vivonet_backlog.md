# Cafe Analytics Vivonet Migration Backlog

_Last updated: 2026-07-22_

## Current status

### Completed

- Vivonet API integration is working locally.
- Vivonet data has been backfilled into the development database.
- Live PythonAnywhere database has been updated with the combined historical and Vivonet database.
- Vivonet product categories have been applied for **207 Vivonet products**.
- PythonAnywhere database backup was created before replacing the live DB.
- Local category backup was created before updating the development DB.
- A one-command manual latest-data workflow now exists:

  ```bash
  python database/update_vivonet_latest.py --upload --yes
  ```

  The updater finds the latest imported Vivonet date, safely rechecks that date, imports forward, prints a daily summary, backs up the production database, uploads the updated database, and reloads the PythonAnywhere app.
- **Performance Phase 1 — backend SQL optimization — completed and deployed.**
  - Replaced index-blocking `DATE(transaction_date)` filters with half-open timestamp ranges.
  - Added shared date-range conversion logic in `backend/date_range.py`.
  - Verified report-result equivalence and SQLite index use.
  - Commit: `c66aed5`.
- **Performance Phase 2 — frontend request optimization — completed and deployed.**
  - Four independent dashboard KPI requests now run concurrently with `Promise.all`.
  - Duplicate `items-by-revenue` requests are prevented by a small in-memory request-deduplication/short-TTL cache.
  - Initial dashboard requests dropped from 6 to 5; date-change requests dropped from 6 to 4 in testing.
  - Commit: `e2082c4`, pushed to both `origin` and `personal`.
- Production performance was manually verified on 2026-07-22: most reports now load in a fraction of a second instead of roughly 8–10 seconds.
- Frontend-only deployment is documented and can be run from the project root with:

  ```bash
  ./scripts/deploy_frontend.sh
  ```

### Known limitations

- Vivonet product costs are still mostly or entirely zero, so profit and margin reports are not yet business-accurate.
- The cost document currently available from the cafe manager appears to be a comparables document, not a usable item-cost source.
- Cost data needs to come from an actual cafe source of truth or a reviewed cost sheet.
- The manual daily update command exists, but unattended scheduled/cron updating is not yet implemented.
- The exact Git remote and deployment procedure on PythonAnywhere should be documented and verified as part of handoff cleanup.
- `items-by-profit` still contains a per-row correlated cost-history query that may become slow on wide date ranges. Do not optimize it unless production use shows that it is a real problem.
- Only `items-by-revenue` currently has the new client-side short-TTL request reuse. Other reports refetch when revisited, although the existing Flask cache reduces the cost.

---

## Immediate next tasks

### 1. Daily operations and verification

- Run the latest-data updater after the cafe has closed or when the day's data is expected to be complete.
- Confirm the imported date range, row counts, and sales totals printed by the script.
- Verify the newest date on the production dashboard.
- Confirm that rerunning the updater does not create duplicate transactions.
- Add a short operator document covering:
  - normal daily update;
  - dry run;
  - local-only update;
  - production upload;
  - recovery from a failed upload.

### 2. Cost import workflow

When real cost data is available:

- Inspect the file structure.
- Match cost rows to Vivonet products by product name.
- Use TouchNet/Vivonet product names as matching evidence.
- Generate a proposed cost review file.
- Review only uncertain matches.
- Apply approved costs to `items.current_cost`.
- Recompute and retest profit and margin reports.
- Redeploy the updated database to PythonAnywhere.

### 3. PythonAnywhere deployment and handoff cleanup

- Verify and document which Git remote the PythonAnywhere checkout uses.
- Confirm the WSGI path and application configuration.
- Document the difference between:
  - deploying backend/source changes by pulling code and reloading the app;
  - deploying frontend-only changes with `scripts/deploy_frontend.sh`;
  - uploading a changed production database.
- Decide whether database deployment should remain `scp`-based or be wrapped in one documented script.
- Document production backup and rollback steps.

### 4. Scheduled daily update

The manual one-command updater is complete. A later operational improvement is to run it unattended.

Requirements:

- Run once daily after the cafe's reporting day is complete.
- Import only missing/rechecked dates.
- Remain duplicate-safe.
- Back up the production database before replacement.
- Reload the app only after a successful upload.
- Produce a readable log and a clear failure notification.

Do not schedule this until the manual workflow has been used successfully for several days.

### 5. UI wording cleanup

Known wording issue:

- Revenue per Hour in average mode shows a lower card labeled `TOTAL SALES`.
- In average mode this should probably say:
  - `AVG DAILY SALES`;
  - `SUM OF HOURLY AVERAGES`; or
  - `AVERAGE DAILY PATTERN`.

Do not prioritize this above cost accuracy, daily operations, or handoff documentation.

---

## New backlog item: canonical reporting-item translation layer

### Problem

Because of installation/setup errors in Vivonet, a small number of identical products exist under multiple Vivonet item IDs and slightly different names. The client will provide the affected items; the application does **not** need to discover duplicates automatically.

Example:

```text
Vivonet item 1842: Turkey Sandwich
Vivonet item 3917: Turkey Sandwich.
```

These must remain separate in Vivonet and in the raw historical transaction data, but reports should treat them as one product.

### Goal

Add a database-resident translation layer so every source item has a reporting identity:

```text
Vivonet/source item ID -> reporting item ID + canonical reporting name
```

Ordinary products map one-to-one. Confirmed duplicates map many-to-one.

Example:

```text
Vivonet 1842 --\
                >-- Reporting item R-001: Turkey Sandwich
Vivonet 3917 --/
```

All item-based reports should group and display by the reporting identity while preserving the original source item ID on every raw transaction.

### Proposed database design

#### `reporting_items`

Stores the application-owned reporting identity.

Suggested fields:

- `reporting_item_id` — stable reporting-only primary key;
- `canonical_name` — name displayed in reports;
- timestamps or audit fields if useful.

#### `item_reporting_map`

Maps each source item to one reporting item.

Suggested fields:

- `source_system` — initially `vivonet`, but keeps the design explicit;
- `source_item_id` — original Vivonet item ID;
- `reporting_item_id` — foreign key to `reporting_items`;
- unique constraint on `(source_system, source_item_id)`.

### Required behavior

- Seed all existing items one-to-one so introducing the layer does not initially change any report output.
- Automatically create a one-to-one reporting identity for every newly imported item.
- Allow a technical operator to redirect two or more source item IDs to one reporting item.
- Leave raw transactions and original Vivonet IDs unchanged.
- Update all item-based reports to group by reporting item ID and canonical name.
- Preserve total units, revenue, and other additive metrics exactly before and after mapping.
- Continue using the existing source-item category.
- Validate that all source items merged into one reporting item have the same category; reject or clearly flag a mismatch.
- No fuzzy matching or automatic duplicate detection is required.
- No external spreadsheet or service should be required at runtime.

### Maintenance and handoff requirements

Provide a small, documented command-line maintenance tool rather than requiring direct SQLite editing. It should support:

- listing a source item's current reporting mapping;
- listing all mappings for a reporting item;
- merging specified source item IDs under one canonical reporting item;
- changing the canonical reporting name;
- undoing or correcting an incorrect merge;
- validating category consistency;
- printing a clear before/after summary before committing a change.

Documentation must include examples and recovery instructions so a future developer or technically comfortable staff member can maintain the mapping without the original developer.

### Testing requirements

- Before/after totals must be identical across representative date ranges.
- Confirmed duplicate source items must appear as one line in every affected report.
- Unmapped/ordinary items must continue to appear unchanged.
- Historical discontinued products must remain reportable.
- A newly imported item must automatically receive a one-to-one reporting identity.
- An invalid category-mismatched merge must be rejected or flagged.
- Correcting or undoing a mapping must restore the expected report grouping.

### Scope boundary

The first version controls only:

- reporting item ID;
- canonical reporting name;
- grouping of item-based reports.

It does not modify Vivonet, rewrite historical transactions, discover duplicates, redesign categories, or create a nontechnical admin interface.

---

## Later backlog

- Canonical reporting-item translation layer described above.
- Cost/margin accuracy.
- Labor / WhenToWork integration.
- Daily scheduled Vivonet import.
- Production database backup and rollback strategy.
- Gross/net/tax/tip definitions.
- Discounts, refunds, and void validation.
- Product metadata cleanup.
- Favicon / branding.
- PWA/tablet installability.
- Azure migration plan only if PythonAnywhere becomes operationally inadequate.
