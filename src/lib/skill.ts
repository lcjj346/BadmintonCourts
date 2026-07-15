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
