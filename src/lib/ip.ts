import { createHash } from "crypto";
import { env } from "@/lib/env";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + env.IP_HASH_SALT).digest("hex");
}

export function getClientIp(req: Request): string {
  // On Vercel, x-forwarded-for is set by Vercel's own edge and client-supplied
  // values are stripped before the request reaches this function ("we currently
  // overwrite the X-Forwarded-For header and do not forward external IPs" —
  // vercel.com/docs/headers/request-headers#x-forwarded-for), so this isn't
  // spoofable in production short of an Enterprise Trusted Proxy setup we don't
  // use. x-vercel-forwarded-for carries the same value but stays authoritative
  // even if a proxy is ever added in front of Vercel, so prefer it.
  const fwd = req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
