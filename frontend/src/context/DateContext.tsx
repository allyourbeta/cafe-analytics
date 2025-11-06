import { createContext, useContext, useState, ReactNode } from "react";

interface DateContextType {
  startDate: string;
  endDate: string;
  selectedPreset: string;
  setDateRange: (start: string, end: string, preset: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

// Helper to get today's date in YYYY-MM-DD format (local timezone)
const getTodayLocal = (): string => {
  const now = new Date();
  // Force local timezone by creating a new date with timezone offset
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().split("T")[0];
};

// Helper to get start of current quarter
const getQuarterStartDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0=Jan, 6=July, etc.

  let quarterStart: Date;

  if (month >= 6 && month <= 8) {
    // Q1: July-September
    quarterStart = new Date(year, 6, 1);
  } else if (month >= 9 && month <= 11) {
    // Q2: October-December
    quarterStart = new Date(year, 9, 1);
  } else if (month >= 0 && month <= 2) {
    // Q3: January-March
    quarterStart = new Date(year, 0, 1);
  } else {
    // Q4: April-June
    quarterStart = new Date(year, 3, 1);
  }

  return quarterStart.toISOString().split("T")[0];
};

export const DateProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with saved date range from sessionStorage (persists across refreshes, clears when browser closes)
  // Falls back to This Quarter if nothing saved
  const [startDate, setStartDate] = useState<string>(() => {
    const saved = sessionStorage.getItem('cafeDateRange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.startDate;
      } catch (e) {
        console.error('Error parsing saved date range:', e);
      }
    }
    return getQuarterStartDate();
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const saved = sessionStorage.getItem('cafeDateRange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.endDate;
      } catch (e) {
        console.error('Error parsing saved date range:', e);
      }
    }
    return getTodayLocal();
  });

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const saved = sessionStorage.getItem('cafeDateRange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.preset || "";
      } catch (e) {
        console.error('Error parsing saved date range:', e);
      }
    }
    return "This Quarter";
  });

  const setDateRange = (start: string, end: string, preset: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(preset);

    // Save to sessionStorage so it persists across page refreshes
    // (but clears when browser is closed - fresh start each day)
    try {
      sessionStorage.setItem('cafeDateRange', JSON.stringify({
        startDate: start,
        endDate: end,
        preset: preset
      }));
    } catch (e) {
      console.error('Error saving date range to sessionStorage:', e);
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