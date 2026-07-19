# Cafe Analytics Vivonet Migration Backlog

_Last updated: 2026-07-17_

## Current status

### Completed

- Vivonet API integration is working locally.
- Vivonet data has been backfilled into the development database.
- Live PythonAnywhere database has been updated with the current combined database.
- Live site is running against Vivonet data through **2026-07-16 18:42:26**.
- Live site verified for **July 15-16, 2026**:
  - Total sales: **$2,657**
  - Revenue per Hour report renders successfully.
  - Items Sold report renders successfully.
  - Category reporting is no longer all `food`.
- Vivonet product categories have been applied for **207 Vivonet products**.
- PythonAnywhere database backup was created before replacing the live DB.
- Local category backup was created before updating the dev DB.

### Known limitations

- Vivonet product costs are still mostly or entirely zero, so profit and margin reports are not business-accurate yet.
- The cost document currently available from the cafe manager appears to be a comparables document, not a usable item-cost source.
- Cost data needs to come from an actual cafe source of truth or a reviewed cost sheet.
- PythonAnywhere code checkout is old and still points at the older personal GitHub remote.
- Live site currently works because the updated database was copied directly to PythonAnywhere.
- One-button/cron update is not yet implemented.
- Report performance can be improved; current caching appears mostly focused on forecast endpoints, not core sales reports.

---

## Client-meeting demo status

### Ready to show

- Live dashboard on PythonAnywhere.
- Updated Vivonet data through July 16.
- Revenue per Hour report.
- Items Sold report.
- Category-based view showing meaningful categories.

### Be explicit about

- Revenue reporting is working.
- Hourly revenue report is live and current.
- Category migration is done for Vivonet products.
- Cost/profit cleanup is the next data task and depends on receiving real item-cost data.

### Avoid overclaiming

Do not present profit/margin as final until item costs are updated.

---

## Immediate next tasks

### 1. Tablet demo readiness

- Log into the live site on the tablet.
- Confirm the date range selector works.
- Confirm the following reports load:
  - Items Sold
  - Revenue per Hour
  - Items Sold by Category
- Keep the site open and logged in before the meeting.

### 2. Cost import workflow

When real cost data is available:

- Inspect the file structure.
- Match cost rows to Vivonet products by product name.
- Use TouchNet/Vivonet product names as matching evidence.
- Generate a proposed cost review file.
- Review only uncertain matches.
- Apply approved costs to `items.current_cost`.
- Recompute/retest profit and margin reports.
- Redeploy updated database to PythonAnywhere.

### 3. PythonAnywhere deployment cleanup

- Decide whether PythonAnywhere should pull from the I-House GitHub repo instead of the old personal repo.
- Update remote if appropriate.
- Pull current code.
- Confirm WSGI path and app config.
- Decide whether database deploy should remain `scp`-based or become scripted.

### 4. One-button update

Build a script that:

- Finds the latest Vivonet transaction date in the database.
- Imports one day at a time through the target date.
- Handles `204 No Content`.
- Skips duplicates safely.
- Clears cache after data updates.
- Optionally rebuilds summary tables later.

Candidate command:

```bash
python database/update_vivonet_since_last.py --db database/cafe_reports.db
```

### 5. Performance improvements

Ranked approach:

1. Add/verify SQLite indexes for report queries.
2. Cache common sales report endpoints, not only forecast endpoints.
3. Add summary tables for common dashboard queries:
   - daily sales
   - hourly sales
   - item daily sales
   - category daily sales
4. Make the frontend load only the selected report instead of fetching too much at once.
5. Later consider moving from PythonAnywhere to Azure.

### 6. UI wording cleanup

Known wording issue:

- Revenue per Hour in average mode shows a lower card labeled `TOTAL SALES`.
- In average mode this should probably say:
  - `AVG DAILY SALES`
  - `SUM OF HOURLY AVERAGES`
  - or `AVERAGE DAILY PATTERN`

Do not prioritize this above cost data, deployment cleanup, or one-button update.

---

## Later backlog

- Cost/margin accuracy.
- Labor / WhenToWork integration.
- Daily scheduled Vivonet import.
- Proper production deployment workflow.
- Production database backup strategy.
- Gross/net/tax/tip definitions.
- Discounts, refunds, and void validation.
- Product metadata cleanup.
- Favicon / branding.
- PWA/tablet installability.
- Azure migration plan if PythonAnywhere remains slow or operationally awkward.
