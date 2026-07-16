"use client";

import { useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

export function DateStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("date");
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker(); // reliable programmatic open (Chrome/Edge/Safari 16+)
    } catch {
      el.focus();
      el.click(); // fallback for browsers without showPicker
    }
  }

  const days = Array.from({ length: 14 }, (_, i) =>
    dayjs(todaySgt()).add(i, "day").format("YYYY-MM-DD"),
  );

  function go(date: string | null) {
    const next = new URLSearchParams(params);
    if (date === null) next.delete("date");
    else next.set("date", date);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const pillClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm ${
      active ? "border-court bg-court text-white" : "border-gray-300 bg-white"
    }`;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-3">
      <button
        type="button"
        onClick={openPicker}
        className="relative flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-court bg-court-light px-3 py-1 text-sm font-medium text-court shadow-sm transition-colors active:bg-court active:text-white"
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
        <input
          ref={dateInputRef}
          aria-label="Jump to date"
          type="date"
          min={todaySgt()}
          max={maxPostDateSgt()}
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 opacity-0"
          onChange={(e) => e.target.value && go(e.target.value)}
        />
      </button>
      <button onClick={() => go(null)} className={pillClass(!selected)}>
        All
      </button>
      {days.map((d) => (
        <button key={d} onClick={() => go(d)} className={pillClass(d === selected)}>
          {formatDateLabel(d)}
        </button>
      ))}
    </div>
  );
}
