import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export class ActivePostCapError extends Error {
  constructor() {
    super("This phone number already has 5 active posts");
    this.name = "ActivePostCapError";
  }
}

const ACTIVE_POST_CAP = 5;

/** Shared by listing/session create + add-to-batch — one phone can have at most 5 active posts. */
export function assertUnderActiveCap(activeCount: number, newCount: number): void {
  if (activeCount + newCount > ACTIVE_POST_CAP) throw new ActivePostCapError();
}

export function newBatchToken(): string {
  return randomUUID();
}

/** Runs one `.create()` per item in a single transaction, returning their ids in order. */
export async function createBatch(
  creators: Prisma.PrismaPromise<{ id: string }>[],
): Promise<string[]> {
  const rows = await prisma.$transaction(creators);
  return rows.map((r) => r.id);
}
