"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bsg-presence-id";

/** Thin polling pill: heartbeats to /api/presence and shows the live online count. */
export function OnlineCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_KEY, id);
    }

    let active = true;
    async function ping() {
      try {
        const res = await fetch("/api/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json();
        if (active && res.ok && json.data) setCount(json.data.count);
      } catch {
        // fail silently — the pill just doesn't update
      }
    }

    ping();
    const timer = setInterval(ping, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (count === null) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-court-light px-2 py-0.5 text-xs text-court">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      {count} online
    </span>
  );
}
