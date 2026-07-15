"use client";

import { useEffect, useState } from "react";

/**
 * Copies the manage link. On mount it ATTEMPTS an automatic copy — browsers
 * only allow clipboard writes without a click when the tab is focused and
 * permission isn't blocked (it usually works right after the post-form
 * navigation, since that was a user gesture). If the attempt is rejected we
 * stay quiet and the button remains the reliable path.
 */
export function CopyLinkButton() {
  const [state, setState] = useState<"idle" | "copied" | "autoCopied">("idle");

  const link = () => window.location.href.split("?")[0];

  useEffect(() => {
    let cancelled = false;
    navigator.clipboard
      ?.writeText(link())
      .then(() => !cancelled && setState("autoCopied"))
      .catch(() => {}); // blocked without a gesture — button still works
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      // Last-ditch fallback: select-able prompt
      window.prompt("Copy your manage link:", link());
    }
  }

  return (
    <>
      {state === "autoCopied" && (
        <p className="mt-2 text-center text-xs font-medium text-court">
          Link copied to your clipboard automatically ✓ — paste it somewhere safe
        </p>
      )}
      <button
        onClick={copy}
        className="mt-2 w-full rounded-lg border border-court py-2 text-sm font-semibold text-court"
      >
        {state === "copied" ? "Copied ✓" : "Copy manage link"}
      </button>
    </>
  );
}
