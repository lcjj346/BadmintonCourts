"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";
import { SKILL_OPTIONS } from "@/lib/skill";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;

const FROM_OPTIONS = Array.from({ length: 16 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`); // 07:00..22:00
const TO_OPTIONS = Array.from({ length: 16 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`); // 08:00..23:00

type SheetKey = "region" | "venue" | "time" | "skill" | null;

export function FilterBar({ venues, showSkill }: { venues: VenueOption[]; showSkill: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<SheetKey>(null);

  const region = params.get("region");
  const venueId = params.get("venueId");
  const timeFrom = params.get("timeFrom");
  const timeTo = params.get("timeTo");
  const skill = params.get("skill");
  const available = params.get("available");
  const venueName = venues.find((v) => v.id === venueId)?.name;

  const [fromSel, setFromSel] = useState(timeFrom ?? "08:00");
  const [toSel, setToSel] = useState(timeTo ?? "18:00");

  function apply(entries: [string, string | null][]) {
    const next = new URLSearchParams(params);
    for (const [key, value] of entries) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router.replace(`${pathname}?${next.toString()}`);
    setSheet(null);
  }

  function setParam(key: string, value: string | null) {
    apply([[key, value]]);
  }

  const timeActive = Boolean(timeFrom || timeTo);
  const timeLabel = timeActive ? `${timeFrom ?? "…"}–${timeTo ?? "…"} ✕` : "Time ▾";

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs ${
      active ? "border-court bg-court text-white" : "border-gray-300 bg-white text-gray-600"
    }`;

  const chip = (label: string, active: string | null, key: SheetKey, paramKey: string) => (
    <button onClick={() => (active ? setParam(paramKey, null) : setSheet(key))} className={chipClass(Boolean(active))}>
      {active ? `${active} ✕` : `${label} ▾`}
    </button>
  );

  const pill = (selected: boolean) =>
    `mr-2 mb-2 rounded-full border px-3 py-1.5 text-sm ${
      selected ? "border-court bg-court-light font-semibold text-court" : "border-gray-300"
    }`;

  const applyDisabled = toSel <= fromSel;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {chip("Region", region, "region", "region")}
      {chip("Venue", venueName ?? null, "venue", "venueId")}

      <button
        onClick={() => (timeActive ? apply([["timeFrom", null], ["timeTo", null]]) : setSheet("time"))}
        className={chipClass(timeActive)}
      >
        {timeLabel}
      </button>

      <button
        onClick={() => setParam("available", available ? null : "1")}
        className={chipClass(Boolean(available))}
      >
        {showSkill ? "Open only" : "Available only"}
      </button>

      {showSkill && chip("Skill", skill ? SKILL_OPTIONS.find(([v]) => v === skill)?.[1] ?? null : null, "skill", "skill")}

      <BottomSheet open={sheet === "region"} onClose={() => setSheet(null)} title="Region">
        {REGIONS.map((r) => (
          <button key={r} className={pill(r === region)} onClick={() => setParam("region", r)}>{r}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === "venue"} onClose={() => setSheet(null)} title="Venue">
        <VenuePicker venues={venues} selectedId={venueId} onSelect={(id) => setParam("venueId", id)} />
      </BottomSheet>

      <BottomSheet open={sheet === "time"} onClose={() => setSheet(null)} title="Time range">
        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold">From</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              value={fromSel}
              onChange={(e) => setFromSel(e.target.value)}
            >
              {FROM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-semibold">To</span>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              value={toSel}
              onChange={(e) => setToSel(e.target.value)}
            >
              {TO_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        {applyDisabled && (
          <p className="mt-2 text-xs text-red-600">To must be after From.</p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            disabled={applyDisabled}
            onClick={() => apply([["timeFrom", fromSel], ["timeTo", toSel]])}
            className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => apply([["timeFrom", null], ["timeTo", null]])}
            className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600"
          >
            Clear
          </button>
        </div>
      </BottomSheet>

      {showSkill && (
        <BottomSheet open={sheet === "skill"} onClose={() => setSheet(null)} title="Skill level">
          {SKILL_OPTIONS.map(([value, text]) => (
            <button key={value} className={pill(value === skill)} onClick={() => setParam("skill", value)}>{text}</button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
