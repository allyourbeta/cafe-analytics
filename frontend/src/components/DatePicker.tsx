import { useEffect, useState } from "react";
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

  // Current month being viewed. The second calendar always shows the next month.
  // This keeps the two-month range picker from showing the same month twice.
  const [viewMonth, setViewMonth] = useState(startDate || endDate || new Date());

  // Jump the viewport to the start month whenever the start date changes (preset click or a
  // fresh start-date click). Deliberately does NOT react to end-date-only changes: once a start
  // date is set, the user may navigate several months forward to pick an end date, and snapping
  // the viewport back to the start month right after that click would hide the date they just picked.
  useEffect(() => {
    if (selectedStart) {
      setViewMonth(startOfMonth(new Date(selectedStart + "T00:00:00")));
    } else if (selectedEnd) {
      setViewMonth(startOfMonth(new Date(selectedEnd + "T00:00:00")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStart]);

  // Format date to YYYY-MM-DD for output
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Handle date click. This behaves like a standard range picker:
  // first click starts a new range, second click sets the inclusive end date.
  const handleDateClick = (date: Date) => {
    const dateStr = formatDateString(date);

    if (!startDate || endDate) {
      onStartChange(dateStr);
      onEndChange("");
      return;
    }

    if (isBefore(date, startDate)) {
      onStartChange(dateStr);
      onEndChange("");
    } else {
      onEndChange(dateStr);
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

  // Render a single calendar month. The two visible calendars are adjacent months,
  // not separate "start" and "end" calendars.
  const renderCalendar = (
    currentMonth: Date,
    showPreviousButton: boolean,
    showNextButton: boolean
  ) => {
    const days = generateCalendarDays(currentMonth);
    const hasValidRange = Boolean(
      startDate && endDate && !isBefore(endDate, startDate)
    );

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
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              cursor: showPreviousButton ? "pointer" : "default",
              borderRadius: "4px",
              visibility: showPreviousButton ? "visible" : "hidden",
            }}
            onMouseEnter={(e) => {
              if (showPreviousButton) {
                e.currentTarget.style.backgroundColor = "#F3F4F6";
              }
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            type="button"
            aria-label="Previous month"
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
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            style={{
              padding: "4px",
              background: "none",
              border: "none",
              cursor: showNextButton ? "pointer" : "default",
              borderRadius: "4px",
              visibility: showNextButton ? "visible" : "hidden",
            }}
            onMouseEnter={(e) => {
              if (showNextButton) {
                e.currentTarget.style.backgroundColor = "#F3F4F6";
              }
            }}
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
            type="button"
            aria-label="Next month"
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
              hasValidRange &&
              startDate !== null &&
              endDate !== null &&
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
                onClick={() => isCurrentMonth && handleDateClick(day)}
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
    <div>
      {/* Selected range summary */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginBottom: "12px",
        }}
      >
        <div style={{ width: "240px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "#6B7280",
              fontWeight: "500",
            }}
          >
            Start Date
          </span>
          {startDate && (
            <span style={{ marginLeft: "8px", color: "#F97316", fontSize: "12px" }}>
              {format(startDate, "MMM d, yyyy")}
            </span>
          )}
        </div>
        <div style={{ width: "240px" }}>
          <span
            style={{
              fontSize: "12px",
              color: "#6B7280",
              fontWeight: "500",
            }}
          >
            End Date
          </span>
          {endDate && (
            <span style={{ marginLeft: "8px", color: "#F97316", fontSize: "12px" }}>
              {format(endDate, "MMM d, yyyy")}
            </span>
          )}
        </div>
      </div>

      {/* Two adjacent calendar months */}
      <div style={{ display: "flex", gap: "24px" }}>
        {renderCalendar(viewMonth, true, false)}
        {renderCalendar(addMonths(viewMonth, 1), false, true)}
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "11px",
          color: "#6B7280",
        }}
      >
        Click a start date, then click an inclusive end date.
      </div>
    </div>
  );
}