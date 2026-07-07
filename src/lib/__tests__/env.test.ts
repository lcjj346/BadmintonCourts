/** @jest-environment node */
import { envSchema } from "@/lib/env";

describe("envSchema", () => {
  const valid = {
    DATABASE_URL: "postgresql://u:p@h:5432/db",
    DIRECT_URL: "postgresql://u:p@h:5432/db",
    IP_HASH_SALT: "some-salt",
  };

  it("accepts valid env", () => {
    expect(envSchema.parse(valid)).toEqual(valid);
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL, ...rest } = valid;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it("rejects empty IP_HASH_SALT", () => {
    expect(() => envSchema.parse({ ...valid, IP_HASH_SALT: "" })).toThrow();
  });
});
