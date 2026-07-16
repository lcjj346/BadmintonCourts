/**
 * A court/game is either at a curated venue (venue relation set) or a venue not in
 * our list (customVenueName + customRegion instead) — this resolves either shape to
 * one display-ready object so callers never branch on which one it was.
 */
export function resolveVenueDisplay(post: {
  venue: { name: string; region: string; address: string; availabilityNote?: string | null } | null;
  customVenueName: string | null;
  customRegion: string | null;
}): { name: string; region: string; availabilityNote: string | null; isCustom: boolean; mapsUrl: string } {
  if (post.venue) {
    return {
      name: post.venue.name,
      region: post.venue.region,
      availabilityNote: post.venue.availabilityNote ?? null,
      isCustom: false,
      mapsUrl: mapsSearchUrl(`${post.venue.name}, ${post.venue.address}`),
    };
  }
  // Both are always set together for a custom venue (enforced by the create schema),
  // so these fallbacks only matter for a malformed row.
  const name = post.customVenueName ?? "Unlisted venue";
  return {
    name,
    region: post.customRegion ?? "CENTRAL",
    availabilityNote: null,
    isCustom: true,
    // No stored address for a custom venue — a name-only search is still useful, just
    // less precise than a curated venue's full address.
    mapsUrl: mapsSearchUrl(name),
  };
}

function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
