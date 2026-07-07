"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";

const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;
const TIMES = [["MORNING", "Morning"], ["AFTERNOON", "Afternoon"], ["EVENING", "Evening"]] as const;
const SKILLS = [["BEGINNER", "Beginner"], ["INTERMEDIATE", "Intermediate"], ["ADVANCED", "Advanced"]] as const;

type SheetKey = "region" | "venue" | "time" | "skill" | null;

export function FilterBar({ venues, showSkill }: { venues: VenueOption[]; showSkill: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<SheetKey>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
    setSheet(null);
  }

  const region = params.get("region");
  const venueId = params.get("venueId");
  const time = params.get("time");
  const skill = params.get("skill");
  const venueName = venues.find((v) => v.id === venueId)?.name;

  const chip = (label: string, active: string | null, key: SheetKey, paramKey: string) => (
    <button
      onClick={() => (active ? setParam(paramKey, null) : setSheet(key))}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
        active ? "border-court bg-court text-white" : "border-gray-300 bg-white text-gray-600"
      }`}
    >
      {active ? `${active} ✕` : `${label} ▾`}
    </button>
  );

  const pill = (selected: boolean) =>
    `mr-2 mb-2 rounded-full border px-3 py-1.5 text-sm ${
      selected ? "border-court bg-court-light font-semibold text-court" : "border-gray-300"
    }`;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {chip("Region", region, "region", "region")}
      {chip("Venue", venueName ?? null, "venue", "venueId")}
      {chip("Time", time, "time", "time")}
      {showSkill && chip("Skill", skill, "skill", "skill")}

      <BottomSheet open={sheet === "region"} onClose={() => setSheet(null)} title="Region">
        {REGIONS.map((r) => (
          <button key={r} className={pill(r === region)} onClick={() => setParam("region", r)}>{r}</button>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === "venue"} onClose={() => setSheet(null)} title="Venue">
        <VenuePicker venues={venues} selectedId={venueId} onSelect={(id) => setParam("venueId", id)} />
      </BottomSheet>

      <BottomSheet open={sheet === "time"} onClose={() => setSheet(null)} title="Time of day">
        {TIMES.map(([v, label]) => (
          <button key={v} className={pill(v === time)} onClick={() => setParam("time", v)}>{label}</button>
        ))}
      </BottomSheet>

      {showSkill && (
        <BottomSheet open={sheet === "skill"} onClose={() => setSheet(null)} title="Skill level">
          {SKILLS.map(([v, label]) => (
            <button key={v} className={pill(v === skill)} onClick={() => setParam("skill", v)}>{label}</button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}
