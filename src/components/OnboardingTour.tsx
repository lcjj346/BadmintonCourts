"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "badmintonsg_tour_seen";
const SPOTLIGHT_PAD = 8;

type Step = { target: string; title: string; body: string };

const STEPS: Step[] = [
  {
    target: "tabs",
    title: "Courts & Players",
    body: "Courts shows balloted slots someone can't use. Players shows people looking for others to join their game.",
  },
  {
    target: "date-strip",
    title: "Pick a date",
    body: "Pick a date, or two for a range, to see what's on then.",
  },
  {
    target: "filters",
    title: "Narrow it down",
    body: "Filter by region, venue, time, or skill level to find the right match faster.",
  },
  {
    target: "post-button",
    title: "Post in seconds",
    body: "Got a court to give up, or want to find players? Tap here to post.",
  },
  {
    target: "faq",
    title: "Need more help?",
    body: "The FAQ covers post lifetime, editing/managing a post, and the skill level guide.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function measure(target: string): Rect | null {
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const recompute = useCallback(() => {
    setRect(measure(STEPS[stepIndex].target));
  }, [stepIndex]);

  // Bring the target into view and measure it, on open and on every step change —
  // a target scrolled out of view (common on mobile, e.g. the filter bar) would
  // otherwise get spotlighted at the wrong on-screen position or not at all.
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector(`[data-tour="${STEPS[stepIndex].target}"]`);
    // jsdom (unit tests) has no scrollIntoView implementation at all.
    el?.scrollIntoView?.({ block: "center", behavior: "auto" });
    const id = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(id);
  }, [open, stepIndex, recompute]);

  // Reposition on resize/scroll (throttled to one measurement per frame) so the
  // spotlight tracks the target through orientation changes and page scrolling.
  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(recompute);
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [open, recompute]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function next() {
    if (stepIndex === STEPS.length - 1) finish();
    else setStepIndex((i) => i + 1);
  }

  function restart() {
    setStepIndex(0);
    setOpen(true);
  }

  if (!mounted) return null;

  return (
    <>
      <button
        type="button"
        onClick={restart}
        aria-label="Replay tutorial"
        className="flex size-6 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-500 transition-colors hover:border-court hover:text-court"
      >
        ?
      </button>
      {open && rect &&
        createPortal(
          <TourOverlay
            rect={rect}
            step={STEPS[stepIndex]}
            stepIndex={stepIndex}
            total={STEPS.length}
            onNext={next}
            onSkip={finish}
          />,
          document.body,
        )}
    </>
  );
}

function TourOverlay({
  rect, step, stepIndex, total, onNext, onSkip,
}: {
  rect: Rect; step: Step; stepIndex: number; total: number; onNext: () => void; onSkip: () => void;
}) {
  const isLast = stepIndex === total - 1;

  const spotlightStyle: React.CSSProperties = {
    top: rect.top - SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
    boxShadow: "0 0 0 9999px rgba(15,23,42,0.7)",
  };

  const TOOLTIP_WIDTH = 288;
  const MARGIN = 12;
  const spaceBelow = typeof window !== "undefined" ? window.innerHeight - (rect.top + rect.height) : 0;
  const placeBelow = spaceBelow > 180;
  const left = typeof window !== "undefined"
    ? Math.min(Math.max(rect.left, MARGIN), Math.max(window.innerWidth - TOOLTIP_WIDTH - MARGIN, MARGIN))
    : rect.left;

  const tooltipStyle: React.CSSProperties = {
    left,
    width: TOOLTIP_WIDTH,
    maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
    ...(placeBelow
      ? { top: rect.top + rect.height + SPOTLIGHT_PAD + MARGIN }
      : { bottom: (typeof window !== "undefined" ? window.innerHeight : 0) - rect.top + SPOTLIGHT_PAD + MARGIN }),
  };

  return (
    <>
      <div data-testid="tour-backdrop" className="fixed inset-0 z-[90]" />
      <div aria-hidden className="fixed z-[95] rounded-xl transition-all duration-300" style={spotlightStyle} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed z-[100] rounded-2xl border-t-4 border-court bg-white p-4 shadow-[0_-12px_40px_-12px_rgba(20,83,45,0.25)] transition-all duration-300"
        style={tooltipStyle}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? "bg-court" : "bg-gray-200"}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tutorial"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <h2 className="mb-1 text-sm font-bold text-gray-900">{step.title}</h2>
        <p className="mb-4 text-sm text-gray-600">{step.body}</p>
        <div className="flex items-center justify-between">
          <button type="button" onClick={onSkip} className="text-xs font-medium text-gray-400 hover:text-gray-600">
            Skip tutorial
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-court px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-court/90"
          >
            {isLast ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
