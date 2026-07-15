import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/sessionService";
import { formatPrice, formatDateLabel, dateToStr } from "@/lib/time";
import { SKILL_LABELS } from "@/lib/skill";
import { StatusBadge } from "@/components/StatusBadge";
import { RevealButton } from "@/components/RevealButton";
import { ReportButton } from "@/components/ReportButton";

export const dynamic = "force-dynamic";

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      <Link href="/?tab=players" className="text-sm text-gray-400">← Back to players</Link>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-bold">{session.venue.name}</h1>
          <StatusBadge status={session.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(dateToStr(session.date))} · {session.startTime}–{session.endTime}
        </p>
        <p className="text-sm text-gray-500">{session.venue.region} · {session.venue.name}</p>
        {session.venue.availabilityNote && (
          <p className="mt-1 text-xs text-amber-700">{session.venue.availabilityNote}</p>
        )}
        <p className="mt-2 text-sm font-medium text-court">
          Needs {session.playersNeeded} player{session.playersNeeded > 1 ? "s" : ""} · {SKILL_LABELS[session.skillLevel]}
        </p>
        <p className="mt-3 text-2xl font-bold text-court">
          {formatPrice(session.pricePerPlayerCents)}<span className="text-sm font-normal text-gray-400">/pax</span>
        </p>
        {session.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{session.notes}</p>}
        <div className="mt-4">
          {session.status === "OPEN"
            ? <RevealButton endpoint={`/api/sessions/${session.id}/reveal`} />
            : <p className="text-center text-sm text-gray-400">This game is filled.</p>}
        </div>
      </div>
      <div className="mt-4">
        <ReportButton endpoint={`/api/sessions/${session.id}/report`} />
      </div>
    </main>
  );
}
