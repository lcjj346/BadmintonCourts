import type { PublicSession } from "@/services/sessionService";
import { formatPrice } from "@/lib/time";
import { resolveVenueDisplay } from "@/lib/venue";
import { EntryCard } from "@/components/EntryCard";
import { skillRangeLabel } from "@/lib/skill";

export function SessionCard({ session }: { session: PublicSession }) {
  const venue = resolveVenueDisplay(session);
  return (
    <EntryCard
      href={`/session/${session.id}`}
      claimed={session.status !== "OPEN"}
      status={session.status}
      title={venue.name}
      startTime={session.startTime}
      endTime={session.endTime}
      region={venue.region}
      priceNode={
        <>
          {formatPrice(session.pricePerPlayerCents)}
          {session.pricePerPlayerCents !== null && session.pricePerPlayerCents > 0 && (
            <span className="text-[10px] font-normal text-court/50">/pax</span>
          )}
        </>
      }
      extra={
        <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-court-light/70 px-2 py-0.5 text-[11px] font-semibold text-court">
          <span className="tabular-nums">
            Needs {session.playersNeeded}{session.maxPax ? ` (max ${session.maxPax})` : ""}
          </span>
          <span className="text-court/40">·</span>
          <span>{skillRangeLabel(session.skillMin, session.skillMax)}</span>
        </div>
      }
    />
  );
}
