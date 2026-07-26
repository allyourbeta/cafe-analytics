/**
 * Relative date presets.
 *
 * These are RULES, not dates. "Today" means whatever today is at the moment
 * you resolve it. Nothing here stores a resolved date, and nothing here
 * imports React or touches storage — it is a pure function module so both
 * DateContext and Dashboard can call it and always agree.
 *
 * Fiscal year starts July 1.
 * Quarters follow that FY: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun.
 */

export const PRESETS = [
  "Today",
  "Yesterday",
  "This Week",
  "Last Week",
  "This Month",
  "Last Month",
  "This Quarter",
  "Last Quarter",
  "This FY",
  "Last FY",
] as const;

export type Preset = (typeof PRESETS)[number];

/** The preset used when nothing has been chosen yet. */
export const DEFAULT_PRESET: Preset = "This Quarter";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

/** Narrowing guard so a stored string can be trusted as a known preset. */
export function isPreset(value: unknown): value is Preset {
  return (
    typeof value === "string" && (PRESETS as readonly string[]).includes(value)
  );
}

/** Format a Date as YYYY-MM-DD using local calendar fields, never UTC. */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** First day of the fiscal quarter containing `date`. */
function quarterStart(date: Date): Date {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = January

  if (month >= 6 && month <= 8) return new Date(year, 6, 1); // Q1 Jul-Sep
  if (month >= 9 && month <= 11) return new Date(year, 9, 1); // Q2 Oct-Dec
  if (month <= 2) return new Date(year, 0, 1); // Q3 Jan-Mar
  return new Date(year, 3, 1); // Q4 Apr-Jun
}

/**
 * Resolve a preset against a reference date.
 *
 * `now` is injectable so tests can pin a date instead of depending on the
 * clock. Production callers omit it and get the real current date.
 */
export function calculatePresetDates(
  preset: string,
  now: Date = new Date()
): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const year = today.getFullYear();
  const month = today.getMonth();

  let start: Date;
  let end: Date;

  switch (preset) {
    case "Today":
      start = today;
      end = today;
      break;

    case "Yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      start = yesterday;
      end = yesterday;
      break;
    }

    case "This Week": {
      // Week starts Monday. getDay() is 0 for Sunday.
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(today);
      start.setDate(start.getDate() - daysToMonday);
      end = today;
      break;
    }

    case "Last Week": {
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start = new Date(today);
      start.setDate(start.getDate() - daysToMonday - 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    }

    case "This Month":
      start = new Date(year, month, 1);
      end = today;
      break;

    case "Last Month":
      start = new Date(year, month - 1, 1);
      end = new Date(year, month, 0); // day 0 = last day of previous month
      break;

    case "This Quarter":
      start = quarterStart(today);
      end = today;
      break;

    case "Last Quarter": {
      const thisQuarterStart = quarterStart(today);
      // One day before this quarter began lands inside the previous quarter.
      end = new Date(thisQuarterStart);
      end.setDate(end.getDate() - 1);
      start = quarterStart(end);
      break;
    }

    case "This FY": {
      // FY begins July 1. Before July, we are still in the FY that began last year.
      const fyStartYear = month >= 6 ? year : year - 1;
      start = new Date(fyStartYear, 6, 1);
      end = today;
      break;
    }

    case "Last FY": {
      const fyStartYear = month >= 6 ? year : year - 1;
      start = new Date(fyStartYear - 1, 6, 1); // July 1, previous FY
      end = new Date(fyStartYear, 5, 30); // June 30, previous FY
      break;
    }

    default:
      return { start: "", end: "" };
  }

  return { start: formatLocalDate(start), end: formatLocalDate(end) };
}
