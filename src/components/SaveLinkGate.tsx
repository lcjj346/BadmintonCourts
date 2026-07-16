"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Rect = { top: number; left: number; right: number; bottom: number };

/**
 * Gates its children behind an explicit "copy the manage link" click. Silent
 * auto-copy is easy to miss, so on a freshly-created post we force the tap —
 * the editing controls (mark sold/filled, delete) stay hidden until then.
 *
 * `banner` and `footer` render alongside the gate card (inside the same lit,
 * un-dimmed area) but aren't gated themselves — only `children` waits on copy.
 */
export function SaveLinkGate({
  banner, footer, children,
}: { banner: ReactNode; footer: ReactNode; children: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // Track the lit area's viewport position so the dim overlay's cutout stays
  // aligned with it even as the layout shifts (resize, orientation change).
  useEffect(() => {
    if (copied) return;
    function measure() {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom });
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
        {banner}
        <p className="mt-3 text-center text-xs font-medium text-court">
          Link copied ✓ — paste it somewhere safe
        </p>
        {children}
        {footer}
      </>
    );
  }

  const pad = 14;
  const cut = rect && {
    top: rect.top - pad, left: rect.left - pad, right: rect.right + pad, bottom: rect.bottom + pad,
  };

  return (
    <>
      {cut && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40">
          <div className="spotlight-dim absolute inset-x-0 top-0 bg-black" style={{ height: cut.top }} />
          <div className="spotlight-dim absolute inset-x-0 bottom-0 bg-black" style={{ top: cut.bottom }} />
          <div className="spotlight-dim absolute left-0 bg-black" style={{ top: cut.top, height: cut.bottom - cut.top, width: cut.left }} />
          <div className="spotlight-dim absolute right-0 bg-black" style={{ top: cut.top, height: cut.bottom - cut.top, left: cut.right }} />
        </div>
      )}
      <div ref={wrapRef} className="relative z-50">
        {banner}
        <div className="mt-3 rounded-xl border-2 border-court bg-court-light p-4 text-center">
          <p className="text-sm font-semibold text-court">
            Copy your manage link before continuing — without it you can&apos;t edit or close this
            post later.
          </p>
          <button
            onClick={copy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-court py-3 font-semibold text-white transition-colors hover:bg-court/90"
          >
            Copy my manage link
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-drift pointer-events-none size-5 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            >
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="white" stroke="#14532d" strokeWidth="1" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {footer}
      </div>
    </>
  );
}
