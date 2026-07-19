import { ZodError } from "zod";
import * as Sentry from "@sentry/nextjs";
import { RateLimitError } from "@/services/rateLimitService";
import { ActivePostCapError } from "@/services/listingService";
import { logger } from "@/lib/logger";

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data, error: null }, { status });
}

export function fail(message: string, status: number): Response {
  return Response.json({ data: null, error: message }, { status });
}

/**
 * `Object.fromEntries(url.searchParams)` silently keeps only the LAST value for a
 * repeated key (?date=A&date=B -> {date: "B"}) — wrong for boardFilterSchema's
 * multi-select date/region/skill params, which expect an array when a key repeats.
 * This mirrors the shape Next.js's own `searchParams` page prop already produces
 * (string | string[] per key), which boardFilterSchema is built to parse.
 */
export function searchParamsToFilters(url: URL): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0];
  }
  return params;
}

export function handleError(e: unknown): Response {
  if (e instanceof ZodError) {
    return fail(e.issues[0]?.message ?? "Invalid input", 400);
  }
  if (e instanceof RateLimitError) return fail(e.message, 429);
  if (e instanceof ActivePostCapError) return fail(e.message, 409);
  // Only genuinely unexpected errors reach here (known cases mapped above) —
  // report them: Vercel Hobby keeps runtime logs ~1 hour, so pino alone means
  // a 3am failure is invisible by morning.
  Sentry.captureException(e);
  logger.error({ err: e instanceof Error ? e.message : String(e) }, "unhandled route error");
  return fail("Something went wrong", 500);
}
