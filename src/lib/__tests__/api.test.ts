/** @jest-environment node */
import { z } from "zod";
import { ok, fail, handleError } from "@/lib/api";
import { RateLimitError } from "@/services/rateLimitService";
import { ActivePostCapError } from "@/services/listingService";

describe("api envelope", () => {
  it("ok wraps data", async () => {
    const res = ok({ x: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { x: 1 }, error: null });
  });

  it("fail wraps error", async () => {
    const res = fail("nope", 404);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ data: null, error: "nope" });
  });

  it("handleError maps known errors", async () => {
    expect(handleError(new RateLimitError()).status).toBe(429);
    expect(handleError(new ActivePostCapError()).status).toBe(409);
    const zerr = z.string().safeParse(1);
    expect(handleError(!zerr.success ? zerr.error : null).status).toBe(400);
    const res = handleError(new Error("secret db string"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Something went wrong");
  });
});
