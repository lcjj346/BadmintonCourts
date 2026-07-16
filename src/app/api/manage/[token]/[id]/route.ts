import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { editListingSchema, editSessionSchema } from "@/lib/schemas";
import {
  closePost, reopenPost, deletePost, updatePlayersNeeded, editListing, editSession,
} from "@/services/manageService";

type Ctx = { params: Promise<{ token: string; id: string }> };

const typeSchema = z.enum(["listing", "session"]);
const playersNeededSchema = z.object({ playersNeeded: z.number().int().min(1).max(50) });

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { token, id } = await ctx.params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return fail("Invalid body", 400);

    const type = typeSchema.safeParse((body as Record<string, unknown>).type);
    if (!type.success) return fail("Invalid post type", 400);
    const action = (body as Record<string, unknown>).action;

    if (action === "close") {
      return (await closePost(token, type.data, id)) ? ok({ closed: true }) : fail("Not found", 404);
    }

    if (action === "reopen") {
      return (await reopenPost(token, type.data, id)) ? ok({ reopened: true }) : fail("Not found", 404);
    }

    if (action === "updatePlayers") {
      if (type.data !== "session") return fail("Only game posts have players needed", 400);
      const parsed = playersNeededSchema.safeParse(body);
      if (!parsed.success) return fail("Invalid body", 400);
      return (await updatePlayersNeeded(token, id, parsed.data.playersNeeded))
        ? ok({ playersNeeded: parsed.data.playersNeeded })
        : fail("Not found", 404);
    }

    if (action === "edit") {
      if (type.data === "listing") {
        const parsed = editListingSchema.safeParse(body);
        if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
        return (await editListing(token, id, parsed.data)) ? ok({ edited: true }) : fail("Not found", 404);
      }
      const parsed = editSessionSchema.safeParse(body);
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input", 400);
      return (await editSession(token, id, parsed.data)) ? ok({ edited: true }) : fail("Not found", 404);
    }

    return fail("Unknown action", 400);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { token, id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const type = typeSchema.safeParse(
      body && typeof body === "object" ? (body as Record<string, unknown>).type : undefined,
    );
    if (!type.success) return fail("Invalid post type", 400);
    return (await deletePost(token, type.data, id)) ? ok({ deleted: true }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
