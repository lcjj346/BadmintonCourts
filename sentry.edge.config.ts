import * as Sentry from "@sentry/nextjs";

// No edge routes/middleware today — kept so one ever added later is covered.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});
