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

/**
 * Runs `fn` inside a transaction holding a Postgres advisory lock keyed on the
 * contact's phone/Telegram handle — this is what actually makes the active-post
 * cap enforceable. Without it, two concurrent create/add-to-batch requests for
 * the same contact each count the same "active so far" number before either has
 * committed its own rows, so both can pass the cap check and together land well
 * over ACTIVE_POST_CAP. The lock serializes requests for the SAME contact only;
 * unrelated posters are never blocked by each other. `pg_advisory_xact_lock`
 * auto-releases when the transaction ends (commit or rollback), so a thrown
 * ActivePostCapError still releases the lock correctly.
 */
export async function withContactLock<T>(
  contact: Contact,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const key = contact.phone ?? contact.telegramHandle!;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    return fn(tx);
  });
}
