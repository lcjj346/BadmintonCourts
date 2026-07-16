import type { PublicSession } from "@/services/sessionService";
import { formatPrice } from "@/lib/time";
import { EntryCard } from "@/components/EntryCard";
import { skillRangeLabel } from "@/lib/skill";

export function SessionCard({ session }: { session: PublicSession }) {
  return (
    <EntryCard
      href={`/session/${session.id}`}
      claimed={session.status !== "OPEN"}
      status={session.status}
      title={session.venue.name}
      startTime={session.startTime}
      endTime={session.endTime}
      region={session.venue.region}
      availabilityNote={session.venue.availabilityNote}
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
          <span className="tabular-nums">Needs {session.playersNeeded}</span>
          <span className="text-court/40">·</span>
          <span>{skillRangeLabel(session.skillMin, session.skillMax)}</span>
        </div>
      }
    />
  );
}
