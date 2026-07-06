import { ok, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { reportPost } from "@/services/reportService";
import { assertWriteAllowed } from "@/services/rateLimitService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ipHash = hashIp(getClientIp(req));
    await assertWriteAllowed(ipHash);
    await reportPost("session", id, ipHash);
    return ok({ reported: true });
  } catch (e) {
    return handleError(e);
  }
}
