import { useState, useEffect, useRef } from "react";
import ReportLayout, { type Column } from "./ReportLayout";
import { getHourlyForecast } from "../utils/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Chart component for the hourly forecast with 3D carousel
const HourlyChart = ({ data }: { data: Record<string, any>[] }) => {
  const [currentDay, setCurrentDay] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group data by calendar week
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  const daysLeftInThisWeek = dayOfWeek === 6 ? 7 : 7 - (dayOfWeek + 1);

  const days = [
    data.slice(0, daysLeftInThisWeek),
    data.slice(daysLeftInThisWeek, daysLeftInThisWeek + 7),
    data.slice(daysLeftInThisWeek + 7, daysLeftInThisWeek + 14),
  ].filter((week) => week.length > 0);

  // Calculate max sales across ALL hourly data for consistent scaling
  const maxSales = Math.max(
    ...data.flatMap((day) => day.hourly_data.map((h: any) => h.avg_sales)),
    1
  );

  // Navigation handlers
  const goToDay = (index: number) => {
    if (index >= 0 && index < days.length && !isAnimating) {
      setIsAnimating(true);
      setCurrentDay(index);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  const nextDay = () => goToDay(currentDay + 1);
  const prevDay = () => goToDay(currentDay - 1);

  // Touch handlers for swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) nextDay();
    if (isRightSwipe) prevDay();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevDay();
      if (e.key === "ArrowRight") nextDay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentDay]);

  // Function to get bar color based on sales intensity (heatmap effect)
  const getBarColor = (revenue: number, type: "light" | "dark") => {
    if (revenue <= 0) return "#e5e7eb";
    const intensity = Math.min(revenue / maxSales, 1);

    const baseLight = { r: 219, g: 234, b: 254 };
    const baseDark = { r: 29, g: 78, b: 216 };

    const r = Math.round(baseLight.r + (baseDark.r - baseLight.r) * intensity);
    const g = Math.round(baseLight.g + (baseDark.g - baseLight.g) * intensity);
    const b = Math.round(baseLight.b + (baseDark.b - baseLight.b) * intensity);

    if (type === "light") {
      return `rgb(${Math.min(r + 40, 255)}, ${Math.min(
        g + 40,
        255
      )}, ${Math.min(b + 40, 255)})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getDateLabel = (dateStr: string, dayOfWeek: string) => {
    const date = new Date(dateStr);
    return `${dayOfWeek}, ${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`;
  };

  const renderDay = (weekData: Record<string, any>[], dayIndex: number) => {
    if (!weekData || weekData.length === 0) return null;

    const minBarHeight = 8;
    const maxBarHeight = 180;

    return (
      <div
        key={dayIndex}
        className="carousel-card"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          transform: `
            rotateY(${(dayIndex - currentDay) * 90}deg)
            translateZ(${Math.abs(dayIndex - currentDay) * 50}px)
            scale(${dayIndex === currentDay ? 1 : 0.85})
          `,
          opacity: dayIndex === currentDay ? 1 : 0,
          pointerEvents: dayIndex === currentDay ? "auto" : "none",
          transition: "all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow:
            dayIndex === currentDay
              ? "0 20px 60px -10px rgba(0, 0, 0, 0.2), 0 10px 30px -5px rgba(0, 0, 0, 0.1)"
              : "0 10px 30px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        {weekData.map((dayData, idx) => {
          const isWeekend =
            dayData.day_of_week === "Saturday" ||
            dayData.day_of_week === "Sunday";

          return (
            <div
              key={idx}
              style={{ marginBottom: idx < weekData.length - 1 ? "16px" : "0" }}
            >
              {/* Day name - simple label */}
              <div style={{ marginBottom: "8px" }}>
                <h4
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#374151",
                    margin: 0,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {getDateLabel(dayData.date, dayData.day_of_week)}
                </h4>
              </div>
              {/* Chart section */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "8px",
                  height: "220px",
                  borderBottom: "2px solid #e5e7eb",
                  paddingBottom: "10px",
                  background: isWeekend
                    ? "linear-gradient(to bottom, #faf5ff, #f3e8ff)"
                    : "#ffffff",
                  borderRadius: "0 0 12px 12px",
                  padding: "20px 8px 10px 8px",
                }}
              >
                {dayData.hourly_data.map((item: any, hourIdx: number) => {
                  const barHeight =
                    minBarHeight +
                    (item.avg_sales / maxSales) * (maxBarHeight - minBarHeight);

                  const darkColor = getBarColor(item.avg_sales, "dark");
                  const lightColor = getBarColor(item.avg_sales, "light");

                  return (
                    <div
                      key={hourIdx}
                      className="hour-container"
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                        borderRadius: "6px",
                        padding: "4px 2px",
                        transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-8px)";
                        const bar = e.currentTarget.querySelector(
                          ".bar"
                        ) as HTMLElement;
                        if (bar)
                          bar.style.boxShadow =
                            "0 20px 40px -10px rgba(29, 78, 216, 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        const bar = e.currentTarget.querySelector(
                          ".bar"
                        ) as HTMLElement;
                        if (bar)
                          bar.style.boxShadow =
                            "0 10px 25px -5px rgba(0, 0, 0, 0.15)";
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#475569",
                          fontWeight: "600",
                          marginBottom: "2px",
                        }}
                      >
                        ${item.avg_sales.toFixed(0)}
                      </div>
                      <div
                        className="bar"
                        style={{
                          width: "100%",
                          height: `${barHeight}px`,
                          background: `linear-gradient(to top, ${darkColor} 0%, ${lightColor} 100%)`,
                          borderRadius: "6px 6px 0 0",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
                          transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: "40%",
                            background:
                              "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)",
                            borderRadius: "6px 6px 0 0",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#94a3b8",
                          marginTop: "2px",
                          fontWeight: "500",
                        }}
                      >
                        {item.hour.split(":")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Reusable navigation bar component
  const NavigationBar = () => (
    <div
      style={{
        position: "sticky",
        top: "0",
        zIndex: 20,
        background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
        borderRadius: "12px",
        padding: "12px 24px",
        boxShadow:
          "0 4px 20px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
        border: "2px solid #f1f5f9",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        {days.map((_, index) => (
          <button
            key={index}
            onClick={() => goToDay(index)}
            disabled={isAnimating}
            style={{
              padding: "8px 28px",
              borderRadius: "10px",
              background:
                index === currentDay
                  ? "linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
                  : "#f1f5f9",
              border:
                index === currentDay
                  ? "2px solid #fb923c"
                  : "2px solid #e2e8f0",
              color: index === currentDay ? "#ffffff" : "#64748b",
              fontSize: "16px",
              fontWeight: "700",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
              boxShadow:
                index === currentDay
                  ? "0 4px 16px rgba(249, 115, 22, 0.4), 0 2px 8px rgba(249, 115, 22, 0.2)"
                  : "0 2px 6px rgba(0, 0, 0, 0.05)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              minWidth: "120px",
            }}
            onMouseEnter={(e) => {
              if (index !== currentDay) {
                e.currentTarget.style.background = "#e2e8f0";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(0, 0, 0, 0.1)";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }
            }}
            onMouseLeave={(e) => {
              if (index !== currentDay) {
                e.currentTarget.style.background = "#f1f5f9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 2px 6px rgba(0, 0, 0, 0.05)";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }
            }}
            aria-label={`Go to week ${index + 1}`}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                justifyContent: "center",
              }}
            >
              {index > 0 && index === currentDay && (
                <ChevronLeft size={18} strokeWidth={3} />
              )}
              <span>Week {index + 1}</span>
              {index < days.length - 1 && index === currentDay && (
                <ChevronRight size={18} strokeWidth={3} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "20px", backgroundColor: "transparent" }}>
      {/* Top Navigation Bar */}
      <div style={{ marginBottom: "24px" }}>
        <NavigationBar />
      </div>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          height: days[currentDay]
            ? `${days[currentDay].length * 280}px`
            : "840px",
          perspective: "2000px",
          perspectiveOrigin: "50% 50%",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
          }}
        >
          {days.map((week, index) => renderDay(week, index))}
        </div>

        {/* Navigation Arrows */}
        {currentDay > 0 && (
          <button
            onClick={prevDay}
            disabled={isAnimating}
            className="nav-arrow nav-arrow-left"
            style={{
              position: "absolute",
              left: "-20px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
              border: "2px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s ease",
              zIndex: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
              e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(-50%) scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
            }}
          >
            <ChevronLeft size={24} color="#475569" strokeWidth={2.5} />
          </button>
        )}

        {currentDay < days.length - 1 && (
          <button
            onClick={nextDay}
            disabled={isAnimating}
            className="nav-arrow nav-arrow-right"
            style={{
              position: "absolute",
              right: "-20px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
              border: "2px solid #e2e8f0",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s ease",
              zIndex: 10,
              animation:
                currentDay === 0
                  ? "gentle-bounce 2s ease-in-out infinite"
                  : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-50%) scale(1.1)";
              e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(0, 0, 0, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(-50%) scale(1)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.1)";
            }}
          >
            <ChevronRight size={24} color="#475569" strokeWidth={2.5} />
          </button>
        )}

        {/* Peek effect */}
        {currentDay < days.length - 1 && (
          <div
            style={{
              position: "absolute",
              right: "0",
              top: "50%",
              transform: "translateY(-50%)",
              width: "30px",
              height: "80%",
              background:
                "linear-gradient(to left, rgba(148, 163, 184, 0.1), transparent)",
              borderRadius: "16px 0 0 16px",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div style={{ marginTop: "24px" }}>
        <NavigationBar />
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes gentle-bounce {
          0%, 100% {
            transform: translateY(-50%) translateX(0);
          }
          50% {
            transform: translateY(-50%) translateX(4px);
          }
        }
      `}</style>
    </div>
  );
};

export default function HourlyForecast() {
  return (
    <ReportLayout
      title="Hourly Sales Forecast (15-21 Days)"
      fetchData={getHourlyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={HourlyChart}
      enableCache={true}
      cacheKey="hourly_forecast"
    />
  );
}
