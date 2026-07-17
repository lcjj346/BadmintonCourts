"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { BottomSheet } from "@/components/BottomSheet";
import { CalendarGrid } from "@/components/CalendarGrid";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

export function DateStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.getAll("date");
  const [pickerOpen, setPickerOpen] = useState(false);
  // First calendar tap starts a range; the second tap (any date, before or after)
  // closes it — the whole inclusive span replaces the current selection. Tapping
  // the same date twice selects just that one day.
  const [rangeStart, setRangeStart] = useState<string | null>(null);

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
    setPickerOpen(true);
  }

  function pickInCalendar(d: string) {
    if (!rangeStart) {
      setRangeStart(d);
      return;
    }
    const [from, to] = d < rangeStart ? [d, rangeStart] : [rangeStart, d];
    const range: string[] = [];
    for (let cur = dayjs(from); cur.isBefore(dayjs(to)) || cur.isSame(dayjs(to)); cur = cur.add(1, "day")) {
      range.push(cur.format("YYYY-MM-DD"));
    }
    setDates(range);
    setPickerOpen(false);
    setRangeStart(null);
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
        title={rangeStart ? `From ${formatDateLabel(rangeStart)} — tap the end date` : "Pick a date, or tap twice for a range"}
      >
        <CalendarGrid
          value={rangeStart ?? selected[0] ?? todaySgt()}
          min={todaySgt()}
          max={maxPostDateSgt()}
          onSelect={pickInCalendar}
        />
        {rangeStart && (
          <button
            type="button"
            className="mt-3 text-xs text-gray-400 underline"
            onClick={() => setRangeStart(null)}
          >
            Cancel, start over
          </button>
        )}
      </BottomSheet>
    </div>
  );
}
