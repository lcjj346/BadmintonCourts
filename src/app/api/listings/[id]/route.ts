import { ok, fail, handleError } from "@/lib/api";
import { getListing } from "@/services/listingService";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const listing = await getListing(id);
    return listing ? ok(listing) : fail("Not found", 404);
  } catch (e) {
    return handleError(e);
  }
}
