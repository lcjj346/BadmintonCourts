"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateLabel, formatPrice } from "@/lib/time";
import { skillRangeLabel, type SkillLevel } from "@/lib/skill";
import { StatusBadge } from "@/components/StatusBadge";
import { ManageActions } from "@/components/ManageActions";
import type { ManagedPost } from "@/services/manageService";

export function ManagePostList({
  token, initialPosts, isGame,
}: {
  token: string; initialPosts: ManagedPost[]; isGame: boolean;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);

  // Mark-as-sold/reopen/edit only trigger router.refresh() (no local mutation of
  // their own), so this local copy needs to resync whenever the server component
  // above re-renders with fresh data — a plain useState wouldn't pick up a changed
  // initialPosts prop on its own.
  useEffect(() => setPosts(initialPosts), [initialPosts]);

  // Removes the card immediately instead of waiting on router.refresh()'s RSC
  // round-trip — see the comment in ManageActions.remove() for why.
  function handleDeleted(id: string) {
    setPosts((prev) => {
      const next = prev.filter((p) => p.post.id !== id);
      if (next.length === 0) router.push("/");
      return next;
    });
  }

  return (
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
              <ManageActions token={token} post={managed} onDeleted={() => handleDeleted(post.id)} />
            </div>
          );
        })}
      </div>
      <Link
        href={`/post/${isGame ? "game" : "court"}?batchToken=${token}`}
        className="mt-4 block w-full rounded-xl border border-dashed border-court py-2.5 text-center text-sm font-semibold text-court"
      >
        + Add another {isGame ? "game" : "court"}
      </Link>
    </>
  );
}
