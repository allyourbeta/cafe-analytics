# Vivonet latest-update script

This patch adds:

```text
database/update_vivonet_latest.py
```

## What it does

The script:

1. Looks at the local SQLite database.
2. Finds the latest imported Vivonet transaction date.
3. Rechecks that date and imports forward through yesterday.
4. Uses the existing duplicate-safe `database/backfill_vivonet.py`.
5. Prints a daily sales summary.
6. Optionally uploads the updated database to PythonAnywhere.
7. Optionally reloads the PythonAnywhere app.

## Recommended first run

From project root:

```bash
python database/update_vivonet_latest.py --dry-run
```

Then local update only:

```bash
python database/update_vivonet_latest.py
```

Then, after verifying output, update live PythonAnywhere:

```bash
python database/update_vivonet_latest.py --upload --yes
```

## Why it rechecks the latest imported date

If the latest imported transaction is on July 19, the script starts at July 19 again, not July 20.

That is intentional. The existing Vivonet importer skips duplicates, so rechecking one day is safe and helps catch possible late-arriving same-day records.

## Date behavior

By default:

```text
start = latest imported Vivonet sale date
end exclusive = today
```

So the script imports through yesterday.

You can override dates:

```bash
python database/update_vivonet_latest.py --start 20260717 --end-exclusive 20260720
```

## PythonAnywhere defaults

The upload defaults are currently:

```text
remote user:     edmondscafe
remote host:     ssh.pythonanywhere.com
remote project:  /home/edmondscafe/cafe-analytics
remote DB:       /home/edmondscafe/cafe-analytics/database/cafe_reports.db
remote WSGI:     /var/www/edmondscafe_pythonanywhere_com_wsgi.py
```
