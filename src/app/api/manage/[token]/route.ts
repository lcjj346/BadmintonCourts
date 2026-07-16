import { ok, handleError } from "@/lib/api";
import { findPostsByBatchToken } from "@/services/manageService";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    return ok(await findPostsByBatchToken(token));
  } catch (e) {
    return handleError(e);
  }
}
