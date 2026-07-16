import { notFound } from "next/navigation";
import Link from "next/link";
import { getListing } from "@/services/listingService";
import { formatPrice, formatDateLabel, dateToStr } from "@/lib/time";
import { resolveVenueDisplay } from "@/lib/venue";
import { StatusBadge } from "@/components/StatusBadge";
import { RevealButton } from "@/components/RevealButton";
import { ReportButton } from "@/components/ReportButton";

export const dynamic = "force-dynamic";

export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const venue = resolveVenueDisplay(listing);

  return (
    <main className="mx-auto w-full max-w-lg pt-6">
      <Link href="/" className="text-sm text-gray-400">← Back to courts</Link>
      <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <h1 className="text-lg font-bold">{venue.name}</h1>
          <StatusBadge status={listing.status} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateLabel(dateToStr(listing.date))} · {listing.startTime}–{listing.endTime}
        </p>
        <p className="text-sm text-gray-500">{venue.region}</p>
        {venue.availabilityNote && (
          <p className="mt-1 text-xs text-amber-700">{venue.availabilityNote}</p>
        )}
        <p className="mt-3 text-2xl font-bold text-court">{formatPrice(listing.priceCents)}</p>
        {listing.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{listing.notes}</p>}
        <div className="mt-4">
          {listing.status === "AVAILABLE"
            ? <RevealButton endpoint={`/api/listings/${listing.id}/reveal`} />
            : <p className="text-center text-sm text-gray-400">This court has been taken.</p>}
        </div>
      </div>
      <div className="mt-4">
        <ReportButton endpoint={`/api/listings/${listing.id}/report`} />
      </div>
    </main>
  );
}
