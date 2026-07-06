import { prisma } from "@/lib/db";

export async function reportPost(
  targetType: "listing" | "session", targetId: string, ipHash: string,
): Promise<void> {
  const existing = await prisma.reportFlag.findFirst({
    where: { targetType, targetId, ipHash },
  });
  if (existing) return; // idempotent per ip
  await prisma.reportFlag.create({ data: { targetType, targetId, ipHash } });
}
