import type { PublicListing } from "@/services/listingService";
import { formatPrice } from "@/lib/time";
import { resolveVenueDisplay } from "@/lib/venue";
import { EntryCard } from "@/components/EntryCard";

export function ListingCard({ listing }: { listing: PublicListing }) {
  const venue = resolveVenueDisplay(listing);
  return (
    <EntryCard
      href={`/listing/${listing.id}`}
      claimed={listing.status !== "AVAILABLE"}
      status={listing.status}
      title={venue.name}
      startTime={listing.startTime}
      endTime={listing.endTime}
      region={venue.region}
      availabilityNote={venue.availabilityNote}
      priceNode={formatPrice(listing.priceCents)}
    />
  );
}
