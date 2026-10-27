import { z } from "zod";

// Snapshot is made of JSON primitives so no mutable PlanExercise rows are shared.
const exerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sortOrder: z.number().int().min(0),
  targetSets: z.number().int().min(1).max(30),
  targetRepsMin: z.number().int().positive().nullable(),
  targetRepsMax: z.number().int().positive().nullable(),
  targetWeightKg: z.number().min(0).nullable(),
  targetDurationSeconds: z.number().int().positive().nullable(),
  targetDistanceMeters: z.number().positive().nullable(),
  restSeconds: z.number().int().min(0).max(1800),
});

export const programSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().nullable(),
  goal: z.enum(["BUILD_MUSCLE", "LOSE_FAT", "BUILD_STRENGTH", "GENERAL_FITNESS"]),
  days: z.array(z.object({
    dayNumber: z.number().int().min(1).max(7),
    name: z.string().trim().min(1),
    exercises: z.array(exerciseSchema).min(1).max(30),
  })).min(1).max(7),
}).superRefine((v, ctx) => {
  if (new Set(v.days.map(d => d.dayNumber)).size !== v.days.length) {
    ctx.addIssue({code: "custom", message: "Training day numbers must be unique."});
  }
  for (const day of v.days) {
    if (new Set(day.exercises.map(e => e.exerciseId)).size !== day.exercises.length) {
      ctx.addIssue({code: "custom", message: "An exercise cannot appear twice on one day."});
    }
  }
});
export type ProgramSnapshot = z.infer<typeof programSnapshotSchema>;

export const publishSchema = z.object({
  planId: z.string().min(1),
  templateId: z.string().min(1).optional(),
});

const todayDate = () => new Date().toISOString().slice(0, 10);
export const assignmentSchema = z.object({
  clientId: z.string().min(1),
  versionId: z.string().min(1),
  startDate: z.iso.date().refine(v => v >= todayDate(), "Start date cannot be in the past."),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  idempotencyKey: z.uuid(),
}).superRefine((value, ctx) => {
  if (new Set(value.weekdays).size !== value.weekdays.length) {
    ctx.addIssue({code: "custom", message: "Weekdays must be unique."});
  }
});

export type ScheduleEntry = { dayIndex: number; scheduledFor: Date };
// Date-only values use UTC calendar days, avoiding host-local timezone drift.
export function buildSchedule(startISO: string, weekdays: number[], dayCount: number): ScheduleEntry[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) throw new Error("Invalid start date.");
  const start = new Date(`${startISO}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || start.toISOString().slice(0, 10) !== startISO) {
    throw new Error("Invalid calendar date.");
  }
  if (weekdays.length !== dayCount || new Set(weekdays).size !== dayCount || weekdays.some(x => !Number.isInteger(x) || x < 1 || x > 7)) {
    throw new Error("Select one different weekday for each program day.");
  }
  const ordered = [...weekdays].sort((a, b) => a - b);
  const slots: ScheduleEntry[] = [];
  // Four calendar weeks, beginning at the chosen start date.
  for (let n = 0; n < 28; n++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + n);
    const weekday = date.getUTCDay() || 7;
    const dayIndex = ordered.indexOf(weekday);
    if (dayIndex !== -1) slots.push({dayIndex, scheduledFor: date});
  }
  return slots;
}