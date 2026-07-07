import { ok, fail, handleError } from "@/lib/api";
import { getSession } from "@/services/sessionService";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const session = await getSession(id);
    return session ? ok(session) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
