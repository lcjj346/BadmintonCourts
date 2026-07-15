"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { VenuePicker, type VenueOption } from "@/components/VenuePicker";
import { todaySgt, maxPostDateSgt, nowSgtTime, TIME_OPTIONS, addHoursToTime } from "@/lib/time";
import { SKILL_OPTIONS, PLAYER_COUNT_OPTIONS } from "@/lib/skill";

const COUNTRY_CODES: [string, string][] = [
  ["+65", "SG"], ["+60", "MY"], ["+62", "ID"], ["+63", "PH"], ["+66", "TH"],
  ["+84", "VN"], ["+91", "IN"], ["+852", "HK"], ["+886", "TW"], ["+86", "CN"],
  ["+61", "AU"], ["+44", "UK"], ["+1", "US"],
];

export function PostForm({ kind, venues }: { kind: "court" | "game"; venues: VenueOption[] }) {
  const router = useRouter();
  const [venueId, setVenueId] = useState<string | null>(null);
  const [venueSheet, setVenueSheet] = useState(false);
  const [date, setDate] = useState(todaySgt());
  const [startTime, setStartTime] = useState("08:00");
  const [duration, setDuration] = useState(2);
  const [price, setPrice] = useState(""); // dollars string; "" → negotiable
  const [free, setFree] = useState(false);
  const [playersNeeded, setPlayersNeeded] = useState(2);
  const [skillLevel, setSkillLevel] = useState("MID_INTERMEDIATE");
  const [notes, setNotes] = useState("");
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

  const isToday = date === todaySgt();
  // When posting for today, only offer start times still in the future.
  const timeOptions =
    isToday && nowTime ? TIME_OPTIONS.filter((t) => t > nowTime) : TIME_OPTIONS;
  const noSlotsToday = isToday && nowTime !== null && timeOptions.length === 0;

  // Auto-fix the selection if the current start time has just passed.
  useEffect(() => {
    if (isToday && nowTime) {
      const opts = TIME_OPTIONS.filter((t) => t > nowTime);
      if (opts.length > 0 && !opts.includes(startTime)) setStartTime(opts[0]);
    }
  }, [isToday, nowTime, startTime]);

  const venueName = venues.find((v) => v.id === venueId)?.name;
  const endTime = addHoursToTime(startTime, duration);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!venueId) return setError("Pick a venue");
    if (noSlotsToday) return setError("No slots left today — pick another date");
    setSubmitting(true);

    const cents = free ? 0 : price === "" ? null : Math.round(parseFloat(price) * 100);
    let local = phone.replace(/\D/g, "");
    if (countryCode !== "+65") local = local.replace(/^0/, "");
    const e164 = `${countryCode}${local}`;
    const body =
      kind === "court"
        ? { venueId, date, startTime, endTime, priceCents: cents, notes: notes || undefined, phone: e164, website: "" }
        : {
            venueId, date, startTime, endTime, playersNeeded, skillLevel,
            pricePerPlayerCents: cents, notes: notes || undefined, phone: e164, website: "",
          };

    try {
      const res = await fetch(kind === "court" ? "/api/listings" : "/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        setSubmitting(false);
        return setError(json.error ?? "Something went wrong");
      }
      router.push(`/manage/${json.data.editToken}?created=1`);
    } catch {
      setSubmitting(false);
      setError("Network error — please try again");
    }
  }

  const label = "block text-sm font-semibold mt-4 mb-1";
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";

  return (
    <form onSubmit={submit}>
      <label className={label}>Venue</label>
      <button type="button" onClick={() => setVenueSheet(true)} className={`${input} text-left`}>
        {venueName ?? "Choose a venue…"}
      </button>
      <BottomSheet open={venueSheet} onClose={() => setVenueSheet(false)} title="Venue">
        <VenuePicker
          venues={venues}
          selectedId={venueId}
          onSelect={(id) => {
            setVenueId(id);
            setVenueSheet(false);
          }}
        />
      </BottomSheet>
      <p className="mt-1 text-xs text-gray-400">
        Venue not listed?{" "}
        <a className="underline" href="/venue-request">Request it</a>
      </p>

      <label className={label} htmlFor="post-date">Date</label>
      <input
        id="post-date"
        aria-label="Date"
        className={input}
        type="date"
        value={date}
        min={todaySgt()}
        max={maxPostDateSgt()}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <div className="flex gap-3">
        <div className="flex-1">
          <label className={label}>Start</label>
          <select
            className={input}
            value={startTime}
            disabled={noSlotsToday}
            onChange={(e) => setStartTime(e.target.value)}
          >
            {timeOptions.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className={label}>Hours</label>
          <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
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
          <select className={input} value={playersNeeded} onChange={(e) => setPlayersNeeded(Number(e.target.value))}>
            {PLAYER_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <label className={label}>Skill level</label>
          <select
            className={input}
            aria-label="Skill level"
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
          >
            {SKILL_OPTIONS.map(([value, text]) => (
              <option key={value} value={value}>{text}</option>
            ))}
          </select>
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
          value={price}
          disabled={free}
          onChange={(e) => setPrice(e.target.value)}
        />
        <label className="flex shrink-0 items-center gap-1 text-sm">
          <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Free
        </label>
      </div>

      <label className={label}>Notes (optional)</label>
      <textarea
        className={input}
        maxLength={300}
        rows={2}
        value={notes}
        placeholder={kind === "court" ? "e.g. court 3, transfer at counter" : "e.g. doubles, bring own shuttles"}
        onChange={(e) => setNotes(e.target.value)}
      />

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
        Shown only to people who tap &quot;Reveal contact&quot;. Deleted 7 days after your post expires.
      </p>

      {/* honeypot — hidden from real users */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
        📌 After posting you&apos;ll get a <strong>private manage link</strong> — it&apos;s the only
        way to edit players needed, mark as sold/filled, or delete your post. Save it before sharing
        your court.
      </div>

      <button
        type="submit"
        disabled={submitting || noSlotsToday}
        className="mt-5 w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Posting…" : kind === "court" ? "Post court" : "Post game"}
      </button>
    </form>
  );
}
