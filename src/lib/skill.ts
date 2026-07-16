export const SKILL_LABELS = {
  LOW_BEGINNER: "Low Beginner",
  MID_BEGINNER: "Mid Beginner",
  HIGH_BEGINNER: "High Beginner",
  LOW_INTERMEDIATE: "Low Intermediate",
  MID_INTERMEDIATE: "Mid Intermediate",
  HIGH_INTERMEDIATE: "High Intermediate",
  ADVANCED: "Advanced",
} as const;

export type SkillLevel = keyof typeof SKILL_LABELS;

export const SKILL_OPTIONS = Object.entries(SKILL_LABELS) as [SkillLevel, string][];

/** Declaration order, low → high — the only source of truth for skill ordering. */
export const SKILL_ORDER = SKILL_OPTIONS.map(([value]) => value);

/** "Mid Beginner" for a single level, "Mid Beginner – High Beginner" for a range. */
export function skillRangeLabel(min: SkillLevel, max: SkillLevel): string {
  return min === max ? SKILL_LABELS[min] : `${SKILL_LABELS[min]} – ${SKILL_LABELS[max]}`;
}

/** 1..50 — the shared "players needed" range for the post form and the manage-page editor. */
export const PLAYER_COUNT_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1);
