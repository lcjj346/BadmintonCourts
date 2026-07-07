/** @jest-environment node */
import { hashIp, getClientIp } from "@/lib/ip";

describe("ip", () => {
  it("hashIp is deterministic, salted, and not the raw ip", () => {
    const h = hashIp("1.2.3.4");
    expect(h).toBe(hashIp("1.2.3.4"));
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(h).not.toContain("1.2.3.4");
  });

  it("getClientIp reads first x-forwarded-for entry", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("getClientIp falls back to 'unknown'", () => {
    expect(getClientIp(new Request("http://x"))).toBe("unknown");
  });
});
