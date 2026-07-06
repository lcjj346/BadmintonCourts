"use client";

import { useState } from "react";

export function ReportButton({ endpoint }: { endpoint: string }) {
  const [done, setDone] = useState(false);

  if (done) return <p className="text-center text-xs text-gray-400">Reported — thanks</p>;
  return (
    <button
      onClick={async () => {
        await fetch(endpoint, { method: "POST" }).catch(() => {});
        setDone(true);
      }}
      className="mx-auto block text-xs text-gray-400 underline"
    >
      Report this post
    </button>
  );
}
