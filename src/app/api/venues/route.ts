import { ok, handleError } from "@/lib/api";
import { listVenues } from "@/services/venueService";

export async function GET() {
  try {
    return ok(await listVenues());
  } catch (e) {
    return handleError(e);
  }
}
