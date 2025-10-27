import { createContext, useContext, useState, ReactNode } from "react";

interface DateContextType {
  startDate: string;
  endDate: string;
  selectedPreset: string;
  setDateRange: (start: string, end: string, preset: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export const DateProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with Aug 1, 2024 to today
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const todayLocal = `${year}-${month}-${day}`;

  const [startDate, setStartDate] = useState("2024-08-01");
  const [endDate, setEndDate] = useState(todayLocal);
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
