import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting. This is the piece that would have surfaced the
// intermittent "Maximum update depth exceeded" posting freeze in hours instead
// of weeks — client crashes were previously invisible (Vercel Hobby keeps
// runtime logs for ~1 hour, and nothing captured the browser at all).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
