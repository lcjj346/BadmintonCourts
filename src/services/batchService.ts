import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const ACTIVE_POST_CAP = 10;

export class ActivePostCapError extends Error {
  constructor() {
    super(`This contact already has ${ACTIVE_POST_CAP} active posts`);
    this.name = "ActivePostCapError";
  }
}

/** Shared by listing/session create + add-to-batch — one contact can have at most 10 active posts. */
export function assertUnderActiveCap(activeCount: number, newCount: number): void {
  if (activeCount + newCount > ACTIVE_POST_CAP) throw new ActivePostCapError();
}

export function newBatchToken(): string {
  return randomUUID();
}

/** A poster identifies by phone, Telegram handle, or both — at least one is required. */
export type Contact = { phone?: string; telegramHandle?: string };

/** Matches whichever contact field the poster gave — phone takes precedence when both are set. */
export function contactWhere(contact: Contact): { phone: string } | { telegramHandle: string } {
  return contact.phone ? { phone: contact.phone } : { telegramHandle: contact.telegramHandle! };
}

/** Runs one `.create()` per item in a single transaction, returning their ids in order. */
export async function createBatch(
  creators: Prisma.PrismaPromise<{ id: string }>[],
): Promise<string[]> {
  const rows = await prisma.$transaction(creators);
  return rows.map((r) => r.id);
}
