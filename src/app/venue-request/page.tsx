"use client";

import { useState } from "react";

export default function VenueRequest() {
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white";
  const label = "block text-sm font-semibold mt-4 mb-1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/venue-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, details: details || undefined }),
      });
      const json = await res.json();
      setSubmitting(false);
      if (!res.ok || !json.data) return setError(json.error ?? "Something went wrong");
      setDone(true);
    } catch {
      setSubmitting(false);
      setError("Network error — please try again");
    }
  }

  return (
    <main className="pt-6">
      <a href="/post" className="text-sm text-gray-400">← Back</a>
      <h1 className="mt-2 text-xl font-bold">Request a venue</h1>
      {done ? (
        <p className="mt-6 rounded-xl bg-court-light p-4 text-sm font-semibold text-court">
          Thanks — we&apos;ll add it soon.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label className={label}>Venue name</label>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sengkang Sports Hall"
            required
          />
          <label className={label}>Details (optional)</label>
          <textarea
            className={input}
            maxLength={300}
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Region, address, anything that helps us find it"
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-court py-3 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send request"}
          </button>
        </form>
      )}
    </main>
  );
}
