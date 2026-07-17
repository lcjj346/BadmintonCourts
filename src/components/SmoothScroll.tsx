"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Eases mouse-wheel/trackpad scrolling on desktop. Renders nothing — Lenis works by
 * intercepting scroll events on the existing document, not by wrapping content in a
 * custom scroll container, so it doesn't disturb the sticky filter bar or the fixed
 * "+" post button on the board page.
 *
 * syncTouch stays off (the default): this app's own design goal is "used courtside on
 * a phone", so touch scrolling keeps the native, zero-latency feel instead of being
 * smoothed — smoothing touch input is what makes Lenis feel laggy on mobile.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      smoothWheel: true,
      syncTouch: false,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return null;
}
