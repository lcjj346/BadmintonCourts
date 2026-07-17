import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findPostsByBatchToken } from "@/services/manageService";
import { ManagePostList } from "@/components/ManagePostList";
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

  const list = <ManagePostList token={token} initialPosts={posts} isGame={isGame} />;

  const backLink = (
    <Link href="/" className="mt-4 block text-center text-sm text-gray-400">← Back to the board</Link>
  );

  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      {created ? (
        <SaveLinkGate
          banner={
            <div className="rounded-2xl bg-court-light p-4">
              <h1 className="font-bold text-court">Posted!</h1>
              <p className="mt-1 text-sm text-court">
                This page&apos;s link is the only way to edit, mark {isGame ? "filled" : "sold"}, or delete{" "}
                {multiple ? `these ${posts.length} posts` : "your post"} — there&apos;s no login.
              </p>
            </div>
          }
          footer={backLink}
        >
          <div className="mt-4">{list}</div>
        </SaveLinkGate>
      ) : (
        <>
          <div className="mt-4">{list}</div>
          {backLink}
        </>
      )}
    </main>
  );
}
