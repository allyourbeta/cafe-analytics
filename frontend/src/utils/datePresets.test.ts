import { describe, it, expect } from "vitest";
import {
  PRESETS,
  calculatePresetDates,
  formatLocalDate,
  isPreset,
} from "./datePresets";

/**
 * These tests pin a reference date rather than reading the clock, so they
 * produce the same result on any machine on any day. That is the whole reason
 * calculatePresetDates takes an optional `now` argument.
 *
 * Month numbers in `new Date(y, m, d)` are zero-based: 6 is July.
 */

// Sunday, July 26 2026. Chosen deliberately:
//  - Sunday is the hard case for a Monday-start week.
//  - July is the first month of both the fiscal year and Q1.
const SUNDAY_JUL_26 = new Date(2026, 6, 26);

describe("formatLocalDate", () => {
  it("formats using local calendar fields, not UTC", () => {
    expect(formatLocalDate(new Date(2026, 6, 4))).toBe("2026-07-04");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatLocalDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });

  it("does not shift the date late in the evening", () => {
    // A naive toISOString() here would roll forward to the 5th in any timezone
    // west of UTC. This is the bug the helper exists to prevent.
    expect(formatLocalDate(new Date(2026, 6, 4, 23, 30))).toBe("2026-07-04");
  });
});

describe("isPreset", () => {
  it("accepts every name in PRESETS", () => {
    for (const preset of PRESETS) {
      expect(isPreset(preset)).toBe(true);
    }
  });

  it("rejects unknown or malformed values", () => {
    expect(isPreset("Custom")).toBe(false);
    expect(isPreset("")).toBe(false);
    expect(isPreset(null)).toBe(false);
    expect(isPreset(42)).toBe(false);
  });
});

describe("calculatePresetDates on Sunday July 26 2026", () => {
  const cases: Array<[string, string, string]> = [
    ["Today", "2026-07-26", "2026-07-26"],
    ["Yesterday", "2026-07-25", "2026-07-25"],
    // Week starts Monday, so Sunday is the LAST day of the current week.
    ["This Week", "2026-07-20", "2026-07-26"],
    ["Last Week", "2026-07-13", "2026-07-19"],
    ["This Month", "2026-07-01", "2026-07-26"],
    ["Last Month", "2026-06-01", "2026-06-30"],
    ["This Quarter", "2026-07-01", "2026-07-26"],
    ["Last Quarter", "2026-04-01", "2026-06-30"],
    ["This FY", "2026-07-01", "2026-07-26"],
    ["Last FY", "2025-07-01", "2026-06-30"],
  ];

  it.each(cases)("%s resolves to %s .. %s", (preset, start, end) => {
    expect(calculatePresetDates(preset, SUNDAY_JUL_26)).toEqual({ start, end });
  });

  it("covers every preset the UI offers", () => {
    expect(cases.map(([preset]) => preset)).toEqual([...PRESETS]);
  });
});

describe("week boundaries", () => {
  it("on a Monday, This Week starts and ends the same day", () => {
    const monday = new Date(2026, 6, 20);
    expect(calculatePresetDates("This Week", monday)).toEqual({
      start: "2026-07-20",
      end: "2026-07-20",
    });
  });

  it("on a Monday, Last Week is the full preceding Mon-Sun", () => {
    const monday = new Date(2026, 6, 20);
    expect(calculatePresetDates("Last Week", monday)).toEqual({
      start: "2026-07-13",
      end: "2026-07-19",
    });
  });

  it("a week spanning a month boundary keeps both months", () => {
    const wednesday = new Date(2026, 7, 5); // Wed Aug 5 2026
    expect(calculatePresetDates("This Week", wednesday)).toEqual({
      start: "2026-08-03",
      end: "2026-08-05",
    });
  });
});

describe("month and year boundaries", () => {
  it("Yesterday crosses into the previous month", () => {
    const firstOfMonth = new Date(2026, 7, 1);
    expect(calculatePresetDates("Yesterday", firstOfMonth)).toEqual({
      start: "2026-07-31",
      end: "2026-07-31",
    });
  });

  it("Yesterday crosses into the previous year", () => {
    const newYearsDay = new Date(2026, 0, 1);
    expect(calculatePresetDates("Yesterday", newYearsDay)).toEqual({
      start: "2025-12-31",
      end: "2025-12-31",
    });
  });

  it("Last Month in January is the previous December", () => {
    const january = new Date(2026, 0, 15);
    expect(calculatePresetDates("Last Month", january)).toEqual({
      start: "2025-12-01",
      end: "2025-12-31",
    });
  });

  it("Last Month handles a leap February", () => {
    const march = new Date(2024, 2, 10);
    expect(calculatePresetDates("Last Month", march)).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
  });
});

describe("fiscal quarters", () => {
  // Q1 Jul-Sep, Q2 Oct-Dec, Q3 Jan-Mar, Q4 Apr-Jun.
  it("Q2: This Quarter is Oct-Dec", () => {
    const november = new Date(2026, 10, 15);
    expect(calculatePresetDates("This Quarter", november)).toEqual({
      start: "2026-10-01",
      end: "2026-11-15",
    });
  });

  it("Q3: This Quarter is Jan-Mar", () => {
    const february = new Date(2026, 1, 10);
    expect(calculatePresetDates("This Quarter", february)).toEqual({
      start: "2026-01-01",
      end: "2026-02-10",
    });
  });

  it("Q3: Last Quarter reaches back into the previous year", () => {
    const february = new Date(2026, 1, 10);
    expect(calculatePresetDates("Last Quarter", february)).toEqual({
      start: "2025-10-01",
      end: "2025-12-31",
    });
  });

  it("Q4: Last Quarter is Jan-Mar", () => {
    const may = new Date(2026, 4, 20);
    expect(calculatePresetDates("Last Quarter", may)).toEqual({
      start: "2026-01-01",
      end: "2026-03-31",
    });
  });

  it("on the first day of a quarter, Last Quarter is the whole prior quarter", () => {
    const octoberFirst = new Date(2026, 9, 1);
    expect(calculatePresetDates("Last Quarter", octoberFirst)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
    });
  });
});

describe("fiscal years", () => {
  it("June 30 is still the FY that began the previous July", () => {
    const juneThirty = new Date(2026, 5, 30);
    expect(calculatePresetDates("This FY", juneThirty)).toEqual({
      start: "2025-07-01",
      end: "2026-06-30",
    });
  });

  it("July 1 starts a new FY", () => {
    const julyFirst = new Date(2026, 6, 1);
    expect(calculatePresetDates("This FY", julyFirst)).toEqual({
      start: "2026-07-01",
      end: "2026-07-01",
    });
  });

  it("Last FY before July reaches back two calendar years", () => {
    const march = new Date(2026, 2, 15);
    expect(calculatePresetDates("Last FY", march)).toEqual({
      start: "2024-07-01",
      end: "2025-06-30",
    });
  });
});

describe("unknown presets", () => {
  it("returns empty strings rather than throwing", () => {
    expect(calculatePresetDates("Custom", SUNDAY_JUL_26)).toEqual({
      start: "",
      end: "",
    });
  });
});

describe("regression: presets are rules, not stored dates", () => {
  /**
   * This is the bug that prompted the rewrite. A preset was resolved once at
   * click time and the resulting dates were persisted. Days later the label
   * still said "Today" while the dates pointed at the day it was clicked.
   *
   * Resolving the same preset against two different reference dates must give
   * two different answers. If this test ever fails, the rule has been frozen
   * into a value again somewhere.
   */
  it("Today follows the reference date", () => {
    const jul22 = calculatePresetDates("Today", new Date(2026, 6, 22));
    const jul26 = calculatePresetDates("Today", new Date(2026, 6, 26));

    expect(jul22).toEqual({ start: "2026-07-22", end: "2026-07-22" });
    expect(jul26).toEqual({ start: "2026-07-26", end: "2026-07-26" });
    expect(jul22).not.toEqual(jul26);
  });

  it("every relative preset moves when the reference date moves", () => {
    // Six months apart guarantees a different answer for every preset,
    // including the quarter and fiscal-year ones.
    const winter = new Date(2026, 0, 15);
    const summer = new Date(2026, 6, 15);

    for (const preset of PRESETS) {
      expect(calculatePresetDates(preset, winter)).not.toEqual(
        calculatePresetDates(preset, summer)
      );
    }
  });
});
