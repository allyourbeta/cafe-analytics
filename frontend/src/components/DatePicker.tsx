import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  selectedStart: string; // YYYY-MM-DD
  selectedEnd: string; // YYYY-MM-DD
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
}

// Days of week header - Monday first
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DatePicker({
  selectedStart,
  selectedEnd,
  onStartChange,
  onEndChange,
}: DatePickerProps) {
  // Parse the selected dates
  const startDate = selectedStart ? new Date(selectedStart + "T00:00:00") : null;
  const endDate = selectedEnd ? new Date(selectedEnd + "T00:00:00") : null;

  // Current month being viewed for each calendar
  const [startMonth, setStartMonth] = useState(startDate || new Date());
  const [endMonth, setEndMonth] = useState(endDate || addMonths(new Date(), 0));

  // Format date to YYYY-MM-DD for output
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Handle date click
  const handleDateClick = (date: Date, isStartCalendar: boolean) => {
    const dateStr = formatDateString(date);

    if (isStartCalendar) {
      onStartChange(dateStr);
      // If new start is after current end, clear end
      if (endDate && isAfter(date, endDate)) {
        onEndChange("");
      }
    } else {
      // End calendar
      if (startDate && isBefore(date, startDate)) {
        // If clicking before start, make this the new start
        onStartChange(dateStr);
        onEndChange("");
      } else {
        onEndChange(dateStr);
      }
    }
  };

  // Generate calendar days for a month (Monday-first weeks)
  const generateCalendarDays = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // Start from Monday of the week containing the first day
    // weekStartsOn: 1 means Monday
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let current = calendarStart;

    while (current <= calendarEnd) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  };

  // Render a single calendar
  const renderCalendar = (
    currentMonth: Date,
    setCurrentMonth: (d: Date) => void,
    isStartCalendar: boolean
  ) => {
    const days = generateCalendarDays(currentMonth);

    return (
      <div style={{ width: "240px" }}>
        {/* Month navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#F3F4F6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            type="button"
          >
            <ChevronLeft
              style={{ width: "16px", height: "16px", color: "#4B5563" }}
            />
          </button>
          <span
            style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}
          >
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "4px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#F3F4F6")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            type="button"
          >
            <ChevronRight
              style={{ width: "16px", height: "16px", color: "#4B5563" }}
            />
          </button>
        </div>

        {/* Weekday headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginBottom: "4px",
          }}
        >
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                fontSize: "11px",
                fontWeight: "500",
                color: "#6B7280",
                padding: "4px 0",
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2px",
          }}
        >
          {days.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isStart = startDate && isSameDay(day, startDate);
            const isEnd = endDate && isSameDay(day, endDate);
            const isInRange =
              startDate &&
              endDate &&
              isWithinInterval(day, { start: startDate, end: endDate });
            const isToday = isSameDay(day, new Date());

            let backgroundColor = "transparent";
            let color = "#374151";
            let fontWeight = "normal";
            let border = "none";

            if (!isCurrentMonth) {
              color = "#D1D5DB";
            } else if (isStart || isEnd) {
              backgroundColor = "#F97316";
              color = "white";
              fontWeight = "600";
            } else if (isInRange) {
              backgroundColor = "#FED7AA";
              color = "#9A3412";
            } else if (isToday) {
              border = "1px solid #F97316";
              color = "#F97316";
              fontWeight = "500";
            }

            return (
              <button
                key={index}
                type="button"
                onClick={() => isCurrentMonth && handleDateClick(day, isStartCalendar)}
                disabled={!isCurrentMonth}
                style={{
                  height: "32px",
                  width: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  borderRadius: "4px",
                  cursor: isCurrentMonth ? "pointer" : "default",
                  backgroundColor,
                  color,
                  fontWeight,
                  border,
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (isCurrentMonth && !isStart && !isEnd && !isInRange) {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                  }
                }}
                onMouseLeave={(e) => {
                  if (isCurrentMonth && !isStart && !isEnd && !isInRange) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {format(day, "d")}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", gap: "24px" }}>
      {/* Start Date Calendar */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: "12px",
            color: "#6B7280",
            marginBottom: "8px",
            fontWeight: "500",
          }}
        >
          Start Date
          {startDate && (
            <span style={{ marginLeft: "8px", color: "#F97316" }}>
              {format(startDate, "MMM d, yyyy")}
            </span>
          )}
        </label>
        {renderCalendar(startMonth, setStartMonth, true)}
      </div>

      {/* End Date Calendar */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: "12px",
            color: "#6B7280",
            marginBottom: "8px",
            fontWeight: "500",
          }}
        >
          End Date
          {endDate && (
            <span style={{ marginLeft: "8px", color: "#F97316" }}>
              {format(endDate, "MMM d, yyyy")}
            </span>
          )}
        </label>
        {renderCalendar(endMonth, setEndMonth, false)}
      </div>
    </div>
  );
}