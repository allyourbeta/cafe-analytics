import { createContext, useContext, useState, type ReactNode } from "react";
import {
  DEFAULT_PRESET,
  calculatePresetDates,
  isPreset,
} from "../utils/datePresets";

interface DateContextType {
  startDate: string;
  endDate: string;
  selectedPreset: string;
  setDateRange: (start: string, end: string, preset: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

// Bumped from "cafeDateRange". The old key stored resolved dates alongside a
// preset label, so a tab left open across days would restore "Today" pointing
// at a stale date. Changing the key retires those entries safely.
const STORAGE_KEY = "cafeDateRange.v2";
const LEGACY_STORAGE_KEY = "cafeDateRange";

/**
 * What we persist.
 *
 * A preset is stored as the RULE only. Its dates are recomputed on every load,
 * so "Today" can never drift. A hand-picked range has no rule behind it, so
 * there we store the dates themselves.
 */
type SavedRange =
  | { kind: "preset"; preset: string }
  | { kind: "custom"; startDate: string; endDate: string };

interface InitialState {
  startDate: string;
  endDate: string;
  selectedPreset: string;
}

function readSaved(): SavedRange | null {
  try {
    // One-time cleanup of the pre-v2 entry.
    sessionStorage.removeItem(LEGACY_STORAGE_KEY);

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedRange;

    if (parsed?.kind === "preset" && isPreset(parsed.preset)) {
      return parsed;
    }
    if (parsed?.kind === "custom" && parsed.startDate && parsed.endDate) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.error("Error reading saved date range:", e);
    return null;
  }
}

/** Resolve what the app should show on this load. */
function getInitialState(): InitialState {
  const saved = readSaved();

  if (saved?.kind === "custom") {
    return {
      startDate: saved.startDate,
      endDate: saved.endDate,
      selectedPreset: "",
    };
  }

  // Either a saved preset or the default. Both resolve against today's date.
  const preset = saved?.kind === "preset" ? saved.preset : DEFAULT_PRESET;
  const { start, end } = calculatePresetDates(preset);
  return { startDate: start, endDate: end, selectedPreset: preset };
}

export const DateProvider = ({ children }: { children: ReactNode }) => {
  // Computed once, then split across the three pieces of state, so all three
  // always describe the same range.
  const [initial] = useState<InitialState>(getInitialState);

  const [startDate, setStartDate] = useState<string>(initial.startDate);
  const [endDate, setEndDate] = useState<string>(initial.endDate);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    initial.selectedPreset
  );

  const setDateRange = (start: string, end: string, preset: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(preset);

    const toSave: SavedRange = isPreset(preset)
      ? { kind: "preset", preset }
      : { kind: "custom", startDate: start, endDate: end };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error("Error saving date range to sessionStorage:", e);
    }
  };

  return (
    <DateContext.Provider
      value={{ startDate, endDate, selectedPreset, setDateRange }}
    >
      {children}
    </DateContext.Provider>
  );
};

export const useDateRange = () => {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error("useDateRange must be used within DateProvider");
  }
  return context;
};
