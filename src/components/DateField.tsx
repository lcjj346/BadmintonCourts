"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { CalendarGrid } from "@/components/CalendarGrid";
import { formatDateLabel } from "@/lib/time";

/** Form-field replacement for a native `<input type="date">` — a button that opens a CalendarGrid sheet. */
export function DateField({
  id, value, min, max, onChange, className,
}: {
  id?: string;
  value: string;
  min: string;
  max: string;
  onChange: (date: string) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(true)}
        className={`${className} flex items-center justify-between text-left transition-colors hover:border-court`}
      >
        <span>{formatDateLabel(value)}</span>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
          <rect x="3" y="5" width="18" height="17" rx="3" />
          <path d="M16 2.5v5M8 2.5v5M3 10.5h18" />
        </svg>
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Date">
        <CalendarGrid
          value={value}
          min={min}
          max={max}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}
