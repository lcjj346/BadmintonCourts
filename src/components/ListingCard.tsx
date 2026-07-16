import Link from "next/link";
import type { PublicListing } from "@/services/listingService";
import { formatPrice } from "@/lib/time";
import { StatusBadge } from "@/components/StatusBadge";

export function ListingCard({ listing }: { listing: PublicListing }) {
  const claimed = listing.status !== "AVAILABLE";
  return (
    <Link
      href={`/listing/${listing.id}`}
      className={`group relative flex items-stretch gap-3 overflow-hidden rounded-xl border border-court/10 bg-white pr-4 shadow-sm transition-shadow active:shadow-none ${
        claimed ? "opacity-60" : "hover:shadow-md"
      }`}
    >
      <span
        aria-hidden
        className={`w-1.5 shrink-0 ${claimed ? "bg-gray-300" : "bg-court"}`}
      />
      <div className="flex flex-1 items-start justify-between gap-3 py-3.5">
        <div className="min-w-0">
          <div className="truncate font-semibold leading-snug text-gray-900">
            {listing.venue.name}
          </div>
          <div className="mt-0.5 text-[13px] text-gray-500">
            <span className="font-medium tabular-nums text-gray-700">
              {listing.startTime}–{listing.endTime}
            </span>
            <span className="px-1.5 text-gray-300">·</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-court/70">
              {listing.venue.region}
            </span>
          </div>
          {listing.venue.availabilityNote && (
            <div className="mt-1.5 flex items-start gap-1 text-xs text-amber-700">
              <span aria-hidden className="mt-[3px] size-1 shrink-0 rounded-full bg-amber-500" />
              <span>{listing.venue.availabilityNote}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="whitespace-nowrap rounded-lg bg-court-light px-2.5 py-1 text-[15px] font-bold text-court">
            {formatPrice(listing.priceCents)}
          </span>
          {claimed && <StatusBadge status={listing.status} />}
        </div>
      </div>
    </Link>
  );
}
