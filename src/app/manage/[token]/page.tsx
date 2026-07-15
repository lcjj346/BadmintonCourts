import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPostByToken } from "@/services/manageService";
import { formatDateLabel } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { ManageActions } from "@/components/ManageActions";
import { CopyLinkButton } from "@/components/CopyLinkButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ManagePage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { token } = await params;
  const { created } = await searchParams;
  const found = await findPostByToken(token);
  if (!found) notFound();

  const { type, post } = found;
  const closed = post.status === "SOLD" || post.status === "FILLED";

  return (
    <main className="pt-6">
      {created && (
        <div className="rounded-2xl bg-court-light p-4">
          <h1 className="font-bold text-court">🎉 Posted!</h1>
          <p className="mt-1 text-sm text-court">
            <strong>Save this page&apos;s link.</strong> It&apos;s the only way to mark your post
            {type === "listing" ? " sold" : " filled"}
            {type === "session" ? ", update players needed," : ""} or delete it — there&apos;s no login.
          </p>
          <CopyLinkButton />
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <h2 className="font-bold">{post.venueName}</h2>
          <StatusBadge status={post.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(post.date)} · {post.startTime}–{post.endTime}
        </p>
        <ManageActions token={token} type={type} closed={closed} playersNeeded={post.playersNeeded} />
      </div>

      <Link href="/" className="mt-4 block text-center text-sm text-gray-400">← Back to the board</Link>
    </main>
  );
}
