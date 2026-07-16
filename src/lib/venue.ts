/**
 * A court/game is either at a curated venue (venue relation set) or a venue not in
 * our list (customVenueName + customRegion instead) — this resolves either shape to
 * one display-ready object so callers never branch on which one it was.
 */
export function resolveVenueDisplay(post: {
  venue: { name: string; region: string; availabilityNote?: string | null } | null;
  customVenueName: string | null;
  customRegion: string | null;
}): { name: string; region: string; availabilityNote: string | null; isCustom: boolean } {
  if (post.venue) {
    return {
      name: post.venue.name,
      region: post.venue.region,
      availabilityNote: post.venue.availabilityNote ?? null,
      isCustom: false,
    };
  }
  return {
    // Both are always set together for a custom venue (enforced by the create schema),
    // so these fallbacks only matter for a malformed row.
    name: post.customVenueName ?? "Unlisted venue",
    region: post.customRegion ?? "CENTRAL",
    availabilityNote: null,
    isCustom: true,
  };
}
