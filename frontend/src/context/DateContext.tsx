import { createContext, useContext, useState, ReactNode } from 'react';

interface DateContextType {
  startDate: string;
  endDate: string;
  selectedPreset: string;
  setDateRange: (start: string, end: string, preset: string) => void;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export const DateProvider = ({ children }: { children: ReactNode }) => {
  // Initialize with "Last 30 Days"
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [selectedPreset, setSelectedPreset] = useState('Last 30 Days');

  const setDateRange = (start: string, end: string, preset: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset(preset);
  };

  return (
    <DateContext.Provider value={{ startDate, endDate, selectedPreset, setDateRange }}>
      {children}
    </DateContext.Provider>
  );
};

export const useDateRange = () => {
  const context = useContext(DateContext);
  if (!context) {
    throw new Error('useDateRange must be used within DateProvider');
  }
  return context;
};
