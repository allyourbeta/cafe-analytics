# Cafe Analytics — Report-Performance Audit (Read-Only)

## 1. Executive Finding

The main report page is slow for two **independent, additive** reasons, both confirmed with measurements:

1. **Confirmed — SQL shape defeats the date index.** Nearly every report query filters with `DATE(transaction_date) BETWEEN ? AND ?` (or `strftime(...)`) rather than a raw-column half-open range. `idx_transactions_date` indexes the *raw column*, not the `DATE()` expression, so SQLite cannot use it for these filters — it falls back to a full table scan (290,467 rows) or an unrelated index scan. Rewriting to `transaction_date >= 'START 00:00:00' AND transaction_date < 'NEXT_DAY 00:00:00'` lets SQLite use `idx_transactions_date` directly. Locally this is a **~170ms → ~0.2ms** difference for a one-day `items-by-revenue` query (≈900×), with **byte-identical results** verified by hash.
2. **Confirmed — the dashboard shell issues 4 sequential requests (one of them a duplicate) and gates the whole page's loading spinner on all 4.** `Dashboard.tsx` `loadDashboardData()` awaits `items-by-revenue → total-sales → labor-percent(true) → labor-percent(false)` one after another, not concurrently, and the visible "Loading…" state doesn't clear until the last one resolves — even though the actually-selected report panel fetches independently in parallel. `items-by-revenue` is fetched twice on every date change (once by Dashboard for the "Top Seller" KPI, once by the mounted `ItemsByRevenue` panel). Measured locally: single query ≈0.18s, but the 4-call sequential chain ≈0.52s (≈3×).

On PythonAnywhere, if a single unindexed date-filtered query costs ~2s under production load/disk, root cause #2 alone would turn one visible page load into a 4-call sequential wait of ~8s — consistent with the reported 8–10s figure — even before considering #1. The two causes compound: fixing only the SQL shape helps every individual request; fixing only the sequencing helps the perceived wait but each request is still slow. **Both should be fixed; the SQL fix is smaller, safer, and should go first.**

No evidence was found that the local database is corrupt, misconfigured (PRAGMAs are standard defaults), or missing indexes for the join columns. No evidence supports summary tables or an architecture rewrite — the existing index already covers the need once the query shape stops defeating it.

---

## 2. Repository State

```
$ pwd
/Users/ashish/Droppbox/programming/clients/cafe-analytics
$ git status --short
(empty — clean)
$ git branch --show-current
main
$ git log -1 --oneline
650c4c3 Add Vivonet latest-data updater
```

No uncommitted changes existed at audit start or exist now. No files were modified, staged, or committed during this audit (verified again at the end — `git status --short` still empty).

---

## 3. Route and Frontend Request Map

Flask entry point: `backend/app.py`. Cache: `backend/extensions.py` (`Cache()` instance), initialized in `app.py:23-26` with `CACHE_TYPE=SimpleCache`, `CACHE_DEFAULT_TIMEOUT=86400`. Blueprints registered: `admin`, `forecasts`, `items`, `labor`, `meta` (`app.py:31-42`). DB connection helper: `backend/database.py` (`sqlite3.connect`, `PRAGMA foreign_keys=ON`, row factory `sqlite3.Row`).

| Route | File:line | Date params | Cache | Tables joined | Supporting index |
|---|---|---|---|---|---|
| `/api/total-sales` | `reports/meta.py:32-55` | `start`,`end` (default: last 90d) | `@cache.cached(timeout=43200, query_string=True)` | `transactions` | `idx_transactions_date` (blocked by `DATE()`) |
| `/api/reports/items-by-revenue` | `reports/items.py:16-55` | `start`,`end`,`item_type` | same 12h cache | `transactions t JOIN items i` | `idx_transactions_date` (blocked), items PK |
| `/api/reports/items-by-profit` | `reports/items.py:59-145` | `start`,`end`,`item_type` | same | `transactions t JOIN items i`, correlated subquery on `item_cost_history` | `idx_transactions_date` (blocked); `idx_item_cost_history_unique_item_date` (used, fine) |
| `/api/reports/sales-per-hour` | `reports/labor.py:23-186` | `start`,`end`/`date`,`mode`,`exclude_dates` | same | `transactions` (subquery + outer GROUP BY) | `idx_transactions_date` (blocked) |
| `/api/reports/category-sales` | **does not exist as a backend route** | — | — | — | — |

**Note on `/api/reports/category-sales`:** grepped the entire backend and frontend — there is no such endpoint. Category-level numbers are derived **client-side** in `frontend/src/components/ItemsByRevenue.tsx:161-163` via `aggregateByCategory(data)` (see `frontend/src/utils/formatters.ts`), operating on the already-fetched `items-by-revenue` payload. Category filtering for other reports similarly reuses the item-level query with `i.category = ?` (only present in the unused `query_builder.py`, not in any live route). This is a naming mismatch in the audit brief, not a missing feature — flagging it rather than assuming.

Other date-filtered routes found (not in the requested list but relevant): `/api/reports/top-items`, `/api/reports/revenue-trends`, `/api/reports/labor-percent`, `/api/reports/item-heatmap`, `/api/reports/time-period-comparison`, `/api/forecasts/daily|hourly|items|categories`. `/api/reports/items-by-margin` (`reports/items.py:149-183`) has **no date filter at all** — it queries current `items.current_price/current_cost` only, cached but irrelevant to the date-indexing hypothesis.

### Frontend request sequencing (task 9)

- `frontend/src/context/DateContext.tsx` holds global `startDate`/`endDate` (default: "This Quarter", ~90 days), persisted to `sessionStorage`.
- `Dashboard.tsx` (`components/Dashboard.tsx:450-516`) runs `loadDashboardData()` on every `[startDate, endDate]` change (`:514-516`). Inside it, four requests are **awaited sequentially, not concurrently**:
  1. `getItemsByRevenue(startDate, endDate)` — `:453`
  2. `getTotalSales(startDate, endDate)` — `:461`
  3. `getLaborPercent(startDate, endDate, true)` — `:476`
  4. `getLaborPercent(startDate, endDate, false)` — `:492`
- The **entire page** (sidebar + selected report panel) is gated behind `Dashboard`'s own `loading` state (`:544-546`, `if (loading) return <div>Loading...</div>`), which only flips false after all four sequential calls settle (`:508-510` `finally`). This is the request that controls the visible loading state — and it is the slowest, most redundant one.
- Independently, whichever report panel is mounted (default `ItemsByRevenue`, `components/ItemsByRevenue.tsx:137-158`) fires its **own** `getItemsByRevenue(startDate, endDate, itemType)` on the same date-change event (`:156-158`). This runs concurrently with Dashboard's chain (separate `useEffect`), but is a duplicate of Dashboard's request #1 with identical parameters when `itemType==="all"`.
- Other report panels (`SalesPerHour.tsx:366-368`, `LaborPercent.tsx` ~`:580-590`, `ItemsByProfit.tsx:160-162`, `ItemHeatmap.tsx:55-100`, `WeeklyMonthlyTrends.tsx:493-495`, `Timeperiodcomparison.tsx:355-368`) each fire exactly one request per relevant dependency change — no additional duplication found there. Since `Dashboard.tsx` only renders `selectedReportData.component` for the currently-selected report (`:871`), unselected report panels are **not mounted** and do **not** fetch — confirmed no "inactive panel fetches immediately" behavior.
- No endpoint is requested more than once **except** `items-by-revenue` (Dashboard KPI card + the ItemsByRevenue panel, when that panel is the active one).

---

## 4. Database Facts

```
SQLite version:        3.51.0
DB file:                database/cafe_reports_vivonet_dev.db, 56,872,960 bytes
page_size / page_count: 4096 / 13885  (≈ 54.9 MB pages, consistent with file size)
journal_mode:           delete
synchronous:            2 (FULL)
cache_size:             2000 (pages, default)
integrity_check:        ok
transactions row count: 290,467
min(transaction_date):  2024-07-01 07:52:58.910000
max(transaction_date):  2026-07-21 19:22:59
typeof(transaction_date): 'text' for all 290,467 rows (no mixed types)
transaction_date string length: 19 chars (no fractional seconds) for 80,201 rows; 26 chars (6-digit fractional seconds) for 210,266 rows — both zero-padded 'YYYY-MM-DD HH:MM:SS[.ffffff]', 0 rows fail a GLOB sanity pattern check
Rows for 2026-07-21:     243 (identical via DATE()=… and via half-open range)
```

Schema (`transactions`):
```sql
CREATE TABLE transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_date TIMESTAMP NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    register_num INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL, vivonet_order_id INTEGER, vivonet_line_item_id INTEGER,
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);   -- raw column, not DATE(transaction_date)
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE UNIQUE INDEX idx_transactions_touchnet_unique ON transactions(transaction_date, item_id, register_num) WHERE vivonet_line_item_id IS NULL;
CREATE UNIQUE INDEX idx_vivonet_line_item_id ON transactions(vivonet_line_item_id) WHERE vivonet_line_item_id IS NOT NULL;
```
`items`: 526 rows. `item_cost_history`: 245 rows, with `idx_item_cost_history_unique_item_date` (used efficiently by the correlated subquery in `items-by-profit`, not a bottleneck). `labor_hours`: 2,584 rows, already denormalized with a `shift_date` column and its own index — not implicated in the date-index problem.

`idx_transactions_date` definition confirmed exact: `CREATE INDEX idx_transactions_date ON transactions(transaction_date)` — an index on the raw column. There is **no** expression index on `DATE(transaction_date)`.

---

## 5. Date-Filter Occurrences (classified)

**Filtering that may affect index use (candidates for rewrite):**
- `backend/reports/meta.py:43` (`total_sales`), `:93` (`top_items`), `:162`, `:241` (`revenue_trends` weekly/monthly loop queries) — all `WHERE DATE(transaction_date) BETWEEN ? AND ?`.
- `backend/reports/items.py:35` (`items_by_revenue`), `:94` (`items_by_profit` CTE), `:204/209` (`item_heatmap`), `:304` (`time_period_comparison`'s `get_period_revenue`) — all `DATE(t.transaction_date) BETWEEN ...` or `DATE(transaction_date) BETWEEN ...`.
- `backend/reports/labor.py:46` (`sales_per_hour` single mode, `=`), `:62/67` and `:130/135` (average/day-of-week `BETWEEN`), `:204/209` (`labor_percent`'s revenue-check and sales query).
- `backend/query_builder.py:94` — `add_date_range_filter()` bakes in the same `DATE(t.transaction_date) BETWEEN ? AND ?` pattern. **This module is defined and unit-tested (`test_query_builder.py`) but is not imported by any live route** — confirmed via repo-wide grep. It is dead code today but would propagate the same defect if ever wired in.
- `backend/forecasts/forecasts.py:30-31, 125-126, 221-222` — already use a **half-open range** (`DATE(transaction_date) >= DATE(?, '-28 days') AND DATE(transaction_date) < ?`), which is good practice for inclusivity but **still wraps the column in `DATE()`**, so it still cannot use `idx_transactions_date` and still does a full scan. Confirmed via `EXPLAIN QUERY PLAN` (Section 6). `forecasts.py:376` (`AND DATE(transaction_date) = ?`) — same issue, single-day equality inside a loop.

**Grouping or display transformation (do not rewrite — not the bottleneck):**
- `strftime('%H:00', transaction_date)`, `strftime('%w', transaction_date)`, `strftime('%Y-%m-%d %H:00:00', transaction_date)` throughout `labor.py`, `items.py` (heatmap, time-period comparison), `forecasts.py` — these run on the already-filtered row set for hour/day-of-week bucketing, not on the WHERE clause driving row selection (once the WHERE clause itself is fixed, these no longer touch the full table).
- `DATE(transaction_date) as sale_date/day/date` used in `SELECT`/`GROUP BY` for daily aggregation (`labor.py:84,163`, `items.py:215`, `forecasts.py:27,121,218`) — display/grouping only.
- `ich.effective_date <= DATE(t.transaction_date)` in `items.py:88` — correlated subquery join condition against `item_cost_history`, not against `idx_transactions_date`; already confirmed to use `idx_item_cost_history_unique_item_date` efficiently regardless of the outer WHERE clause fix.

**Import/maintenance logic (irrelevant to report performance):**
- `backend/admin/admin.py:92-99` — `strftime`/date arithmetic on Python `datetime` objects (not SQL) to compute default Vivonet import date ranges for `/api/admin/sync-vivonet`. No `transactions` query involved.
- `backend/reports/meta.py` Python-side `datetime`/`strftime` calls (`:143,155-156,169,176,191,200,220,234-235,248,262,271` etc.) — these build week/month period labels and boundaries in Python, not SQL predicates.
- `backend/labor_utils.py` `datetime(...)` occurrences are all inside docstring examples, not executable code.

**No occurrences found** of `julianday(` anywhere in the repository.

---

## 6. Query-Plan Evidence

All plans below are from `EXPLAIN QUERY PLAN` against `database/cafe_reports_vivonet_dev.db` (read-only), current production-shaped SQL vs. the half-open-range candidate, using `2026-07-21` (one day, 243 rows) unless noted.

**`total_sales` (one day):**
```
current:   SCAN transactions                                                          -- full table scan
candidate: SEARCH transactions USING INDEX idx_transactions_date (transaction_date>? AND transaction_date<?)
```

**`items_by_revenue` (one day):**
```
current:   SCAN t USING INDEX idx_transactions_item      -- full scan of transactions, using an unrelated index
           SEARCH i USING INTEGER PRIMARY KEY (rowid=?)
           USE TEMP B-TREE FOR GROUP BY
           USE TEMP B-TREE FOR ORDER BY
candidate: SEARCH t USING INDEX idx_transactions_date (transaction_date>? AND transaction_date<?)
           SEARCH i USING INTEGER PRIMARY KEY (rowid=?)
           USE TEMP B-TREE FOR GROUP BY / ORDER BY   -- unchanged, small result set
```

**`items_by_revenue` (7-day range and default "This Quarter" ~91-day range):** current plan flips to `SCAN i / SEARCH t USING INDEX idx_transactions_item (item_id=?)` — a nested loop over all 526 items, each searching `transactions` by `item_id`, which still touches essentially the whole table. Candidate plan is identical for both ranges: `SEARCH t USING INDEX idx_transactions_date (...) / SEARCH i USING INTEGER PRIMARY KEY / TEMP B-TREE FOR GROUP BY`.

**`sales_per_hour` average mode (one day):**
```
current:   CO-ROUTINE (subquery-1): SCAN transactions + TEMP B-TREE FOR GROUP BY ; SCAN (subquery-1) + TEMP B-TREE FOR GROUP BY
candidate: CO-ROUTINE (subquery-1): SEARCH transactions USING INDEX idx_transactions_date (...) + TEMP B-TREE FOR GROUP BY ; SCAN (subquery-1) + TEMP B-TREE FOR GROUP BY
```

**`labor_percent` revenue-check query (`SELECT COUNT(*) ... WHERE DATE(transaction_date) BETWEEN ? AND ?`):**
```
current: SCAN transactions USING COVERING INDEX idx_transactions_date
```
Notable: because only a count is needed, SQLite still does a full **scan** of the index (cheaper than a heap scan, but still O(n) over the whole index, not a range search) — the `DATE()` wrapper still prevents a `SEARCH`.

**`labor_percent` hourly sales query (one day):**
```
current:   SCAN transactions + TEMP B-TREE FOR GROUP BY
candidate: (same query with half-open range) SEARCH transactions USING INDEX idx_transactions_date + TEMP B-TREE FOR GROUP BY
```

**`items_by_profit` (CTE with correlated subquery, one day):**
```
current:   SCAN t USING INDEX idx_transactions_item          -- full scan
           CORRELATED SCALAR SUBQUERY: SEARCH ich USING INDEX idx_item_cost_history_unique_item_date (item_id=? AND effective_date<?)  [×3, once per CTE reference]
           SEARCH i USING INTEGER PRIMARY KEY
           TEMP B-TREE FOR GROUP BY / ORDER BY
candidate: SEARCH t USING INDEX idx_transactions_date (transaction_date>? AND transaction_date<?)   -- everything else unchanged
```

**`forecasts.py` `daily_forecast` (already half-open, but still `DATE()`-wrapped, 28-day window):**
```
SCAN transactions
TEMP B-TREE FOR GROUP BY
```
Confirms the half-open range alone is **not** sufficient — the `DATE()` function wrapper is what defeats the index, independent of BETWEEN vs. `>=`/`<`.

**Conclusion:** every date-filtered report query currently performs a full scan of `transactions` (290,467 rows) or an equivalent full-table pass via an unrelated index, regardless of how narrow the requested date window is. Every tested candidate rewrite (raw-column half-open range) produces a `SEARCH ... USING INDEX idx_transactions_date` with a bounded range condition. No query plan showed the "current" shape using `idx_transactions_date` in a `SEARCH` form for any date-filtered predicate.

---

## 7. Correctness-Equivalence Evidence

All comparisons below used SHA-256 hashes of the full ordered result set (all columns, all rows) for current vs. candidate SQL, plus explicit row counts. Ranges tested: one day (`2026-07-21`), 7-day (`2026-07-15`→`2026-07-21`), quarter default (`2026-04-01`→`2026-07-21`), earliest boundary (`2024-07-01`, the min `transaction_date` day), and a no-data future range (`2030-01-01`).

| Query | Range | Rows (current / candidate) | Hash match |
|---|---|---|---|
| `total_sales` | 1-day | 1 / 1 | ✅ identical |
| `total_sales` | no-data (2030-01-01) | 1 / 1 (NULL total both) | ✅ identical |
| `items_by_revenue` | 1-day | 54 / 54 | ✅ identical |
| `items_by_revenue` | 7-day | 78 / 78 | ✅ identical |
| `items_by_revenue` | quarter (91d) | 193 / 193 | ✅ identical |
| `sales_per_hour` (average) | 1-day | 11 / 11 | ✅ identical |
| `labor_percent` sales query | 1-day | 11 / 11 | ✅ identical |
| `items_by_profit` (full CTE) | 1-day | 54 / 54 | ✅ identical |
| Raw day-boundary count/sum, earliest date | `2024-07-01` | 185 rows, $867.75 both ways | ✅ identical |

No discrepancies found in any tested pair. The half-open rewrite is confirmed date-range-inclusive-equivalent to the current `DATE(...) BETWEEN` logic for every case tested, including the earliest populated day and a genuinely empty range. (Equivalence holds because every `transaction_date` string is a consistently zero-padded `'YYYY-MM-DD HH:MM:SS[.ffffff]'` — confirmed in Section 4 — so lexicographic string comparison against `'YYYY-MM-DD 00:00:00'` boundaries is safe.)

One incidental, out-of-scope observation surfaced while building these equivalence fixtures: for `2026-07-21`, every item's `total_profit` from `items_by_profit` was numerically identical to its `revenue` from `items_by_revenue`, which is only possible if `effective_cost` resolved to `0` for every matched item that day. This looks like a cost-history data-completeness issue, not a query-shape bug (both current and candidate SQL agree on this same output). Flagging it, but per the audit's constraints this is not addressed further here — no profit/cost calculation logic was touched or is being recommended for change.

---

## 8. SQL and Endpoint Timing Results

All timings below: local machine, dev DB (`cafe_reports_vivonet_dev.db`), Python 3 `sqlite3` module, read-only URI connection, one connection per benchmark run, 7 executions per query (first execution recorded separately as "cold-ish"; min/median/max computed from the remaining 6 warm-cache-in-OS-page-cache runs). These are **relative** numbers to establish that the query-shape change is meaningful — not a claim about PythonAnywhere's absolute latency, which was not directly measured (see caveat below).

| Query | Range | First (ms) | Min/Med/Max, runs 2-7 (ms) |
|---|---|---|---|
| `total_sales` current | 1-day | 228.32 | 25.38 / 25.52 / 25.96 |
| `total_sales` candidate | 1-day | 0.16 | 0.02 / 0.02 / 0.02 |
| `items_by_revenue` current | 1-day | 176.39 | 168.08 / 170.81 / 177.08 |
| `items_by_revenue` candidate | 1-day | 0.37 | 0.18 / 0.18 / 0.20 |
| `items_by_revenue` current | 7-day | 175.78 | 168.53 / 170.19 / 172.11 |
| `items_by_revenue` candidate | 7-day | 1.16 | 0.88 / 0.89 / 0.91 |
| `items_by_revenue` current | quarter | 192.97 | 185.05 / 187.52 / 193.09 |
| `items_by_revenue` candidate | quarter | 25.87 | 24.27 / 24.43 / 24.61 |
| `sales_per_hour` avg current | 1-day | 28.00 | 26.34 / 26.62 / 30.48 |
| `sales_per_hour` avg candidate | 1-day | 0.27 | 0.11 / 0.11 / 0.12 |
| `labor_percent` sales query current | 1-day | 26.88 | 25.45 / 25.69 / 26.41 |
| `labor_percent` sales query candidate | 1-day | 0.25 | 0.10 / 0.11 / 0.11 |
| `items_by_profit` (full CTE) current | 1-day | 185.19 | 172.55 / 208.61 / 242.81 |
| `items_by_profit` (full CTE) candidate | 1-day | 0.70 | 0.46 / 0.46 / 0.48 |
| no-data range current | future | 26.52 | 25.18 / 25.27 / 25.43 |
| no-data range candidate | future | 0.11 | 0.01 / 0.01 / 0.01 |

The quarter-range `items_by_revenue` candidate is notably slower (≈24ms) than the 1-day/7-day candidates (≈0.2-0.9ms) because a 91-day window still returns ~193 grouped rows requiring the join + `TEMP B-TREE` work over a larger (though now correctly index-bounded) row set — the improvement there is real (192.97ms → 24.43ms, ≈8×) but smaller than the 1-day case (≈900×), because a wider window inherently touches more rows even with the index.

**Endpoint-level timing** (Flask dev server, same dev DB, `CAFE_DB_PATH` override, `curl -w time_total`, cache explicitly cleared via `/api/admin/clear-cache` before each "cold" measurement):

| Endpoint | Cold (cache miss) | Warm (cache hit) |
|---|---|---|
| `items-by-revenue`, 1-day | 0.177–0.351s (177–351ms) | 0.0016–0.0018s |
| `total-sales`, 1-day | 0.029s | 0.0023s |
| `sales-per-hour` avg, 1-day | 0.053s | 0.0025s |
| `labor-percent` (true), 1-day | 0.052s | 0.0019s |
| `items-by-profit`, 1-day | 0.203s | 0.0024s |
| `items-by-revenue`, 7-day | 0.178s | — |
| `items-by-revenue`, quarter (91d) | 0.191s | — |

Endpoint cold times track the raw SQL benchmark closely (e.g. `items-by-revenue` ≈170-190ms SQL vs ≈177-351ms endpoint), confirming SQL execution — not JSON serialization or Flask routing — dominates cold-request latency locally. The one 351ms outlier occurred on the first request after clearing cache in a freshly-warmed process and was not reproducible on repeat trials (176-177ms thereafter); attributed to incidental OS/interpreter warm-up, not query cost, and is called out rather than used to inflate the finding.

**Simulated `Dashboard.loadDashboardData()` sequential chain**, cache cleared, 1-day range, timed via separate `curl` calls in the exact order the frontend issues them:

```
items-by-revenue:  0.351s
total-sales:        0.040s
labor-percent(T):   0.063s
labor-percent(F):   0.063s
TOTAL sequential:   0.518s
```

Even locally, the sequential four-call chain (≈0.52s) takes roughly 3× the single slowest call (≈0.18-0.35s) because the calls do not overlap. **Caveat, explicitly flagged as untested:** production PythonAnywhere absolute latency was not measured in this audit (no access to the live host was used or attempted). The 8-10s figure from the problem statement is taken as given; the *ratios* observed here (full-scan vs. indexed query; sequential-4× vs. single-call) are the transferable evidence, not the absolute millisecond values.

---

## 9. Caching Findings

- Backend: `flask_caching.Cache` with `CACHE_TYPE: 'SimpleCache'` (`backend/app.py:23-26`) — an in-process Python dict. **Process-local**: not shared across multiple worker processes, and wiped whenever the WSGI process restarts/reloads (PythonAnywhere recycles/reloads the process on code deploys or inactivity — cache state does not survive that).
- Default timeout: `CACHE_DEFAULT_TIMEOUT: 86400` at init, but every route-level decorator explicitly overrides it to `timeout=43200` (12h) via `@cache.cached(timeout=43200, query_string=True)` — confirmed on every report/forecast route (`items.py`, `labor.py`, `meta.py`, `forecasts.py`).
- `query_string=True` is set on all of them, so `start`/`end`/`item_type`/`mode`/etc. are part of the cache key — different parameter combinations (e.g. `items-by-revenue?item_type=all` vs `?item_type=purchased`, or any new date range) are cache **misses** until first requested. This means every *new* date range picked by a user is a guaranteed cold, full-scan hit for every report on the page, regardless of caching — caching only helps repeat views of the *same* range.
- `/api/data-freshness` (`meta.py:18-28`) deliberately has **no** cache decorator — comment confirms this is intentional ("always fresh on page load").
- Explicit invalidation: `cache.clear()` is called in `backend/admin/admin.py:43` (`/api/admin/clear-cache`) and `:108` (after a successful `/api/admin/sync-vivonet` import) — new data is proactively made visible after import, at the cost of clearing *all* cached reports (not just affected ranges).
- Whether PythonAnywhere runs a single worker process or multiple could not be verified from this repo (`deployment/pythonanywhere_wsgi.py` shows a standard single-`application` WSGI module; PythonAnywhere's own process model is external to this repo and was not tested). If it runs multiple worker processes, `SimpleCache` per-process would mean some requests hit a cold cache even for previously-seen ranges — flagged as **possible**, not confirmed.
- Minor, unrelated observation: `deployment/pythonanywhere_wsgi.py:15` sets `os.environ['DATABASE_PATH']`, but `backend/database.py:12` reads `CAFE_DB_PATH` — this specific env var is effectively unused; the app instead falls back to its `DEFAULT_DB_PATH` (`../database/cafe_reports.db` relative to `backend/`), which is correct for the documented deployment layout. Not a performance issue; noted for completeness since it touches the same file.

---

## 10. Root-Cause Ranking

| Contributor | Status | Evidence |
|---|---|---|
| `DATE(transaction_date)` / `strftime(...)` in WHERE clauses defeats `idx_transactions_date`, forcing full table scans on every date-filtered report query | **Confirmed** | `EXPLAIN QUERY PLAN` shows `SCAN transactions` (or full-scan-via-unrelated-index) for every current-shaped query tested; `SEARCH ... USING INDEX idx_transactions_date` for every half-open-range candidate. Local timing gap 8×-900× depending on range width. Result-set equivalence confirmed by hash for every tested range. |
| Dashboard KPI panel issues 4 sequential (not concurrent) requests, one of them (`items-by-revenue`) duplicating the active report panel's own request, and gates the entire page's loading state on all 4 | **Confirmed** | `Dashboard.tsx:450-516` read directly; sequential chain measured locally at ≈0.52s vs ≈0.18-0.35s for the slowest single call in that chain (≈3×). |
| `flask_caching` SimpleCache does not help first-touch of any given date range, and is invalidated wholesale (not per-range) after any Vivonet import | **Confirmed, but secondary** | Code inspection (`app.py`, `admin.py`) plus endpoint cold/warm timing (177-351ms cold vs 1.6-2.5ms warm) — caching works as designed for *repeat* views, but every new range a user picks is guaranteed to hit the slow, unindexed path once. |
| Multiple PythonAnywhere worker processes causing per-process cache fragmentation | **Possible** | Cannot be verified from the repository; flagged, not tested. |
| `items_by_profit`'s correlated subquery against `item_cost_history` | **Ruled out** | Query plan shows it already using `idx_item_cost_history_unique_item_date` efficiently in both current and candidate shapes; it is not the source of the full-table-scan cost, which occurs on the outer `transactions` scan instead. |
| Labor-hour proration (`labor_utils.py`) Python-side computation | **Ruled out as a transactions-date-index issue** | Operates on `labor_hours` (2,584 rows, already denormalized with `shift_date` + its own index), a separate, small table; not implicated by the date-filter hypothesis. |
| SQLite PRAGMA misconfiguration, disk corruption, or missing indexes on join columns | **Ruled out** | `integrity_check: ok`; `journal_mode`, `synchronous`, `cache_size`, `page_size` are all standard/default values; `items` PK and `item_cost_history`'s composite index are present and used correctly. |
| Database size/row-count growth alone (290K rows) | **Ruled out as sole cause** | 290K rows is well within what a correctly-indexed SQLite range scan handles in sub-millisecond-to-low-millisecond time locally (0.02-25ms for indexed candidates depending on range width); the full-scan cost is a query-shape artifact, not an inherent scale limit yet. |

---

## 11. Smallest Safe Optimization Recommendation

**Rewrite the date-filter predicate from `DATE(transaction_date) BETWEEN ? AND ?` to a half-open raw-column range**, computing the exclusive upper bound as "day after the user's inclusive end date, at midnight," in every report/forecast route identified in Section 5's first bucket. Concretely, in each affected route:

```python
# before
start_date = request.args.get('start', default_start)   # 'YYYY-MM-DD'
end_date   = request.args.get('end', default_end)        # 'YYYY-MM-DD'
# ... WHERE DATE(transaction_date) BETWEEN ? AND ?   params=(start_date, end_date)

# after
start_date = request.args.get('start', default_start)
end_date   = request.args.get('end', default_end)
end_exclusive = (datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
# ... WHERE transaction_date >= ? AND transaction_date < ?   params=(f"{start_date} 00:00:00", f"{end_exclusive} 00:00:00")
```

This preserves the user-facing inclusive end-date semantics exactly (verified in Section 7), touches only the WHERE-clause predicate (not the SELECT/GROUP BY/aggregation logic, so revenue/profit/category/hourly calculations are untouched, satisfying the constraint), and is confirmed by `EXPLAIN QUERY PLAN` to restore `idx_transactions_date` usage in every case tested.

This alone should meaningfully shrink every individual report request's SQL time. It does **not**, by itself, fix the Dashboard's sequential-4-call chain or the duplicate `items-by-revenue` fetch (Section 3/10, contributor #2) — those are a separate, also-small, frontend-only fix (change `loadDashboardData` to fire its 4 calls concurrently via `Promise.all`, and consider having the Dashboard KPI reuse the already-fetched `items-by-revenue` data from the active panel instead of re-fetching it) that this audit recommends as a **follow-on**, not a substitute, since it was out of scope to implement here but is clearly evidenced.

No summary table, materialized view, or architectural rewrite is justified by the evidence gathered — the existing `idx_transactions_date` index already does the job once the predicate stops wrapping the indexed column in a function.

---

## 12. Files That Would Change in the Implementation Phase

- `backend/reports/meta.py` — `total_sales` (`:40-46`), `top_items` (`:85-99`), `revenue_trends`'s per-period queries (`:159-163`, `:238-242`)
- `backend/reports/items.py` — `items_by_revenue` (`:25-36`), `items_by_profit`'s CTE (`:72-95`), `item_heatmap` (`:204-211`), `time_period_comparison`'s `get_period_revenue` (`:297-308`)
- `backend/reports/labor.py` — `sales_per_hour` single/average/day-of-week modes (`:41-49`, `:62-68`, `:130-136`), `labor_percent`'s revenue-check and sales queries (`:204-210`, `:213-218`, `:230-238`)
- `backend/forecasts/forecasts.py` — `daily_forecast` (`:25-34`), and the two other similarly-shaped forecast queries (`:118-127`, `:215-224`), plus the single-day equality check (`:376`)
- `backend/query_builder.py` — `add_date_range_filter()` (`:84-96`), currently dead code but should be fixed in place (or removed) so it doesn't reintroduce the defect if ever wired into a route; `backend/test_query_builder.py` would need its assertion on the WHERE-clause string updated to match.
- **Not recommended for this pass but evidenced as a follow-on:** `frontend/src/components/Dashboard.tsx` (`:450-516`) — parallelize the 4 KPI calls and remove the duplicate `items-by-revenue` fetch.

---

## 13. Risks and Required Regression Tests

- **Off-by-one at range boundaries.** The half-open upper bound must be computed as start-of-day *after* the inclusive end date, in every route independently (no shared helper currently exists for this) — a mistake in any one route re-introduces either an excluded last day or an included extra day. Regression test: for every rewritten route, assert identical row count and total(s) between the old `DATE(...) BETWEEN` query and the new half-open query across at least a 1-day, 7-day, month-spanning, and year-boundary-spanning range, plus the true min/max `transaction_date` boundary days (this audit already established the harness/hashes to reuse for this — see Section 7).
- **Fractional-second timestamps.** Storage mixes 19-char and 26-char (with microseconds) strings (Section 4). Half-open comparison against a bare `'YYYY-MM-DD HH:MM:SS'` boundary is safe *only* because all values are consistently zero-padded — confirmed here, but any future data-import path that writes a differently-formatted `transaction_date` (e.g. single-digit hour, different separator) would silently break the lexicographic comparison. Regression test: add/keep a `typeof()`/`GLOB` format-sanity check as part of import validation (informational — not part of this audit's diff, since the audit is read-only, but worth carrying into the implementation phase).
- **`item_heatmap`'s `exclude_dates` and `sales_per_hour`/`labor_percent`'s `NOT IN` date-exclusion clauses** still compare against `DATE(transaction_date)` even after the main range predicate is fixed (`items.py:209`, `labor.py:67,135,209`) — these remain correct but will still force a per-row `DATE()` evaluation on the now-much-smaller, already-range-filtered set, which is fine (they no longer drive index selection) but should not be mistaken for "also fixed."
- **Cache staleness during rollout.** Because `query_string=True` cache keys don't change when only the underlying SQL implementation changes, old cached responses (up to 12h old) will simply expire and be replaced by the new (equivalent) results — no explicit cache-clear is required for correctness, but running `/api/admin/clear-cache` once after deploying is a reasonable low-risk step to see the improvement immediately rather than waiting out the TTL.
- **`items_by_profit`'s missing-cost diagnostic query** (`items.py:130-138`) reuses the same CTE text with the same date predicate — it must be rewritten in lockstep with the main query in that route, or the two queries in the same request could disagree on which rows they're scanning.
