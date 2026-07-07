import { createHash } from "crypto";
import { env } from "@/lib/env";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + env.IP_HASH_SALT).digest("hex");
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
