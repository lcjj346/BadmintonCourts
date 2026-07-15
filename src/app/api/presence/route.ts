import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { recordPresence } from "@/services/presenceService";

const presenceSchema = z.object({ id: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const body = presenceSchema.safeParse(await req.json());
    if (!body.success) return fail("Invalid input", 400);
    const count = await recordPresence(body.data.id);
    return ok({ count });
  } catch (e) {
    return handleError(e);
  }
}
