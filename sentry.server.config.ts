import * as Sentry from "@sentry/nextjs";

// Inert until NEXT_PUBLIC_SENTRY_DSN is set (Vercel dashboard, Production scope).
// Errors only — tracing off keeps us far inside Sentry's free tier, and Vercel
// Analytics already covers traffic measurement.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});
