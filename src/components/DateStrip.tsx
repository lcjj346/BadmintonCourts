"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

export function DateStrip({ selected }: { selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const days = Array.from({ length: 14 }, (_, i) =>
    dayjs(todaySgt()).add(i, "day").format("YYYY-MM-DD"),
  );

  function go(date: string) {
    const next = new URLSearchParams(params);
    next.set("date", date);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      {days.map((d) => (
        <button
          key={d}
          onClick={() => go(d)}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
            d === selected ? "border-court bg-court text-white" : "border-gray-300 bg-white"
          }`}
        >
          {formatDateLabel(d)}
        </button>
      ))}
      <label className="relative shrink-0 rounded-full border border-court px-3 py-1 text-sm text-court">
        📅
        <input
          aria-label="Jump to date"
          type="date"
          min={todaySgt()}
          max={maxPostDateSgt()}
          className="absolute inset-0 opacity-0"
          onChange={(e) => e.target.value && go(e.target.value)}
        />
      </label>
    </div>
  );
}
