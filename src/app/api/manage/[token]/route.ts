import { ok, fail, handleError } from "@/lib/api";
import { findPostByToken, closePostByToken, deletePostByToken } from "@/services/manageService";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const found = await findPostByToken(token);
    return found ? ok(found) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
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
