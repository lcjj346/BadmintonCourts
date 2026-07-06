import { ok, fail, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { revealSessionPhone } from "@/services/sessionService";
import { assertRevealAllowed } from "@/services/rateLimitService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await assertRevealAllowed(hashIp(getClientIp(req)), id);
    const phone = await revealSessionPhone(id);
    return phone ? ok({ phone }) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
