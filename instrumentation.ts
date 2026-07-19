import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown from server components / route handlers that Next
// swallows into its own error handling (our handleError covers routes' catch
// blocks; this covers everything that never reaches them).
export const onRequestError = Sentry.captureRequestError;
