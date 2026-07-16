import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPostsByBatchToken } from "@/services/manageService";
import { formatDateLabel, formatPrice } from "@/lib/time";
import { skillRangeLabel, type SkillLevel } from "@/lib/skill";
import { StatusBadge } from "@/components/StatusBadge";
import { ManageActions } from "@/components/ManageActions";
import { SaveLinkGate } from "@/components/SaveLinkGate";

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
  const posts = await findPostsByBatchToken(token);
  if (posts.length === 0) notFound();

  const isGame = posts[0].type === "session";
  const multiple = posts.length > 1;

  const addMoreLink = (
    <Link
      href={`/post/${isGame ? "game" : "court"}?batchToken=${token}`}
      className="mt-4 block w-full rounded-xl border border-dashed border-court py-2.5 text-center text-sm font-semibold text-court"
    >
      + Add another {isGame ? "game" : "court"}
    </Link>
  );

  const list = (
    <>
      <div className="space-y-3">
        {posts.map((managed) => {
          const { type, post } = managed;
          return (
            <div key={post.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <h2 className="font-bold">{post.venueName}</h2>
                <StatusBadge status={post.status} />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {formatDateLabel(post.date)} · {post.startTime}–{post.endTime}
              </p>
              <p className="mt-1 text-sm font-medium text-court">
                {type === "listing"
                  ? formatPrice(post.priceCents ?? null)
                  : `Needs ${post.playersNeeded} · ${skillRangeLabel(post.skillMin as SkillLevel, post.skillMax as SkillLevel)} · ${formatPrice(post.pricePerPlayerCents ?? null)}/pax`}
              </p>
              <ManageActions token={token} post={managed} postCount={posts.length} />
            </div>
          );
        })}
      </div>
      {addMoreLink}
    </>
  );

  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      {created && (
        <div className="rounded-2xl bg-court-light p-4">
          <h1 className="font-bold text-court">Posted!</h1>
          <p className="mt-1 text-sm text-court">
            This page&apos;s link is the only way to edit, mark {isGame ? "filled" : "sold"}, or delete{" "}
            {multiple ? `these ${posts.length} posts` : "your post"} — there&apos;s no login.
          </p>
        </div>
      )}

      <div className="mt-4">{created ? <SaveLinkGate>{list}</SaveLinkGate> : list}</div>

      <Link href="/" className="mt-4 block text-center text-sm text-gray-400">← Back to the board</Link>
    </main>
  );
}
