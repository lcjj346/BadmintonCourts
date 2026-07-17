import { ZodError } from "zod";
import { RateLimitError } from "@/services/rateLimitService";
import { ActivePostCapError } from "@/services/listingService";
import { MaxPaxExceededError } from "@/services/manageService";
import { logger } from "@/lib/logger";

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data, error: null }, { status });
}

export function fail(message: string, status: number): Response {
  return Response.json({ data: null, error: message }, { status });
}

export function handleError(e: unknown): Response {
  if (e instanceof ZodError) {
    return fail(e.issues[0]?.message ?? "Invalid input", 400);
  }
  if (e instanceof RateLimitError) return fail(e.message, 429);
  if (e instanceof ActivePostCapError) return fail(e.message, 409);
  if (e instanceof MaxPaxExceededError) return fail(e.message, 400);
  logger.error({ err: e instanceof Error ? e.message : String(e) }, "unhandled route error");
  return fail("Something went wrong", 500);
}
