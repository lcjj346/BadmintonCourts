import { ok, fail, handleError } from "@/lib/api";
import { getClientIp, hashIp } from "@/lib/ip";
import { revealSessionContact } from "@/services/sessionService";
import { assertRevealAllowed } from "@/services/rateLimitService";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await assertRevealAllowed(hashIp(getClientIp(req)), id);
    const contact = await revealSessionContact(id);
    return contact?.phone || contact?.telegramHandle ? ok(contact) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
