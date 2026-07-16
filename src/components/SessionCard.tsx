import Link from "next/link";
import type { PublicSession } from "@/services/sessionService";
import { formatPrice } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";
import { skillRangeLabel } from "@/lib/skill";

export function SessionCard({ session }: { session: PublicSession }) {
  const filled = session.status !== "OPEN";
  return (
    <Link
      href={`/session/${session.id}`}
      className={`group relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-court/10 bg-white pr-4 shadow-sm transition-shadow active:shadow-none ${
        filled ? "opacity-60" : "hover:shadow-md"
      }`}
    >
      <span
        aria-hidden
        className={`w-1.5 shrink-0 ${filled ? "bg-gray-300" : "bg-court"}`}
      />
      <div className="flex flex-1 items-start justify-between gap-3 py-3.5">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-snug text-gray-900">
            {session.venue.name}
          </div>
          <div className="mt-0.5 text-[13px] text-gray-500">
            <span className="font-medium tabular-nums text-gray-700">
              {session.startTime}–{session.endTime}
            </span>
            <span className="px-1.5 text-gray-300">·</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-court/70">
              {session.venue.region}
            </span>
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-court-light/70 px-2 py-0.5 text-[11px] font-semibold text-court">
            <span className="tabular-nums">Needs {session.playersNeeded}</span>
            <span className="text-court/40">·</span>
            <span>{skillRangeLabel(session.skillMin, session.skillMax)}</span>
          </div>
          {session.venue.availabilityNote && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700">
              <span aria-hidden className="mt-[3px] size-1 shrink-0 rounded-full bg-amber-500" />
              <span>{session.venue.availabilityNote}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="whitespace-nowrap rounded-lg bg-court-light px-2.5 py-1 text-[15px] font-bold text-court">
            {formatPrice(session.pricePerPlayerCents)}
            {session.pricePerPlayerCents !== null && session.pricePerPlayerCents > 0 && (
              <span className="text-[10px] font-normal text-court/50">/pax</span>
            )}
          </span>
          {filled && <StatusBadge status={session.status} />}
        </div>
      </div>
    </Link>
  );
}
