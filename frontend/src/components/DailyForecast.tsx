import { useState, useEffect, useRef } from "react";
import ReportLayout, { type Column } from "./ReportLayout";
import { getDailyForecast } from "../utils/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Chart component for the daily forecast with 3D carousel
const ForecastChart = ({ data }: { data: Record<string, any>[] }) => {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxSales = Math.max(...data.map((item) => item.forecasted_sales), 1);

  // --- Group data by calendar week --- //
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  const daysLeftInThisWeek = dayOfWeek === 6 ? 7 : 7 - (dayOfWeek + 1);

  const weeks = [
    data.slice(0, daysLeftInThisWeek),
    data.slice(daysLeftInThisWeek, daysLeftInThisWeek + 7),
    data.slice(daysLeftInThisWeek + 7, daysLeftInThisWeek + 14),
  ].filter((week) => week.length > 0);

  // Navigation handlers
  const goToWeek = (index: number) => {
    if (index >= 0 && index < weeks.length && !isAnimating) {
      setIsAnimating(true);
      setCurrentWeek(index);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  const nextWeek = () => goToWeek(currentWeek + 1);
  const prevWeek = () => goToWeek(currentWeek - 1);

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

    if (isLeftSwipe) nextWeek();
    if (isRightSwipe) prevWeek();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevWeek();
      if (e.key === "ArrowRight") nextWeek();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentWeek]);

  // Function to get bar color based on sales intensity
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

  const getMondayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderWeek = (weekData: Record<string, any>[], weekIndex: number) => {
    if (!weekData || weekData.length === 0) return null;

    const fullWeek = Array.from({ length: 7 }, (_, i) => {
      const dayIndex = (i + 1) % 7;
      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
        dayIndex
      ];
      return weekData.find((d) => d.day_of_week.startsWith(dayName)) || null;
    });

    const title = `Week of ${getMondayDate(weekData[0]?.date)}`;
    const minBarHeight = 8;
    const maxBarHeight = 200;

    return (
      <div
        className="carousel-card"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backfaceVisibility: "hidden",
          transform: `
            rotateY(${(weekIndex - currentWeek) * 90}deg)
            translateZ(${Math.abs(weekIndex - currentWeek) * 50}px)
            scale(${weekIndex === currentWeek ? 1 : 0.85})
          `,
          opacity: weekIndex === currentWeek ? 1 : 0,
          pointerEvents: weekIndex === currentWeek ? "auto" : "none",
          transition: "all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          borderRadius: "16px",
          padding: "32px",
          boxShadow:
            weekIndex === currentWeek
              ? "0 20px 60px -10px rgba(0, 0, 0, 0.2), 0 10px 30px -5px rgba(0, 0, 0, 0.1)"
              : "0 10px 30px -5px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h4
          style={{
            fontSize: "18px",
            fontWeight: "600",
            color: "#1e293b",
            marginBottom: "24px",
            textAlign: "center",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            alignItems: "flex-end",
            gap: "12px",
            height: "260px",
            paddingBottom: "10px",
          }}
        >
          {fullWeek.map((item, index) => {
            const isWeekend = index === 5 || index === 6;

            if (!item) {
              return (
                <div
                  key={`placeholder-${index}`}
                  style={{
                    background: isWeekend ? "#f1f5f9" : "transparent",
                    borderRadius: "8px",
                  }}
                />
              );
            }

            const barHeight =
              minBarHeight +
              (item.forecasted_sales / maxSales) *
                (maxBarHeight - minBarHeight);
            const darkColor = getBarColor(item.forecasted_sales, "dark");
            const lightColor = getBarColor(item.forecasted_sales, "light");

            return (
              <div
                key={index}
                className="bar-container"
                style={{
                  background: isWeekend
                    ? "linear-gradient(to bottom, #f8fafc, #f1f5f9)"
                    : "transparent",
                  borderRadius: "10px",
                  padding: "8px 4px",
                  display: "flex",
                  flexDirection: "column-reverse",
                  height: "100%",
                  transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(-12px) scale(1.05)";
                  const bar = e.currentTarget.querySelector(
                    ".bar"
                  ) as HTMLElement;
                  if (bar)
                    bar.style.boxShadow =
                      "0 20px 40px -10px rgba(29, 78, 216, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
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
                    color: "#94a3b8",
                    marginTop: "6px",
                    textAlign: "center",
                    fontWeight: "500",
                  }}
                >
                  {item.day_of_week.substring(0, 3)}
                </div>
                <div
                  className="bar"
                  style={{
                    width: "100%",
                    height: `${barHeight}px`,
                    background: `linear-gradient(to top, ${darkColor} 0%, ${lightColor} 100%)`,
                    borderRadius: "10px 10px 4px 4px",
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
                      borderRadius: "10px 10px 0 0",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    fontWeight: "600",
                    marginBottom: "6px",
                    textAlign: "center",
                  }}
                >
                  ${item.forecasted_sales.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", backgroundColor: "transparent" }}>
      <h3
        style={{
          marginBottom: "32px",
          fontSize: "20px",
          fontWeight: "700",
          color: "#0f172a",
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        21-Day Sales Forecast
      </h3>

      {/* Carousel Container */}
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "relative",
          height: "420px",
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
          {weeks.map((week, index) => renderWeek(week, index))}
        </div>

        {/* Navigation Arrows */}
        {currentWeek > 0 && (
          <button
            onClick={prevWeek}
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

        {currentWeek < weeks.length - 1 && (
          <button
            onClick={nextWeek}
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
                currentWeek === 0
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

        {/* Peek effect - show edge of next card */}
        {currentWeek < weeks.length - 1 && (
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

      {/* Dot Indicators */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "12px",
          marginTop: "24px",
        }}
      >
        {weeks.map((_, index) => (
          <button
            key={index}
            onClick={() => goToWeek(index)}
            disabled={isAnimating}
            style={{
              width: index === currentWeek ? "32px" : "10px",
              height: "10px",
              borderRadius: "5px",
              background:
                index === currentWeek
                  ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                  : "#cbd5e1",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)",
              boxShadow:
                index === currentWeek
                  ? "0 2px 8px rgba(59, 130, 246, 0.4)"
                  : "none",
            }}
            onMouseEnter={(e) => {
              if (index !== currentWeek) {
                e.currentTarget.style.background = "#94a3b8";
                e.currentTarget.style.transform = "scale(1.2)";
              }
            }}
            onMouseLeave={(e) => {
              if (index !== currentWeek) {
                e.currentTarget.style.background = "#cbd5e1";
                e.currentTarget.style.transform = "scale(1)";
              }
            }}
            aria-label={`Go to week ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress Indicator */}
      <div
        style={{
          textAlign: "center",
          marginTop: "16px",
          fontSize: "14px",
          color: "#64748b",
          fontWeight: "500",
        }}
      >
        Week {currentWeek + 1} of {weeks.length}
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

export default function DailyForecast() {
  return (
    <ReportLayout
      title="21-Day Sales Forecast"
      fetchData={getDailyForecast}
      columns={[]}
      needsDateRange={false}
      ChartComponent={ForecastChart}
      enableCache={true}
      cacheKey="daily_forecast"
    />
  );
}