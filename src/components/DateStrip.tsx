"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import dayjs from "dayjs";
import { todaySgt, maxPostDateSgt, formatDateLabel } from "@/lib/time";

export function DateStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("date");

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
    <div className="flex items-center gap-2 overflow-x-auto py-2">
      <button onClick={() => go(null)} className={pillClass(!selected)}>
        All
      </button>
      {days.map((d) => (
        <button key={d} onClick={() => go(d)} className={pillClass(d === selected)}>
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
