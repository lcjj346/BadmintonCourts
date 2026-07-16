import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Shared board-card shell for a court listing or a game session — the two only
 * differ in the price badge content and an optional chip (skill/players) under
 * the venue line, both passed in by the caller.
 */
export function EntryCard({
  href, claimed, status, title, startTime, endTime, region, priceNode, extra,
}: {
  href: string;
  claimed: boolean;
  status: string;
  title: string;
  startTime: string;
  endTime: string;
  region: string;
  priceNode: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-court/10 bg-white pr-4 shadow-sm transition-shadow active:shadow-none ${
        claimed ? "opacity-60" : "hover:shadow-md"
      }`}
    >
      <span aria-hidden className={`w-1.5 shrink-0 ${claimed ? "bg-gray-300" : "bg-court"}`} />
      <div className="grid flex-1 grid-cols-[1fr_auto] items-start gap-3 py-3.5">
        <div className="min-w-0 overflow-hidden">
          <div className="truncate font-semibold leading-snug text-gray-900">{title}</div>
          <div className="mt-0.5 text-[13px] text-gray-500">
            <span className="font-medium tabular-nums text-gray-700">
              {startTime}–{endTime}
            </span>
            <span className="px-1.5 text-gray-300">·</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-court/70">{region}</span>
          </div>
          {extra}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="whitespace-nowrap rounded-lg bg-court-light px-2.5 py-1 text-[15px] font-bold text-court">
            {priceNode}
          </span>
          {claimed && <StatusBadge status={status} />}
        </div>
      </div>
    </Link>
  );
}
