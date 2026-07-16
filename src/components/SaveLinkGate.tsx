"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gates its children behind an explicit "copy the manage link" click. Silent
 * auto-copy is easy to miss, so on a freshly-created post we force the tap —
 * the editing controls (mark sold/filled, delete) stay hidden until then.
 */
export function SaveLinkGate({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState<{ x: string; y: string }>({ x: "50%", y: "35%" });

  // Track the card's viewport position so the dim overlay's spotlight stays
  // centered on it even as the layout shifts (resize, orientation change).
  useEffect(() => {
    if (copied) return;
    function measure() {
      const r = cardRef.current?.getBoundingClientRect();
      if (!r) return;
      setSpotlight({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [copied]);

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
    <>
      <div
        aria-hidden="true"
        className="spotlight-dim pointer-events-none fixed inset-0 z-40"
        style={{
          background: `radial-gradient(circle at ${spotlight.x} ${spotlight.y}, transparent 0px, transparent 130px, rgba(15,23,42,0.6) 280px)`,
        }}
      />
      <div
        ref={cardRef}
        className="relative z-50 mt-3 rounded-xl border-2 border-court bg-court-light p-4 text-center"
      >
        <p className="text-sm font-semibold text-court">
          Copy your manage link before continuing — without it you can&apos;t edit or close this
          post later.
        </p>
        <div className="relative mt-3">
          <button
            onClick={copy}
            className="w-full rounded-xl bg-court py-3 font-semibold text-white transition-colors hover:bg-court/90"
          >
            Copy my manage link
          </button>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-drift pointer-events-none absolute left-1/2 top-1/2 size-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          >
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="white" stroke="#14532d" strokeWidth="1" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </>
  );
}
