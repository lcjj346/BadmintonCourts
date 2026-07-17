import { ok, fail, handleError, searchParamsToFilters } from "@/lib/api";
import { boardFilterSchema, createSessionSchema } from "@/lib/schemas";
import { getClientIp, hashIp } from "@/lib/ip";
import { listSessions, createSessionBatch } from "@/services/sessionService";
import { assertAndRecordCreate } from "@/services/rateLimitService";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = boardFilterSchema.safeParse(searchParamsToFilters(url));
    if (!parsed.success) return fail("Invalid filters", 400);
    return ok(await listSessions(parsed.data));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSessionSchema.safeParse(await req.json());
    if (!body.success) {
      // Honeypot trips look like success to the bot, write nothing.
      const issue = body.error.issues[0];
      if (issue?.path[0] === "website") return ok({ batchToken: "ok", ids: [] }, 201);
      return fail(issue?.message ?? "Invalid input", 400);
    }
    const ipHash = hashIp(getClientIp(req));
    await assertAndRecordCreate(ipHash);
    const created = await createSessionBatch(body.data.items, {
      phone: body.data.phone, telegramHandle: body.data.telegramHandle,
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
