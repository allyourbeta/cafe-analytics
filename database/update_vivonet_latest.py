#!/usr/bin/env python3
"""
Update Edmonds Cafe Vivonet data from the latest imported date.

Run from project root:

    python database/update_vivonet_latest.py

Typical workflow:

    python database/update_vivonet_latest.py --dry-run
    python database/update_vivonet_latest.py
    python database/update_vivonet_latest.py --upload --yes

This script rechecks the latest imported sale date by default. The Vivonet
importer is duplicate-safe, so this catches possible late-arriving same-day rows
without creating duplicate transaction lines.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sqlite3
import subprocess
import sys
from pathlib import Path


DEFAULT_DB = Path("database/cafe_reports_vivonet_dev.db")
DEFAULT_REMOTE_USER = "edmondscafe"
DEFAULT_REMOTE_HOST = "ssh.pythonanywhere.com"
DEFAULT_REMOTE_PROJECT = "/home/edmondscafe/cafe-analytics"
DEFAULT_REMOTE_DB = f"{DEFAULT_REMOTE_PROJECT}/database/cafe_reports.db"
DEFAULT_REMOTE_WSGI = "/var/www/edmondscafe_pythonanywhere_com_wsgi.py"


def parse_date(value: str) -> dt.date:
    value = value.strip()
    for fmt in ("%Y%m%d", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    raise argparse.ArgumentTypeError(f"Invalid date {value!r}; use YYYYMMDD or YYYY-MM-DD")


def yyyymmdd(d: dt.date) -> str:
    return d.strftime("%Y%m%d")


def iso(d: dt.date) -> str:
    return d.isoformat()


def run(
    cmd: list[str], *, check: bool = True, input: str | None = None
) -> subprocess.CompletedProcess[str]:
    print()
    print("+ " + " ".join(cmd))
    if input is not None:
        print("  (piping SQL to stdin)")
    return subprocess.run(cmd, check=check, text=True, input=input)


def get_latest_vivonet_timestamp(db_path: Path) -> str | None:
    with sqlite3.connect(db_path) as conn:
        cur = conn.execute(
            """
            SELECT MAX(transaction_date)
            FROM transactions
            WHERE vivonet_line_item_id IS NOT NULL
            """
        )
        row = cur.fetchone()
        return None if row is None else row[0]


def get_daily_summary(db_path: Path, start_date: dt.date) -> list[dict[str, object]]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT DATE(transaction_date) AS sale_date,
                   COUNT(*) AS rows,
                   ROUND(SUM(total_amount), 2) AS sales
            FROM transactions
            WHERE vivonet_line_item_id IS NOT NULL
              AND DATE(transaction_date) >= ?
            GROUP BY DATE(transaction_date)
            ORDER BY sale_date
            """,
            (iso(start_date),),
        ).fetchall()
        return [dict(row) for row in rows]


def get_latest_date_from_timestamp(ts: str | None) -> dt.date | None:
    if not ts:
        return None
    return dt.datetime.fromisoformat(ts.replace(" ", "T")).date()


def print_summary(title: str, latest_ts: str | None, rows: list[dict[str, object]]) -> None:
    print()
    print("=" * 60)
    print(title)
    print("=" * 60)
    print(f"Latest Vivonet transaction: {latest_ts or 'none'}")
    print()
    if not rows:
        print("No rows in requested summary range.")
        return

    print(f"{'sale_date':<12} {'rows':>8} {'sales':>12}")
    print("-" * 36)
    for row in rows:
        sale_date = str(row["sale_date"])
        row_count = int(row["rows"])
        sales = float(row["sales"] or 0)
        print(f"{sale_date:<12} {row_count:>8} {sales:>12.2f}")


def ensure_project_root() -> None:
    required = [
        Path("database/backfill_vivonet.py"),
        Path("backend"),
        Path("database"),
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        print("This script should be run from the project root.")
        print("Missing expected paths:")
        for p in missing:
            print(f"  {p}")
        raise SystemExit(2)


def local_update(args: argparse.Namespace) -> tuple[dt.date, dt.date]:
    ensure_project_root()

    db_path = Path(args.db)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    latest_ts = get_latest_vivonet_timestamp(db_path)
    latest_date = get_latest_date_from_timestamp(latest_ts)

    end_exclusive = args.end_exclusive or dt.date.today()

    if args.start:
        start_date = args.start
    elif latest_date:
        start_date = latest_date
    else:
        raise SystemExit(
            "No existing Vivonet transactions found. Use --start YYYYMMDD for the first import."
        )

    if start_date >= end_exclusive:
        print()
        print("Nothing to import.")
        print(f"Start date:          {iso(start_date)}")
        print(f"End exclusive date:  {iso(end_exclusive)}")
        print("The database appears current through yesterday.")
        print_summary(
            "Current local Vivonet summary",
            latest_ts,
            get_daily_summary(db_path, start_date),
        )
        return start_date, end_exclusive

    print()
    print("Vivonet update plan")
    print("-------------------")
    print(f"Database:            {db_path}")
    print(f"Latest transaction:  {latest_ts or 'none'}")
    print(f"Import start:        {iso(start_date)}")
    print(f"Import end excl.:    {iso(end_exclusive)}")
    print(f"Store:               {args.store}")
    print(f"Chunk days:          {args.chunk_days}")

    if args.dry_run:
        print()
        print("Dry run only. No import performed.")
        return start_date, end_exclusive

    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"vivonet_update_{yyyymmdd(start_date)}_{yyyymmdd(end_exclusive)}_{timestamp}.log"

    cmd = [
        sys.executable,
        "-u",
        "database/backfill_vivonet.py",
        "--start",
        yyyymmdd(start_date),
        "--end",
        yyyymmdd(end_exclusive),
        "--chunk-days",
        str(args.chunk_days),
        "--db",
        str(db_path),
    ]
    if args.store:
        cmd.extend(["--store", args.store])

    print()
    print(f"Logging import output to: {log_path}")
    with log_path.open("w", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        assert process.stdout is not None
        for line in process.stdout:
            print(line, end="")
            log_file.write(line)
        rc = process.wait()

    if rc != 0:
        raise SystemExit(f"Vivonet import failed with exit code {rc}")

    latest_after = get_latest_vivonet_timestamp(db_path)
    summary_after = get_daily_summary(db_path, start_date)
    print_summary("Local DB after Vivonet update", latest_after, summary_after)
    return start_date, end_exclusive


def verify_remote(args: argparse.Namespace, summary_start: dt.date) -> None:
    remote = f"{args.remote_user}@{args.remote_host}"

    verify_sql = f"""
SELECT MAX(transaction_date) AS latest_vivonet_transaction
FROM transactions
WHERE vivonet_line_item_id IS NOT NULL;

SELECT DATE(transaction_date) AS sale_date,
       COUNT(*) AS rows,
       ROUND(SUM(total_amount), 2) AS sales
FROM transactions
WHERE vivonet_line_item_id IS NOT NULL
  AND DATE(transaction_date) >= '{iso(summary_start)}'
GROUP BY DATE(transaction_date)
ORDER BY sale_date;
"""
    remote_cmd = f"cd {args.remote_project} && sqlite3 -header -column database/cafe_reports.db"
    run(["ssh", remote, remote_cmd], input=verify_sql)


def upload_to_pythonanywhere(args: argparse.Namespace, summary_start: dt.date) -> None:
    db_path = Path(args.db)
    remote = f"{args.remote_user}@{args.remote_host}"

    if args.dry_run:
        print()
        print("Dry run only. Upload skipped.")
        return

    if not args.yes:
        print()
        print("About to upload local DB to PythonAnywhere:")
        print(f"  Local:  {db_path}")
        print(f"  Remote: {remote}:{args.remote_db}")
        answer = input("Type UPLOAD to continue: ").strip()
        if answer != "UPLOAD":
            print("Upload cancelled.")
            return

    backup_cmd = (
        f"cd {args.remote_project} && "
        "cp database/cafe_reports.db "
        "database/cafe_reports_before_auto_update_$(date +%Y%m%d_%H%M%S).db"
    )
    run(["ssh", remote, backup_cmd])

    run(["scp", str(db_path), f"{remote}:{args.remote_db}"])

    run(["ssh", remote, f"touch {args.remote_wsgi}"])

    verify_remote(args, summary_start)

    print()
    print("PythonAnywhere upload/reload complete.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Update local Vivonet data from latest imported date and optionally upload to PythonAnywhere."
    )
    parser.add_argument("--db", default=str(DEFAULT_DB), help=f"SQLite DB path. Default: {DEFAULT_DB}")
    parser.add_argument("--store", default="cafe", help="Store key passed to backfill_vivonet.py. Default: cafe")
    parser.add_argument("--start", type=parse_date, help="Override import start date, YYYYMMDD or YYYY-MM-DD")
    parser.add_argument(
        "--end-exclusive",
        type=parse_date,
        help="Override exclusive end date. Default: today, which imports through yesterday.",
    )
    parser.add_argument("--chunk-days", type=int, default=1, help="Vivonet API chunk size. Default: 1")
    parser.add_argument("--log-dir", default="data_audits", help="Directory for import logs. Default: data_audits")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without importing/uploading")

    parser.add_argument("--upload", action="store_true", help="Upload updated DB to PythonAnywhere and reload app")
    parser.add_argument("--yes", action="store_true", help="Skip upload confirmation prompt")
    parser.add_argument(
        "--verify-remote-only",
        action="store_true",
        help="Skip import/upload and only run remote DB verification (requires --start)",
    )

    parser.add_argument("--remote-user", default=DEFAULT_REMOTE_USER)
    parser.add_argument("--remote-host", default=DEFAULT_REMOTE_HOST)
    parser.add_argument("--remote-project", default=DEFAULT_REMOTE_PROJECT)
    parser.add_argument("--remote-db", default=DEFAULT_REMOTE_DB)
    parser.add_argument("--remote-wsgi", default=DEFAULT_REMOTE_WSGI)
    return parser


def main() -> int:
    args = build_parser().parse_args()

    if args.verify_remote_only:
        if not args.start:
            raise SystemExit("--verify-remote-only requires --start YYYYMMDD")
        verify_remote(args, args.start)
        return 0

    start_date, _ = local_update(args)
    if args.upload:
        upload_to_pythonanywhere(args, start_date)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
