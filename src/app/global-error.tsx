"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Last-resort boundary for render crashes that take down the whole tree (the
 * intermittent posting-freeze bug was exactly this class). Reports the crash,
 * then gives the user a way out that isn't a frozen page. Must render its own
 * <html>/<body> — when this shows, the root layout itself has crashed.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#fafaf5", color: "#111827" }}>
        <div style={{ textAlign: "center", padding: "1.5rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginTop: "0.5rem" }}>
            Sorry — the page hit an error. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "1rem", padding: "0.625rem 1.25rem", borderRadius: "0.75rem", border: "none", background: "#14532d", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
