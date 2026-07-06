"use client";

import { useState } from "react";

export function RevealButton({ endpoint }: { endpoint: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.data) setError(json.error ?? "Something went wrong");
      else setPhone(json.data.phone);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (phone) {
    const pretty = `${phone.slice(0, 4)} ${phone.slice(4)}`;
    return (
      <div className="rounded-xl bg-court-light p-4 text-center">
        <div className="text-xl font-bold text-court">{pretty}</div>
        <div className="mt-3 flex justify-center gap-3">
          <a href={`tel:+65${phone}`} className="rounded-full bg-court px-4 py-2 text-sm font-semibold text-white">
            Call
          </a>
          <a href={`https://wa.me/65${phone}`} className="rounded-full border border-court px-4 py-2 text-sm font-semibold text-court">
            WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={reveal}
        disabled={loading}
        className="w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Revealing…" : "Reveal contact"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
