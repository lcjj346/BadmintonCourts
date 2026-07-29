"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "badmintonsg_intro_seen";
const WORDMARK = "BADMINTONSG";
const FLAP_START_MS = 900;
const FLAP_STEP_MS = 40;
const TOTAL_DURATION_MS = 2350;

function Flaps() {
  return (
    <>
      {WORDMARK.split("").map((ch, i) => (
        <div
          key={i}
          className="intro-flap"
          style={{ animationDelay: `${FLAP_START_MS + i * FLAP_STEP_MS}ms` }}
        >
          {ch}
        </div>
      ))}
    </>
  );
}

export function IntroSplash() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      return;
    }
    setPlay(true);
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, "1");
      setPlay(false);
    }, TOTAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!play) return null;

  return createPortal(
    <div className="intro-overlay playing" aria-hidden="true">
      {/* Portrait court — narrow viewports (see the "intro-scene-h" media query below). */}
      <div className="intro-scene intro-scene-v">
        <div className="intro-floor" />
        <svg className="intro-lines" viewBox="0 0 220 420" preserveAspectRatio="none">
          <rect className="boundary" x="10" y="10" width="200" height="400" rx="4" />
          <line className="sideline" x1="25" y1="10" x2="25" y2="410" />
          <line className="sideline" x1="195" y1="10" x2="195" y2="410" />
          <line className="service" x1="10" y1="151" x2="210" y2="151" />
          <line className="service" x1="10" y1="269" x2="210" y2="269" />
          <line className="dlong" x1="10" y1="33" x2="210" y2="33" />
          <line className="dlong" x1="10" y1="387" x2="210" y2="387" />
          <line className="center" x1="110" y1="10" x2="110" y2="151" />
          <line className="center" x1="110" y1="269" x2="110" y2="410" />
        </svg>
        <div className="intro-net intro-net-v" />
        <div className="intro-netband intro-netband-v">
          <Flaps />
        </div>
      </div>

      {/* Landscape court — wide viewports (laptop/desktop). Same real proportions,
          rotated: the net runs vertically (as it does on an actual court viewed
          down its length) and the wordmark stacks along it instead of overflowing
          a tall, narrow box that can't fill a wide window. */}
      <div className="intro-scene intro-scene-h">
        <div className="intro-floor" />
        <svg className="intro-lines" viewBox="0 0 420 220" preserveAspectRatio="none">
          <rect className="boundary" x="10" y="10" width="400" height="200" rx="4" />
          <line className="sideline" x1="10" y1="25" x2="410" y2="25" />
          <line className="sideline" x1="10" y1="195" x2="410" y2="195" />
          <line className="service" x1="151" y1="10" x2="151" y2="210" />
          <line className="service" x1="269" y1="10" x2="269" y2="210" />
          <line className="dlong" x1="33" y1="10" x2="33" y2="210" />
          <line className="dlong" x1="387" y1="10" x2="387" y2="210" />
          <line className="center" x1="10" y1="110" x2="151" y2="110" />
          <line className="center" x1="269" y1="110" x2="410" y2="110" />
        </svg>
        <div className="intro-net intro-net-h" />
        <div className="intro-netband intro-netband-h">
          <Flaps />
        </div>
      </div>
    </div>,
    document.body,
  );
}
