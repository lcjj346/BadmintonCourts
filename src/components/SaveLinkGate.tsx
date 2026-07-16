"use client";

import { useState } from "react";

/**
 * Gates its children behind an explicit "copy the manage link" click. Silent
 * auto-copy is easy to miss, so on a freshly-created post we force the tap —
 * the editing controls (mark sold/filled, delete) stay hidden until then.
 */
export function SaveLinkGate({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = window.location.href.split("?")[0];
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy your manage link:", link);
    }
    setCopied(true);
  }

  if (copied) {
    return (
      <>
        <p className="mt-3 text-center text-xs font-medium text-court">
          Link copied ✓ — paste it somewhere safe
        </p>
        {children}
      </>
    );
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-court bg-court-light p-4 text-center">
      <p className="text-sm font-semibold text-court">
        Copy your manage link before continuing — without it you can&apos;t edit or close this
        post later.
      </p>
      <button
        onClick={copy}
        className="mt-3 w-full rounded-xl bg-court py-3 font-semibold text-white"
      >
        Copy my manage link
      </button>
    </div>
  );
}
