"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { BottomSheet } from "@/components/BottomSheet";
import { CalendarGrid } from "@/components/CalendarGrid";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

function daysBetween(from: string, to: string): string[] {
  const range: string[] = [];
  for (let cur = dayjs(from); cur.isBefore(dayjs(to)) || cur.isSame(dayjs(to)); cur = cur.add(1, "day")) {
    range.push(cur.format("YYYY-MM-DD"));
  }
  return range;
}

export function DateStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.getAll("date");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Airline-calendar-style two-tap range: first tap sets rangeStart (lights up
  // immediately so it's obvious it registered), second tap sets rangeEnd and lights
  // up the whole span between them. Nothing is applied to the board until the user
  // taps "Use…" — picking is otherwise easy to mistake for silently doing nothing.
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);

  const days = Array.from({ length: 14 }, (_, i) =>
    dayjs(todaySgt()).add(i, "day").format("YYYY-MM-DD"),
  );

  function setDates(dates: string[]) {
    const next = new URLSearchParams(params);
    next.delete("date");
    for (const d of dates) next.append("date", d);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function toggle(date: string) {
    setDates(selected.includes(date) ? selected.filter((d) => d !== date) : [...selected, date]);
  }

  function openPicker() {
    setRangeStart(null);
    setRangeEnd(null);
    setPickerOpen(true);
  }

  function pickInCalendar(d: string) {
    // A tap after a range is already complete starts a fresh pick, same as re-opening.
    if (!rangeStart || rangeEnd) {
      setRangeStart(d);
      setRangeEnd(null);
      return;
    }
    setRangeEnd(d);
  }

  const from = rangeStart && rangeEnd && rangeEnd < rangeStart ? rangeEnd : rangeStart;
  const to = rangeStart && rangeEnd && rangeEnd < rangeStart ? rangeStart : rangeEnd;
  const pendingRange = from && to ? daysBetween(from, to) : null;

  function applyPick() {
    if (!rangeStart) return;
    setDates(pendingRange ?? [rangeStart]);
    setPickerOpen(false);
    setRangeStart(null);
    setRangeEnd(null);
  }

  const pillClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
      active
        ? "border-court bg-court text-white hover:bg-court/90"
        : "border-gray-300 bg-white hover:border-court hover:bg-court-light/60"
    }`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-3">
      <button
        type="button"
        onClick={openPicker}
        className="relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-court bg-court-light px-3 py-1 text-sm font-medium text-court shadow-sm transition-colors hover:bg-court hover:text-white active:bg-court active:text-white"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="17" rx="3" />
          <path d="M16 2.5v5M8 2.5v5M3 10.5h18" />
          <path d="M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01" />
        </svg>
        Pick
      </button>
      <button onClick={() => setDates([])} className={pillClass(selected.length === 0)}>
        All
      </button>
      {days.map((d) => (
        <button key={d} onClick={() => toggle(d)} className={pillClass(selected.includes(d))}>
          {formatDateLabel(d)}
        </button>
      ))}
      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={rangeEnd ? "Date range" : rangeStart ? "Tap an end date, or use just this day" : "Pick a date, or two for a range"}
      >
        <CalendarGrid
          value={rangeStart ?? selected[0] ?? todaySgt()}
          rangeFrom={from ?? undefined}
          rangeTo={to ?? undefined}
          min={todaySgt()}
          max={maxPostDateSgt()}
          onSelect={pickInCalendar}
        />
        {rangeStart && (
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={applyPick}
              className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90"
            >
              {pendingRange && pendingRange.length > 1
                ? `Use these ${pendingRange.length} days`
                : `Use ${formatDateLabel(rangeStart)}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setRangeStart(null);
                setRangeEnd(null);
              }}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
