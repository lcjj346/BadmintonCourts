import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validated lazily, on first property access — NOT at import time. `next build`
 * imports every route while collecting page data, and preview builds have no env
 * vars at all (they're deliberately scoped to Production only so previews can
 * never see the real database) — an import-time parse made every preview build
 * fail before a single request existed. At runtime the first real access still
 * fails fast with the same clear ZodError if something is missing.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    cached ??= envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      IP_HASH_SALT: process.env.IP_HASH_SALT,
    });
    return cached[key as keyof Env];
  },
});
