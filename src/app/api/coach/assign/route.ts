import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, coachHasClient } from "@/server/auth";


import { prisma } from "@/server/db";
const schema = z.object({
  clientId: z.string().min(1),
  planId: z.string().min(1),
});
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (u.isDemo || u.role !== "COACH")
    return NextResponse.json(
      { error: "Coach access required" },
      { status: 403 },
    );
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success)
    return NextResponse.json({ error: "Invalid assignment" }, { status: 400 });
  if (!(await coachHasClient(u.id, p.data.clientId)))
    return NextResponse.json(
      { error: "Client not authorized" },
      { status: 404 },
    );
  const source = await prisma.plan.findFirst({
    where: { id: p.data.planId, userId: u.id },
    include: { days: { include: { exercises: true } } },
  });
  if (!source)
    return NextResponse.json({ error: "Own plan not found" }, { status: 404 });
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const target = await tx.plan.create({
        data: {
          userId: p.data.clientId,
          name: `${source.name} (coach assigned)`,
          goal: source.goal,
          status: "DRAFT",
          days: {
            create: source.days.map((d) => ({
              name: d.name,
              dayNumber: d.dayNumber,
              exercises: {
                create: d.exercises.map((e) => ({
                  exerciseId: e.exerciseId,
                  sortOrder: e.sortOrder,
                  targetSets: e.targetSets,
                  targetRepsMin: e.targetRepsMin,
                  targetRepsMax: e.targetRepsMax,
                  targetWeightKg: e.targetWeightKg,
                  targetDurationSeconds: e.targetDurationSeconds,
                  targetDistanceMeters: e.targetDistanceMeters,
                  restSeconds: e.restSeconds,
                })),
              },
            })),
          },
        },
      });
      await tx.coachPlanAssignment.create({
        data: {
          planId: target.id,
          clientId: p.data.clientId,
          coachId: u.id,
          sourcePlanId: source.id,
        },
      });
      return target;
    });
    return NextResponse.json({ planId: saved.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Assignment failed" }, { status: 500 });
  }
}
