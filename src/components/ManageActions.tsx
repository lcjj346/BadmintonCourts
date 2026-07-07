"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ManageActions({
  token, type, closed,
}: {
  token: string; type: "listing" | "session"; closed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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

  return (
    <div className="mt-4 space-y-2">
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
