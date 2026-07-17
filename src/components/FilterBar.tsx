"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";
import { SKILL_OPTIONS } from "@/lib/skill";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;

const DEFAULT_FROM = "07:00";
const DEFAULT_TO = "18:00";
const FROM_OPTIONS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`); // 00:00..23:00
const TO_OPTIONS = Array.from({ length: 23 }, (_, i) => `${String(i + 1).padStart(2, "0")}:00`); // 01:00..23:00

type SheetKey = "region" | "venue" | "time" | "skill" | null;

export function FilterBar({ venues, showSkill }: { venues: VenueOption[]; showSkill: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<SheetKey>(null);

  const regions = params.getAll("region");
  const venueId = params.get("venueId");
  const timeFrom = params.get("timeFrom");
  const timeTo = params.get("timeTo");
  const skills = params.getAll("skill");
  const available = params.get("available");
  const venueName = venues.find((v) => v.id === venueId)?.name;

  const [fromSel, setFromSel] = useState(timeFrom ?? DEFAULT_FROM);
  const [toSel, setToSel] = useState(timeTo ?? DEFAULT_TO);

  // When the Time sheet opens, sync the selects from the CURRENT URL params so a
  // cleared filter doesn't show stale values.
  useEffect(() => {
    if (sheet === "time") {
      setFromSel(params.get("timeFrom") ?? DEFAULT_FROM);
      setToSel(params.get("timeTo") ?? DEFAULT_TO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

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

  function setMulti(key: string, values: string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    for (const v of values) next.append(key, v);
    router.replace(`${pathname}?${next.toString()}`);
  }

  function toggleMulti(key: string, values: string[], value: string) {
    setMulti(key, values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  }

  const timeActive = Boolean(timeFrom || timeTo);
  const timeLabel = timeActive ? `${timeFrom ?? "…"}–${timeTo ?? "…"} ✕` : "Time ▾";

  const chipClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
      active
        ? "border-court bg-court text-white hover:bg-court/90"
        : "border-gray-300 bg-white text-gray-600 hover:border-court hover:bg-court-light/60 hover:text-court"
    }`;

  const chip = (label: string, active: string | null, key: SheetKey, paramKey: string) => (
    <button onClick={() => (active ? setParam(paramKey, null) : setSheet(key))} className={chipClass(Boolean(active))}>
      {active ? `${active} ✕` : `${label} ▾`}
    </button>
  );

  const pill = (selected: boolean) =>
    `mr-2 mb-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
      selected
        ? "border-court bg-court-light font-semibold text-court"
        : "border-gray-300 hover:border-court hover:bg-court-light/60"
    }`;

  const applyDisabled = toSel <= fromSel;

  const regionLabel = regions.length === 0 ? "Region ▾" : regions.length === 1 ? regions[0] : `Region (${regions.length})`;
  const skillLabel =
    skills.length === 0
      ? "Skill ▾"
      : skills.length === 1
        ? SKILL_OPTIONS.find(([v]) => v === skills[0])?.[1] ?? "Skill ▾"
        : `Skill (${skills.length})`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-3 pt-2">
      <button onClick={() => setSheet("region")} className={chipClass(regions.length > 0)}>
        {regionLabel}
      </button>
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

      {showSkill && (
        <button onClick={() => setSheet("skill")} className={chipClass(skills.length > 0)}>
          {skillLabel}
        </button>
      )}

      <BottomSheet open={sheet === "region"} onClose={() => setSheet(null)} title="Region">
        <p className="mb-2 text-xs text-gray-400">Tap to select more than one.</p>
        {REGIONS.map((r) => (
          <button key={r} className={pill(regions.includes(r))} onClick={() => toggleMulti("region", regions, r)}>{r}</button>
        ))}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90"
          >
            Done
          </button>
          {regions.length > 0 && (
            <button
              type="button"
              onClick={() => setMulti("region", [])}
              className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
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
              <option value="23:59">Midnight</option>
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
            className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90 disabled:opacity-50"
          >
            Apply
          </button>
          <button
            onClick={() => apply([["timeFrom", null], ["timeTo", null]])}
            className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </BottomSheet>

      {showSkill && (
        <BottomSheet open={sheet === "skill"} onClose={() => setSheet(null)} title="Skill level">
          <p className="mb-2 text-xs text-gray-400">Tap to select more than one.</p>
          {SKILL_OPTIONS.map(([value, text]) => (
            <button
              key={value}
              className={pill(skills.includes(value))}
              onClick={() => toggleMulti("skill", skills, value)}
            >
              {text}
            </button>
          ))}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90"
            >
              Done
            </button>
            {skills.length > 0 && (
              <button
                type="button"
                onClick={() => setMulti("skill", [])}
                className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
