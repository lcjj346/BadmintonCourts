import { ok, fail, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { venueSuggestionSchema } from "@/lib/schemas";
import { assertWriteAllowed } from "@/services/rateLimitService";
import { createVenueSuggestion } from "@/services/venueService";

export async function POST(req: Request) {
  try {
    const body = venueSuggestionSchema.safeParse(await req.json());
    if (!body.success) return fail("Invalid input", 400);
    await assertWriteAllowed(hashIp(getClientIp(req)));
    await createVenueSuggestion(body.data.name, body.data.details);
    return ok({ suggested: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}
