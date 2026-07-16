"use client";

import { useState } from "react";

// Longest-first so e.g. +852 matches before +85/+8 would (none overlap here, but safe).
const COUNTRY_CODES = ["+852", "+886", "+65", "+60", "+62", "+63", "+66", "+84", "+91", "+86", "+61", "+44", "+1"]
  .sort((a, b) => b.length - a.length);

type Contact = { phone?: string | null; telegramHandle?: string | null };

export function RevealButton({ endpoint }: { endpoint: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.data) setError(json.error ?? "Something went wrong");
      else setContact(json.data);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (contact) {
    const { phone, telegramHandle } = contact;
    // phone arrives as stored E.164, e.g. "+6591234567" or "+60123456789".
    let pretty: string | null = null;
    if (phone) {
      if (phone.startsWith("+65")) {
        const local = phone.slice(3);
        pretty = `+65 ${local.slice(0, 4)} ${local.slice(4)}`;
      } else {
        const code = COUNTRY_CODES.find((c) => phone.startsWith(c));
        pretty = code ? `${code} ${phone.slice(code.length)}` : phone;
      }
    }
    return (
      <div className="rounded-xl bg-court-light p-4 text-center">
        {pretty && <div className="text-xl font-bold text-court">{pretty}</div>}
        {telegramHandle && (
          <div className={`font-bold text-court ${pretty ? "mt-1 text-sm" : "text-xl"}`}>@{telegramHandle}</div>
        )}
        <div className="mt-3 flex justify-center gap-3">
          {phone && (
            <>
              <a href={`tel:${phone}`} className="rounded-full bg-court px-4 py-2 text-sm font-semibold text-white">
                Call
              </a>
              <a href={`https://wa.me/${phone.replace("+", "")}`} className="rounded-full border border-court px-4 py-2 text-sm font-semibold text-court">
                WhatsApp
              </a>
            </>
          )}
          {telegramHandle && (
            <a
              href={`https://t.me/${telegramHandle}`}
              className="rounded-full border border-court px-4 py-2 text-sm font-semibold text-court"
            >
              Telegram
            </a>
          )}
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
