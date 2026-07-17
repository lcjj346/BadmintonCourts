"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { todaySgt } from "@/lib/time";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Month-grid date picker. Dates are plain "YYYY-MM-DD" strings throughout — no timezone math.
 *
 * `rangeFrom`/`rangeTo` (both inclusive, `rangeFrom <= rangeTo`) light up a whole span of days —
 * airline-style — instead of just the single `value` day, for a two-tap range pick. Omit both to
 * get the plain single-day highlight (e.g. DateField's one-date-at-a-time use).
 */
export function CalendarGrid({
  value, min, max, onSelect, rangeFrom, rangeTo,
}: {
  value: string;
  min: string;
  max: string;
  onSelect: (date: string) => void;
  rangeFrom?: string;
  rangeTo?: string;
}) {
  const [viewMonth, setViewMonth] = useState(() => dayjs(value || min).format("YYYY-MM"));
  const monthStart = dayjs(`${viewMonth}-01`);
  const today = todaySgt();

  const cells: (string | null)[] = [
    ...Array.from({ length: monthStart.day() }, () => null),
    ...Array.from({ length: monthStart.daysInMonth() }, (_, i) => monthStart.add(i, "day").format("YYYY-MM-DD")),
  ];

  const canPrev = monthStart.subtract(1, "month").endOf("month").format("YYYY-MM-DD") >= min;
  const canNext = monthStart.add(1, "month").startOf("month").format("YYYY-MM-DD") <= max;

  const navButton = "rounded-full p-2 text-court transition-colors hover:bg-court-light disabled:opacity-20 disabled:hover:bg-transparent";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => setViewMonth(monthStart.subtract(1, "month").format("YYYY-MM"))}
          className={navButton}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-court">{monthStart.format("MMMM YYYY")}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => setViewMonth(monthStart.add(1, "month").format("YYYY-MM"))}
          className={navButton}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-gray-400">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="py-1">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const disabled = d < min || d > max;
          const isEndpoint = rangeFrom ? d === rangeFrom || d === rangeTo : d === value;
          const inRange = Boolean(rangeFrom && rangeTo && d > rangeFrom && d < rangeTo);
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(d)}
              aria-label={dayjs(d).format("D MMMM YYYY")}
              aria-current={isToday ? "date" : undefined}
              className={`aspect-square rounded-full text-sm transition-colors ${
                isEndpoint
                  ? "bg-court font-semibold text-white"
                  : inRange
                    ? "bg-court-light font-semibold text-court"
                    : disabled
                      ? "cursor-not-allowed text-gray-300"
                      : `text-gray-700 hover:bg-court-light ${isToday ? "font-bold text-court ring-1 ring-inset ring-court" : ""}`
              }`}
            >
              {dayjs(d).date()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
