"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/BottomSheet";
import { DateField } from "@/components/DateField";
import { todaySgt, maxPostDateSgt, TIME_OPTIONS, addHoursToTime } from "@/lib/time";
import { SKILL_OPTIONS, SKILL_ORDER, PLAYER_COUNT_OPTIONS, type SkillLevel } from "@/lib/skill";
import type { ManagedPost } from "@/services/manageService";

function durationFromTimes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return Math.max(1, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60));
}

export function ManageActions({
  token, post: managed, onDeleted,
}: {
  token: string; post: ManagedPost; onDeleted: () => void;
}) {
  const router = useRouter();
  const { type, post } = managed;
  const closed = post.status === "SOLD" || post.status === "FILLED";
  const expired = post.status === "EXPIRED";
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const [date, setDate] = useState(post.date);
  const [startTime, setStartTime] = useState(post.startTime);
  const [duration, setDuration] = useState(durationFromTimes(post.startTime, post.endTime));
  const initialCents = type === "listing" ? post.priceCents : post.pricePerPlayerCents;
  const [price, setPrice] = useState(initialCents ? String(initialCents / 100) : "");
  const [free, setFree] = useState(initialCents === 0);
  const [notes, setNotes] = useState(post.notes ?? "");
  const [phone, setPhone] = useState(post.phone ?? "");
  const [telegramHandle, setTelegramHandle] = useState(post.telegramHandle ?? "");
  const [playersNeeded, setPlayersNeeded] = useState(post.playersNeeded ?? 2);
  const [maxPax, setMaxPax] = useState(post.maxPax ?? Math.max(post.playersNeeded ?? 2, 6));
  const [skillMin, setSkillMin] = useState<SkillLevel>((post.skillMin as SkillLevel) ?? "MID_INTERMEDIATE");
  const [skillMax, setSkillMax] = useState<SkillLevel>((post.skillMax as SkillLevel) ?? "MID_INTERMEDIATE");

  const closeLabel = type === "listing" ? "Mark as sold" : "Mark as filled";
  const reopenLabel = type === "listing" ? "Revert to available" : "Revert to open";
  const priceLabel = type === "listing" ? "Price (SGD)" : "Cost per player (SGD)";

  async function act(body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") {
    setBusy(true);
    try {
      const res = await fetch(`/api/manage/${token}/${post.id}`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, ...body }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setToast(json?.error ?? "Something went wrong — try again");
        return false;
      }
      return true;
    } catch {
      setToast("Network error — try again");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function markClosed() {
    if (await act({ action: "close" })) router.refresh();
  }

  async function reopen() {
    if (await act({ action: "reopen" })) router.refresh();
  }

  // Quick +/- stepper beside "Mark as filled" — updates just playersNeeded via the
  // existing updatePlayers action, without opening the full edit form for a change
  // the poster is likely to make several times as spots fill up.
  const paxCap = post.maxPax ?? 30;
  async function adjustPlayersNeeded(delta: number) {
    const next = Math.min(paxCap, Math.max(1, playersNeeded + delta));
    if (next === playersNeeded) return;
    const prev = playersNeeded;
    setPlayersNeeded(next);
    if (!(await act({ action: "updatePlayers", playersNeeded: next }))) {
      setPlayersNeeded(prev);
      return;
    }
    router.refresh();
  }

  async function remove() {
    setConfirmDelete(false);
    if (!(await act({}, "DELETE"))) return;
    // Removed from the DOM immediately by the parent's local state — no waiting on a
    // router.refresh() RSC round-trip, which under load could lag well past a moment
    // where the count still visibly reads stale. router.refresh() still runs in the
    // background so the server-rendered cache doesn't drift for later navigations.
    onDeleted();
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() && !telegramHandle.trim()) {
      setToast("Enter a phone number or a Telegram handle");
      return;
    }
    if (type === "session" && maxPax < playersNeeded) {
      setToast("Max pax must be at least the number of players needed");
      return;
    }
    const cents = free ? 0 : price === "" ? null : Math.round(parseFloat(price) * 100);
    const endTime = addHoursToTime(startTime, duration);
    const contact = {
      phone: phone.trim() || undefined,
      telegramHandle: telegramHandle.trim().replace(/^@/, "") || undefined,
    };
    const body =
      type === "listing"
        ? { action: "edit", date, startTime, endTime, priceCents: cents, notes: notes || undefined, ...contact }
        : {
            action: "edit", date, startTime, endTime, playersNeeded, maxPax, skillMin, skillMax,
            pricePerPlayerCents: cents, notes: notes || undefined, ...contact,
          };
    if (await act(body)) {
      setEditing(false);
      router.refresh();
    }
  }

  const label = "block text-xs font-semibold mt-3 mb-1";
  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";

  const toastNode = toast && (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-6 z-[60] mx-auto max-w-md rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
    >
      {toast}
    </div>
  );

  if (editing) {
    return (
      <>
      <form onSubmit={saveEdit} className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
        <label className={label} htmlFor={`edit-date-${post.id}`}>Date</label>
        <DateField
          id={`edit-date-${post.id}`}
          className={input}
          value={date}
          min={todaySgt()}
          max={maxPostDateSgt()}
          onChange={setDate}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={label}>Start</label>
            <select
              className={input}
              aria-label="Edit start time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className={label}>Hours</label>
            <select
              className={input}
              aria-label="Edit hours"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        </div>

        {type === "session" && (
          <>
            <label className={label}>Players needed</label>
            <select
              className={input}
              aria-label="Edit players needed"
              value={playersNeeded}
              onChange={(e) => {
                const next = Number(e.target.value);
                setPlayersNeeded(next);
                if (maxPax < next) setMaxPax(next);
              }}
            >
              {PLAYER_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <label className={label}>Max pax (total court capacity)</label>
            <select
              className={input}
              aria-label="Edit max pax"
              value={maxPax}
              onChange={(e) => setMaxPax(Number(e.target.value))}
            >
              {PLAYER_COUNT_OPTIONS.filter((n) => n >= playersNeeded).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <label className={label}>Skill level</label>
            <div className="flex gap-3">
              <div className="flex-1">
                <span className="mb-1 block text-[11px] text-gray-400">From</span>
                <select
                  className={input}
                  aria-label="Edit skill level from"
                  value={skillMin}
                  onChange={(e) => {
                    const next = e.target.value as SkillLevel;
                    setSkillMin(next);
                    if (SKILL_ORDER.indexOf(next) > SKILL_ORDER.indexOf(skillMax)) setSkillMax(next);
                  }}
                >
                  {SKILL_OPTIONS.map(([value, text]) => (
                    <option key={value} value={value}>{text}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <span className="mb-1 block text-[11px] text-gray-400">To</span>
                <select
                  className={input}
                  aria-label="Edit skill level to"
                  value={skillMax}
                  onChange={(e) => setSkillMax(e.target.value as SkillLevel)}
                >
                  {SKILL_OPTIONS.filter(([value]) => SKILL_ORDER.indexOf(value) >= SKILL_ORDER.indexOf(skillMin)).map(
                    ([value, text]) => (
                      <option key={value} value={value}>{text}</option>
                    ),
                  )}
                </select>
              </div>
            </div>
          </>
        )}

        <label className={label}>{priceLabel}</label>
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

        <label className={label} htmlFor={`edit-phone-${post.id}`}>Phone number</label>
        <input
          id={`edit-phone-${post.id}`}
          className={input}
          type="tel"
          placeholder="+6591234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\s/g, ""))}
        />

        <label className={label} htmlFor={`edit-telegram-${post.id}`}>Telegram handle</label>
        <input
          id={`edit-telegram-${post.id}`}
          className={input}
          type="text"
          placeholder="@username"
          value={telegramHandle}
          onChange={(e) => setTelegramHandle(e.target.value.replace(/\s/g, ""))}
        />
        <p className="mt-1 text-xs text-gray-400">At least one of phone or Telegram is required.</p>

        <label className={label}>Notes</label>
        <textarea
          className={input}
          maxLength={300}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90 disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
      {toastNode}
      </>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {!closed && type === "session" && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
          <span className="text-sm font-medium text-gray-600">Players needed</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => adjustPlayersNeeded(-1)}
              disabled={busy || playersNeeded <= 1}
              aria-label="Decrease players needed"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-court text-lg font-bold text-court transition-colors hover:bg-court-light/60 disabled:opacity-30"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-bold tabular-nums">{playersNeeded}</span>
            <button
              type="button"
              onClick={() => adjustPlayersNeeded(1)}
              disabled={busy || playersNeeded >= paxCap}
              aria-label="Increase players needed"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-court text-lg font-bold text-court transition-colors hover:bg-court-light/60 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      )}
      {!closed && (
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="flex-1 rounded-xl border border-court py-2.5 font-semibold text-court transition-colors hover:bg-court-light/60 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            onClick={markClosed}
            disabled={busy}
            className="flex-1 rounded-xl bg-court py-2.5 font-semibold text-white transition-colors hover:bg-court/90 disabled:opacity-50"
          >
            {closeLabel}
          </button>
        </div>
      )}
      {closed && !expired && (
        <button
          onClick={reopen}
          disabled={busy}
          className="w-full rounded-xl border border-court py-2.5 font-semibold text-court transition-colors hover:bg-court-light/60 disabled:opacity-50"
        >
          {reopenLabel}
        </button>
      )}
      <button
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
        className="w-full rounded-xl border border-red-300 py-2.5 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
      >
        Delete post
      </button>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete post?">
        <p className="text-sm text-gray-600">This can&apos;t be undone.</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={remove}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-600 py-2.5 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      {toastNode}
    </div>
  );
}
