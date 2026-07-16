import { z } from "zod";
import { todaySgt, maxPostDateSgt, nowSgtTime } from "@/lib/time";

const SKILL_LEVELS = [
  "LOW_BEGINNER",
  "MID_BEGINNER",
  "HIGH_BEGINNER",
  "LOW_INTERMEDIATE",
  "MID_INTERMEDIATE",
  "HIGH_INTERMEDIATE",
  "ADVANCED",
] as const;

export const REGIONS = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"] as const;

const phoneSchema = z
  .string()
  .regex(
    /^\+65[89]\d{7}$|^\+601\d{7,9}$|^\+(?:1|44|61|62|63|66|84|86|91|852|886)\d{6,12}$/,
    "Enter a valid mobile number with country code",
  );

const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const dateInRange = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => d >= todaySgt() && d <= maxPostDateSgt(), {
    message: "Date must be between today and 8 weeks from now",
  });

const honeypot = z
  .string()
  .max(0, "spam")
  .optional()
  .or(z.literal(""));

const timeOrder = (v: { startTime: string; endTime: string }) => v.endTime > v.startTime;
const TIME_ORDER_MSG = { message: "End time must be after start time", path: ["endTime"] };

// Can't post/edit a slot to start in the past today. Future dates are unaffected.
const futureStartToday = (v: { date: string; startTime: string }) =>
  v.date !== todaySgt() || v.startTime > nowSgtTime();
const FUTURE_START_MSG = {
  message: "That start time has already passed — pick a later time or another day",
  path: ["startTime"],
};

const skillIndex = (s: (typeof SKILL_LEVELS)[number]) => SKILL_LEVELS.indexOf(s);
const skillOrder = (v: { skillMin: (typeof SKILL_LEVELS)[number]; skillMax: (typeof SKILL_LEVELS)[number] }) =>
  skillIndex(v.skillMax) >= skillIndex(v.skillMin);
const SKILL_ORDER_MSG = { message: "Max skill must be the same as or higher than min skill", path: ["skillMax"] };

// A court/game is at either a curated venue (venueId) or a venue not in our list
// (customVenueName + customRegion) — never both, never neither.
const venueRef = z.object({
  venueId: z.string().uuid().optional(),
  customVenueName: z.string().min(3).max(120).optional(),
  customRegion: z.enum(REGIONS).optional(),
});
const validVenueRef = (v: z.infer<typeof venueRef>) =>
  Boolean(v.venueId) !== Boolean(v.customVenueName && v.customRegion);
const VENUE_REF_MSG = {
  message: "Pick a listed venue, or enter a venue name and region",
  path: ["venueId"],
};

/** Max court/game entries in a single post submission (one shared manage link). */
export const MAX_BATCH_ITEMS = 10;

// --- Per-item fields shared by both post kinds and by edits (no venue/phone — those aren't editable). ---
const itemBase = z.object({
  date: dateInRange,
  startTime: timeStr,
  endTime: timeStr,
  notes: z.string().max(300).optional(),
});

// --- Create: one item = one court/game within a batch submission. ---
const createListingItemBase = itemBase.merge(venueRef).extend({
  priceCents: z.number().int().min(0).max(50_000).nullable(),
});
const createListingItemSchema = createListingItemBase
  .refine(timeOrder, TIME_ORDER_MSG)
  .refine(futureStartToday, FUTURE_START_MSG)
  .refine(validVenueRef, VENUE_REF_MSG);

const createSessionItemBase = itemBase.merge(venueRef).extend({
  playersNeeded: z.number().int().min(1).max(50),
  skillMin: z.enum(SKILL_LEVELS),
  skillMax: z.enum(SKILL_LEVELS),
  pricePerPlayerCents: z.number().int().min(0).max(50_000).nullable(),
});
const createSessionItemSchema = createSessionItemBase
  .refine(timeOrder, TIME_ORDER_MSG)
  .refine(futureStartToday, FUTURE_START_MSG)
  .refine(skillOrder, SKILL_ORDER_MSG)
  .refine(validVenueRef, VENUE_REF_MSG);

const batchEnvelope = z.object({
  phone: phoneSchema,
  website: honeypot, // honeypot: real users never see or fill this
});

export const createListingSchema = batchEnvelope.extend({
  items: z.array(createListingItemSchema).min(1).max(MAX_BATCH_ITEMS),
});
export const createSessionSchema = batchEnvelope.extend({
  items: z.array(createSessionItemSchema).min(1).max(MAX_BATCH_ITEMS),
});

// --- Add-to-batch: appending more courts/games to an existing manage link. No phone —
// the existing batch's phone is reused. ---
export const addListingBatchItemsSchema = z.object({
  items: z.array(createListingItemSchema).min(1).max(MAX_BATCH_ITEMS),
});
export const addSessionBatchItemsSchema = z.object({
  items: z.array(createSessionItemSchema).min(1).max(MAX_BATCH_ITEMS),
});

// --- Edit: one existing court/game, from its manage page. Venue is fixed (delete + repost to change it). ---
export const editListingSchema = itemBase
  .extend({ priceCents: z.number().int().min(0).max(50_000).nullable() })
  .refine(timeOrder, TIME_ORDER_MSG)
  .refine(futureStartToday, FUTURE_START_MSG);

export const editSessionSchema = itemBase
  .extend({
    playersNeeded: z.number().int().min(1).max(50),
    skillMin: z.enum(SKILL_LEVELS),
    skillMax: z.enum(SKILL_LEVELS),
    pricePerPlayerCents: z.number().int().min(0).max(50_000).nullable(),
  })
  .refine(timeOrder, TIME_ORDER_MSG)
  .refine(futureStartToday, FUTURE_START_MSG)
  .refine(skillOrder, SKILL_ORDER_MSG);

// Each field falls back to undefined (no filter) on an invalid value, so a stale or
// hand-edited URL degrades gracefully instead of blanking the whole board.
export const boardFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  region: z.enum(REGIONS).optional().catch(undefined),
  venueId: z.string().uuid().optional().catch(undefined),
  timeFrom: timeStr.optional().catch(undefined),
  timeTo: timeStr.optional().catch(undefined),
  skill: z.enum(SKILL_LEVELS).optional().catch(undefined),
  available: z.enum(["1"]).optional().catch(undefined),
});

export const venueSuggestionSchema = z.object({
  name: z.string().min(3).max(120),
  details: z.string().max(300).optional(),
});

export type CreateListingItemInput = z.infer<typeof createListingItemSchema>;
export type CreateSessionItemInput = z.infer<typeof createSessionItemSchema>;
export type EditListingInput = z.infer<typeof editListingSchema>;
export type EditSessionInput = z.infer<typeof editSessionSchema>;
export type BoardFilters = z.infer<typeof boardFilterSchema>;
