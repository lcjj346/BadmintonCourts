import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import {
  findPostByToken, closePostByToken, deletePostByToken, updatePlayersNeeded,
} from "@/services/manageService";

type Ctx = { params: Promise<{ token: string }> };

const playersNeededSchema = z.object({ playersNeeded: z.number().int().min(1).max(50) });

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const found = await findPostByToken(token);
    return found ? ok(found) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;

    // A JSON body containing playersNeeded → edit players-needed (session posts only).
    // Empty/no body → close (req.json() throws on an empty body; fall through to close).
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }

    if (body && typeof body === "object" && "playersNeeded" in body) {
      const parsed = playersNeededSchema.safeParse(body);
      if (!parsed.success) return fail("Invalid body", 400);
      const found = await findPostByToken(token);
      if (!found) return fail("Not found", 404);
      if (found.type !== "session") return fail("Only game posts have players needed", 400);
      await updatePlayersNeeded(token, parsed.data.playersNeeded);
      return ok({ playersNeeded: parsed.data.playersNeeded });
    }

    return (await closePostByToken(token)) ? ok({ closed: true }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    return (await deletePostByToken(token)) ? ok({ deleted: true }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
