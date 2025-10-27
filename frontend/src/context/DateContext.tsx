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

export const DateProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with Aug 1, 2024 to today
  const [startDate, setStartDate] = useState("2024-08-01");
  const [endDate, setEndDate] = useState(getTodayLocal());
  const [selectedPreset, setSelectedPreset] = useState("");

  const setDateRange = (start: string, end: string, preset: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(preset);
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
