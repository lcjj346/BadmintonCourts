import type { PublicListing } from "@/services/listingService";
import { formatPrice } from "@/lib/time";
import { EntryCard } from "@/components/EntryCard";

export function ListingCard({ listing }: { listing: PublicListing }) {
  return (
    <EntryCard
      href={`/listing/${listing.id}`}
      claimed={listing.status !== "AVAILABLE"}
      status={listing.status}
      title={listing.venue.name}
      startTime={listing.startTime}
      endTime={listing.endTime}
      region={listing.venue.region}
      availabilityNote={listing.venue.availabilityNote}
      priceNode={formatPrice(listing.priceCents)}
    />
  );
}
