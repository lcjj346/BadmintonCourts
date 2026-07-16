import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { addListingBatchItemsSchema, addSessionBatchItemsSchema } from "@/lib/schemas";
import { addListingsToBatch } from "@/services/listingService";
import { addSessionsToBatch } from "@/services/sessionService";

type Ctx = { params: Promise<{ token: string }> };

const typeSchema = z.enum(["listing", "session"]);

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const type = typeSchema.safeParse((body as Record<string, unknown>).type);
    if (!type.success) return fail("Invalid post type", 400);

    if (type.data === "listing") {
      const parsed = addListingBatchItemsSchema.safeParse(body);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
      const result = await addListingsToBatch(token, parsed.data.items);
      return result ? ok(result, 201) : fail("Not found", 404);
    }

    const parsed = addSessionBatchItemsSchema.safeParse(body);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    const result = await addSessionsToBatch(token, parsed.data.items);
    return result ? ok(result, 201) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
