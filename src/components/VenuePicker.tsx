"use client";

import { useState } from "react";

export type VenueOption = {
  id: string; name: string; region: string; venueType: string; availabilityNote: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  SPORTS_HALL: "Sports Hall", COMMUNITY_CENTRE: "CC", SCHOOL: "School", OTHER: "",
};

export function VenuePicker({
  venues, selectedId, onSelect,
}: {
  venues: VenueOption[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const matches = venues.filter((v) => v.name.toLowerCase().includes(q.toLowerCase()));
  const regions = [...new Set(matches.map((v) => v.region))];

  return (
    <div>
      <input
        placeholder="Search venues…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="max-h-72 overflow-y-auto">
        {selectedId && (
          <button onClick={() => onSelect(null)} className="mb-2 text-sm text-court underline">
            Clear venue filter
          </button>
        )}
        {regions.map((region) => (
          <div key={region}>
            <div className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-400">{region}</div>
            {matches.filter((v) => v.region === region).map((v) => (
              <button
                key={v.id}
                onClick={() => onSelect(v.id)}
                className={`block w-full rounded-lg px-2 py-2 text-left text-sm ${
                  v.id === selectedId ? "bg-court-light" : ""
                }`}
              >
                {v.name}
                <span className="ml-2 text-xs text-gray-400">{TYPE_LABEL[v.venueType]}</span>
                {v.availabilityNote && (
                  <span className="ml-1 text-xs text-amber-700">· {v.availabilityNote}</span>
                )}
              </button>
            ))}
          </div>
        ))}
        {matches.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No venues match</p>}
      </div>
    </div>
  );
}
