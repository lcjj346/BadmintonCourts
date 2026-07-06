import { z } from "zod";
import { todaySgt, maxPostDateSgt } from "@/lib/time";

export const phoneSchema = z
  .string()
  .regex(/^[89]\d{7}$/, "Enter an 8-digit SG mobile number starting with 8 or 9");

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

const postBase = z.object({
  venueId: z.string().uuid(),
  date: dateInRange,
  startTime: timeStr,
  endTime: timeStr,
  notes: z.string().max(300).optional(),
  phone: phoneSchema,
  website: honeypot, // honeypot: real users never see or fill this
});

const timeOrder = (v: { startTime: string; endTime: string }) => v.endTime > v.startTime;
const TIME_ORDER_MSG = { message: "End time must be after start time", path: ["endTime"] };

export const createListingSchema = postBase
  .extend({ priceCents: z.number().int().min(0).max(50_000).nullable() })
  .refine(timeOrder, TIME_ORDER_MSG);

export const createSessionSchema = postBase
  .extend({
    playersNeeded: z.number().int().min(1).max(20),
    skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
    pricePerPlayerCents: z.number().int().min(0).max(50_000).nullable(),
  })
  .refine(timeOrder, TIME_ORDER_MSG);

// Each field falls back to undefined (no filter) on an invalid value, so a stale or
// hand-edited URL degrades gracefully instead of blanking the whole board.
export const boardFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  region: z.enum(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]).optional().catch(undefined),
  venueId: z.string().uuid().optional().catch(undefined),
  time: z.enum(["MORNING", "AFTERNOON", "EVENING"]).optional().catch(undefined),
  skill: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional().catch(undefined),
});

export const venueSuggestionSchema = z.object({
  name: z.string().min(3).max(120),
  details: z.string().max(300).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type BoardFilters = z.infer<typeof boardFilterSchema>;
