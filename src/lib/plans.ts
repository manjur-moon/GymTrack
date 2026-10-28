import type {
  Equipment,
  ExperienceLevel,
  MovementPattern,
  TrackingType,
} from "@/generated/prisma/enums";
import { z } from "zod";
export type CatalogExercise = {
  id: string;
  name: string;
  pattern: MovementPattern;
  equipment: Equipment[];
  difficulty: ExperienceLevel;
  trackingType: TrackingType;
};
export const daySchema = z.object({
  name: z.string().trim().min(2).max(80),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        targetSets: z.number().int().min(1).max(12),
        targetRepsMin: z.number().int().min(1).max(100).nullable(),
        targetRepsMax: z.number().int().min(1).max(100).nullable(),
        targetWeightKg: z.number().nonnegative().max(1000).nullable(),
        targetDurationSeconds: z.number().int().min(1).max(7200).nullable(),
        targetDistanceMeters: z.number().nonnegative().max(50000).nullable(),
        restSeconds: z.number().int().min(0).max(600),
      }),
    )
    .min(1)
    .max(12),
});
export const planSchema = z.object({
  name: z.string().trim().min(3).max(120),
  goal: z.enum([
    "BUILD_MUSCLE",
    "LOSE_FAT",
    "BUILD_STRENGTH",
    "GENERAL_FITNESS",
  ]),
  days: z.array(daySchema).min(1).max(7),
});
export type PlanDraft = z.infer<typeof planSchema>;
export const onboardingSchema = z.object({
  goal: z.enum([
    "BUILD_MUSCLE",
    "LOSE_FAT",
    "BUILD_STRENGTH",
    "GENERAL_FITNESS",
  ]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  daysPerWeek: z.number().int().min(1).max(7),
  equipment: z.array(
    z.enum([
      "DUMBBELL",
      "BARBELL",
      "BENCH",
      "RACK",
      "MACHINE",
      "CABLE",
      "PULL_UP_BAR",
      "KETTLEBELL",
      "RESISTANCE_BAND",
    ]),
  ),
  limitations: z.array(z.string().max(160)).max(5),
});
export type Onboarding = z.infer<typeof onboardingSchema>;
export function suggestPlan(
  profile: Onboarding,
  catalog: readonly CatalogExercise[],
):
  | { kind: "ready"; plan: PlanDraft; warnings: string[] }
  | { kind: "unavailable"; reason: string } {
  if (profile.limitations.length)
    return {
      kind: "unavailable",
      reason:
        "Automated suggestions are unavailable when limitations are reported. Review your plan with a qualified professional.",
    };
  const ranks = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 };
  const eligible = catalog
    .filter(
      (e) =>
        ranks[e.difficulty] <= ranks[profile.level] &&
        e.equipment.every((x) => profile.equipment.includes(x)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  if (eligible.length < 3)
    return {
      kind: "unavailable",
      reason: "Not enough compatible exercises for this equipment.",
    };
  const days = Math.min(
    profile.daysPerWeek,
    profile.level === "BEGINNER" ? 3 : 4,
  );
  const warnings =
    days < profile.daysPerWeek
      ? [`Scheduled ${days} training days to keep the plan manageable.`]
      : [];
  const patterns: MovementPattern[][] = [
    ["HORIZONTAL_PUSH", "HORIZONTAL_PULL", "SQUAT", "HINGE", "CORE"],
    ["SQUAT", "VERTICAL_PUSH", "HORIZONTAL_PULL", "LUNGE", "CORE"],
    ["HINGE", "HORIZONTAL_PUSH", "VERTICAL_PULL", "SQUAT", "CORE"],
    ["VERTICAL_PUSH", "HORIZONTAL_PULL", "LUNGE", "CORE", "HORIZONTAL_PUSH"],
  ];
  const targets =
    profile.goal === "BUILD_STRENGTH"
      ? [5, 8]
      : profile.goal === "BUILD_MUSCLE"
        ? [8, 12]
        : [10, 15];
  return {
    kind: "ready",
    warnings,
    plan: {
      name: `${profile.level.toLowerCase()} ${profile.goal.toLowerCase().replaceAll("_", " ")} plan`,
      goal: profile.goal,
      days: Array.from({ length: days }, (_, i) => {
        const chosen: CatalogExercise[] = [];
        for (const pattern of patterns[i % 4]) {
          const pick = eligible.find(
            (e) => e.pattern === pattern && !chosen.some((c) => c.id === e.id),
          );
          if (pick) chosen.push(pick);
        }
        for (const e of eligible)
          if (chosen.length < 5 && !chosen.some((c) => c.id === e.id))
            chosen.push(e);
        return {
          name: `Workout ${String.fromCharCode(65 + i)}`,
          exercises: chosen.map((e) => ({
            exerciseId: e.id,
            targetSets: profile.level === "BEGINNER" ? 2 : 3,
            targetRepsMin: e.trackingType.includes("REPS") ? targets[0] : null,
            targetRepsMax: e.trackingType.includes("REPS") ? targets[1] : null,
            targetWeightKg: null,
            targetDurationSeconds: e.trackingType === "DURATION" ? 30 : null,
            targetDistanceMeters:
              e.trackingType === "DISTANCE_WEIGHT" ? 20 : null,
            restSeconds: profile.goal === "BUILD_STRENGTH" ? 120 : 90,
          })),
        };
      }),
    },
  };
}
