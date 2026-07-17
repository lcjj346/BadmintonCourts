import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { addListingBatchItemsSchema, addSessionBatchItemsSchema } from "@/lib/schemas";
import { getClientIp, hashIp } from "@/lib/ip";
import { addListingsToBatch } from "@/services/listingService";
import { addSessionsToBatch } from "@/services/sessionService";
import { assertCreateAllowed, recordCreate } from "@/services/rateLimitService";

type Ctx = { params: Promise<{ token: string }> };

const typeSchema = z.enum(["listing", "session"]);

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const type = typeSchema.safeParse((body as Record<string, unknown>).type);
    if (!type.success) return fail("Invalid post type", 400);

    // A valid manage token still gates most abuse via the active-post cap
    // below, but without this, request *frequency* here was unbounded —
    // unlike every other create path — so a held token could be used to
    // hammer create/delete cycles. Same CREATE bucket as the main routes.
    const ipHash = hashIp(getClientIp(req));
    await assertCreateAllowed(ipHash);

    if (type.data === "listing") {
      const parsed = addListingBatchItemsSchema.safeParse(body);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
      const result = await addListingsToBatch(token, parsed.data.items);
      if (!result) return fail("Not found", 404);
      await recordCreate(ipHash);
      return ok(result, 201);
    }

    const parsed = addSessionBatchItemsSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    const result = await addSessionsToBatch(token, parsed.data.items);
    if (!result) return fail("Not found", 404);
    await recordCreate(ipHash);
    return ok(result, 201);
  } catch (e) {
    return handleError(e);
  }
}
