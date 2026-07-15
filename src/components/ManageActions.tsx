"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLAYER_COUNT_OPTIONS } from "@/lib/skill";

export function ManageActions({
  token, type, closed, playersNeeded,
}: {
  token: string; type: "listing" | "session"; closed: boolean; playersNeeded?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [players, setPlayers] = useState(playersNeeded ?? 2);
  const [updating, setUpdating] = useState(false);
  const [updated, setUpdated] = useState(false);
  const closeLabel = type === "listing" ? "Mark as sold" : "Mark as filled";

  async function act(method: "PATCH" | "DELETE") {
    if (method === "DELETE" && !confirm("Delete this post permanently?")) return;
    setBusy(true);
    const res = await fetch(`/api/manage/${token}`, { method });
    setBusy(false);
    if (!res.ok) return alert("Something went wrong — try again");
    if (method === "DELETE") router.push("/");
    else router.refresh();
  }

  async function updatePlayers() {
    setUpdating(true);
    setUpdated(false);
    const res = await fetch(`/api/manage/${token}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playersNeeded: players }),
    });
    setUpdating(false);
    if (!res.ok) return alert("Something went wrong — try again");
    setUpdated(true);
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-2">
      {type === "session" && !closed && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <label className="block text-sm font-semibold" htmlFor="playersNeeded">
            Players still needed
          </label>
          <div className="mt-2 flex items-center gap-3">
            <select
              id="playersNeeded"
              aria-label="Players still needed"
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              value={players}
              onChange={(e) => { setPlayers(Number(e.target.value)); setUpdated(false); }}
            >
              {PLAYER_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button
              onClick={updatePlayers}
              disabled={updating}
              className="shrink-0 rounded-xl bg-court px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {updating ? "Updating…" : updated ? "Updated ✓" : "Update"}
            </button>
          </div>
        </div>
      )}
      {!closed && (
        <button onClick={() => act("PATCH")} disabled={busy}
          className="w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50">
          {closeLabel}
        </button>
      )}
      <button onClick={() => act("DELETE")} disabled={busy}
        className="w-full rounded-xl border border-red-300 py-3 font-semibold text-red-600 disabled:opacity-50">
        Delete post
      </button>
    </div>
  );
}
