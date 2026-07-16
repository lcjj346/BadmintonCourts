"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";
import { todaySgt, maxPostDateSgt, nowSgtTime, TIME_OPTIONS, addHoursToTime } from "@/lib/time";
import { SKILL_OPTIONS, SKILL_ORDER, PLAYER_COUNT_OPTIONS, type SkillLevel } from "@/lib/skill";
import { MAX_BATCH_ITEMS } from "@/lib/schemas";

const COUNTRY_CODES: [string, string][] = [
  ["+65", "SG"], ["+60", "MY"], ["+62", "ID"], ["+63", "PH"], ["+66", "TH"],
  ["+84", "VN"], ["+91", "IN"], ["+852", "HK"], ["+886", "TW"], ["+86", "CN"],
  ["+61", "AU"], ["+44", "UK"], ["+1", "US"],
];

type Entry = {
  key: string;
  venueId: string | null;
  date: string;
  startTime: string;
  duration: number;
  price: string; // dollars string; "" → negotiable
  free: boolean;
  notes: string;
  playersNeeded: number;
  skillMin: SkillLevel;
  skillMax: SkillLevel;
};

function makeEntry(key: string): Entry {
  return {
    key,
    venueId: null,
    date: todaySgt(),
    startTime: "08:00",
    duration: 2,
    price: "",
    free: false,
    notes: "",
    playersNeeded: 2,
    skillMin: "MID_INTERMEDIATE",
    skillMax: "MID_INTERMEDIATE",
  };
}

export function PostForm({
  kind, venues, batchToken,
}: {
  kind: "court" | "game";
  venues: VenueOption[];
  /** When set, entries are appended to this existing manage link instead of starting a new one. */
  batchToken?: string;
}) {
  const router = useRouter();
  // A plain incrementing counter (not crypto.randomUUID) so the first entry's key is
  // identical between the server render and the client hydration render — each gets
  // its own fresh ref starting at 0, unlike a random UUID which would mismatch.
  const nextKey = useRef(0);
  function newEntry(): Entry {
    return makeEntry(`entry-${nextKey.current++}`);
  }
  const [entries, setEntries] = useState<Entry[]>(() => [newEntry()]);
  const [venueSheetFor, setVenueSheetFor] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+65");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Client-only SGT clock (null during SSR/first paint to avoid hydration mismatch).
  const [nowTime, setNowTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNowTime(nowSgtTime());
    tick();
    const t = setInterval(tick, 30_000); // keep options fresh as time passes
    return () => clearInterval(t);
  }, []);

  function updateEntry(key: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    setEntries((prev) => (prev.length >= MAX_BATCH_ITEMS ? prev : [...prev, newEntry()]));
  }

  function removeEntry(key: string) {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.key !== key)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const entry of entries) {
      if (!entry.venueId) return setError("Pick a venue for every court/game");
      const isToday = entry.date === todaySgt();
      if (isToday && nowTime && entry.startTime <= nowTime) {
        return setError("One of your slots' start times has already passed — pick a later time or another day");
      }
    }
    setSubmitting(true);

    const items = entries.map((entry) => {
      const cents = entry.free ? 0 : entry.price === "" ? null : Math.round(parseFloat(entry.price) * 100);
      const endTime = addHoursToTime(entry.startTime, entry.duration);
      return kind === "court"
        ? {
            venueId: entry.venueId, date: entry.date, startTime: entry.startTime, endTime,
            priceCents: cents, notes: entry.notes || undefined,
          }
        : {
            venueId: entry.venueId, date: entry.date, startTime: entry.startTime, endTime,
            playersNeeded: entry.playersNeeded, skillMin: entry.skillMin, skillMax: entry.skillMax,
            pricePerPlayerCents: cents, notes: entry.notes || undefined,
          };
    });

    try {
      const url = batchToken
        ? `/api/manage/${batchToken}/items`
        : kind === "court" ? "/api/listings" : "/api/sessions";
      const body = batchToken
        ? { type: kind === "court" ? "listing" : "session", items }
        : (() => {
            let local = phone.replace(/\D/g, "");
            if (countryCode !== "+65") local = local.replace(/^0/, "");
            return { items, phone: `${countryCode}${local}`, website: "" };
          })();
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        setSubmitting(false);
        return setError(json.error ?? "Something went wrong");
      }
      // created=1 re-triggers the "copy your manage link" gate even on an append — if the
      // poster skipped straight to "+ Add another" without ever copying the original link,
      // this is the only remaining chance to force them to save it.
      router.push(`/manage/${batchToken ?? json.data.batchToken}?created=1`);
    } catch {
      setSubmitting(false);
      setError("Network error — please try again");
    }
  }

  const label = "block text-sm font-semibold mt-4 mb-1";
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";
  const noun = kind === "court" ? "court" : "game";

  return (
    <form onSubmit={submit}>
      {entries.map((entry, i) => {
        const isToday = entry.date === todaySgt();
        const timeOptions = isToday && nowTime ? TIME_OPTIONS.filter((t) => t > nowTime) : TIME_OPTIONS;
        const noSlotsToday = isToday && nowTime !== null && timeOptions.length === 0;
        const venueName = venues.find((v) => v.id === entry.venueId)?.name;

        return (
          <div key={entry.key} className={i > 0 ? "mt-6 border-t border-gray-200 pt-5" : ""}>
            {entries.length > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-court">
                  {kind === "court" ? "Court" : "Game"} {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeEntry(entry.key)}
                  className="text-xs font-medium text-red-600"
                >
                  Remove
                </button>
              </div>
            )}

            <label className={label}>Venue</label>
            <button
              type="button"
              onClick={() => setVenueSheetFor(entry.key)}
              className={`${input} text-left`}
            >
              {venueName ?? "Choose a venue…"}
            </button>
            <BottomSheet open={venueSheetFor === entry.key} onClose={() => setVenueSheetFor(null)} title="Venue">
              <VenuePicker
                venues={venues}
                selectedId={entry.venueId}
                onSelect={(id) => {
                  updateEntry(entry.key, { venueId: id });
                  setVenueSheetFor(null);
                }}
              />
            </BottomSheet>
            {i === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                Venue not listed?{" "}
                <a className="underline" href="/venue-request">Request it</a>
              </p>
            )}

            <label className={label} htmlFor={`post-date-${entry.key}`}>Date</label>
            <input
              id={`post-date-${entry.key}`}
              aria-label="Date"
              className={input}
              type="date"
              value={entry.date}
              min={todaySgt()}
              max={maxPostDateSgt()}
              onChange={(e) => updateEntry(entry.key, { date: e.target.value })}
              required
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className={label}>Start</label>
                <select
                  className={input}
                  value={entry.startTime}
                  disabled={noSlotsToday}
                  onChange={(e) => updateEntry(entry.key, { startTime: e.target.value })}
                >
                  {timeOptions.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className={label}>Hours</label>
                <select
                  className={input}
                  value={entry.duration}
                  onChange={(e) => updateEntry(entry.key, { duration: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
            {noSlotsToday && (
              <p className="mt-1 text-xs text-amber-700">No slots left today — pick another date</p>
            )}

            {kind === "game" && (
              <>
                <label className={label}>Players needed</label>
                <select
                  className={input}
                  value={entry.playersNeeded}
                  onChange={(e) => updateEntry(entry.key, { playersNeeded: Number(e.target.value) })}
                >
                  {PLAYER_COUNT_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <label className={label}>Skill level</label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <span className="mb-1 block text-xs text-gray-400">From</span>
                    <select
                      className={input}
                      aria-label="Skill level from"
                      value={entry.skillMin}
                      onChange={(e) => {
                        const next = e.target.value as SkillLevel;
                        const patch: Partial<Entry> = { skillMin: next };
                        if (SKILL_ORDER.indexOf(next) > SKILL_ORDER.indexOf(entry.skillMax)) patch.skillMax = next;
                        updateEntry(entry.key, patch);
                      }}
                    >
                      {SKILL_OPTIONS.map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <span className="mb-1 block text-xs text-gray-400">To</span>
                    <select
                      className={input}
                      aria-label="Skill level to"
                      value={entry.skillMax}
                      onChange={(e) => updateEntry(entry.key, { skillMax: e.target.value as SkillLevel })}
                    >
                      {SKILL_OPTIONS.filter(
                        ([value]) => SKILL_ORDER.indexOf(value) >= SKILL_ORDER.indexOf(entry.skillMin),
                      ).map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  Same level both ends for a single skill, or a range like Mid Beginner–Low Intermediate.
                </p>
              </>
            )}

            <label className={label}>{kind === "court" ? "Price (SGD)" : "Cost per player (SGD)"}</label>
            <div className="flex items-center gap-3">
              <input
                className={input}
                type="number"
                step="0.50"
                min="0"
                placeholder="Leave blank for negotiable"
                value={entry.price}
                disabled={entry.free}
                onChange={(e) => updateEntry(entry.key, { price: e.target.value })}
              />
              <label className="flex shrink-0 items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={entry.free}
                  onChange={(e) => updateEntry(entry.key, { free: e.target.checked })}
                />{" "}
                Free
              </label>
            </div>

            <label className={label}>Notes (optional)</label>
            <textarea
              className={input}
              maxLength={300}
              rows={2}
              value={entry.notes}
              placeholder={kind === "court" ? "e.g. court 3, transfer at counter" : "e.g. doubles, bring own shuttles"}
              onChange={(e) => updateEntry(entry.key, { notes: e.target.value })}
            />
          </div>
        );
      })}

      {entries.length < MAX_BATCH_ITEMS && (
        <button
          type="button"
          onClick={addEntry}
          className="mt-5 w-full rounded-xl border border-dashed border-court py-2.5 text-sm font-semibold text-court"
        >
          + Add another {noun}
        </button>
      )}

      {!batchToken && (
        <>
          <label className={label}>Your mobile number</label>
          <div className="flex gap-2">
            <select
              className="w-[5.5rem] shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"
              aria-label="Country code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            >
              {COUNTRY_CODES.map(([code, cc]) => (
                <option key={code} value={code}>{`${code} (${cc})`}</option>
              ))}
            </select>
            <input
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base tracking-wide"
              type="tel"
              inputMode="numeric"
              placeholder="9123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
              required
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Shown only to people who tap &quot;Reveal contact&quot;. Deleted 14 days after your post expires.
            {entries.length > 1 && " One number for all the courts/games above."}
          </p>

          {/* honeypot — hidden from real users */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {batchToken ? (
        <div className="mt-5 rounded-xl bg-court-light p-3 text-sm text-court">
          This will be added to your existing manage link — same number, same page.
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          After posting you&apos;ll get a <strong>private manage link</strong> — it&apos;s the only
          way to edit, mark as {kind === "court" ? "sold" : "filled"}, or delete{" "}
          {entries.length > 1 ? "these posts" : "your post"}. Save it before sharing.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting
          ? "Posting…"
          : batchToken
            ? `Add ${entries.length > 1 ? `${entries.length} ${kind === "court" ? "courts" : "games"}` : kind === "court" ? "court" : "game"}`
            : entries.length > 1
              ? `Post ${entries.length} ${kind === "court" ? "courts" : "games"}`
              : kind === "court"
                ? "Post court"
                : "Post game"}
      </button>
    </form>
  );
}
