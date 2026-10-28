import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

const schema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("plan-day"),
    planDayId: z.string(),
    scheduledWorkoutId: z.string().optional(),
  }),
  z.object({ mode: z.literal("repeat"), sourceSessionId: z.string() }),
]);

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isDemo)
    return NextResponse.json({ error: "Read-only demo" }, { status: 403 });
  const input = schema.safeParse(await req.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const running = await tx.workoutSession.findFirst({
        where: { userId: user.id, status: "IN_PROGRESS" },
        select: { id: true },
      });
      if (running) return { kind: "running" as const, id: running.id };
      let planDayId: string;
      let repeatFrom: string | undefined;
      let scheduledWorkoutId: string | undefined;
      if (input.data.mode === "plan-day") {
        const day = await tx.planDay.findFirst({
          where: {
            id: input.data.planDayId,
            plan: { userId: user.id, status: "ACTIVE" },
          },
          select: { id: true },
        });
        if (!day) return { kind: "missing" as const };
        planDayId = day.id;
        scheduledWorkoutId = input.data.scheduledWorkoutId;
      } else {
        const previous = await tx.workoutSession.findFirst({
          where: {
            id: input.data.sourceSessionId,
            userId: user.id,
            status: "COMPLETED",
          },
          include: { planDay: { include: { plan: true } } },
        });
        if (
          !previous?.planDay ||
          previous.planDay.plan.userId !== user.id ||
          previous.planDay.plan.status !== "ACTIVE"
        )
          return { kind: "missing" as const };
        planDayId = previous.planDay.id;
        repeatFrom = previous.id;
      }
      const utcToday = new Date(
        new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
      );
      const scheduled = scheduledWorkoutId
        ? await tx.scheduledWorkout.findFirst({
            where: {
              id: scheduledWorkoutId,
              planDayId,
              status: "PLANNED",
              sessionId: null,
              assignment: { clientId: user.id, status: "ACTIVE" },
            },
            select: { id: true },
          })
        : await tx.scheduledWorkout.findFirst({
            where: {
              planDayId,
              status: "PLANNED",
              sessionId: null,
              scheduledFor: { lte: utcToday },
              assignment: { clientId: user.id, status: "ACTIVE" },
            },
            orderBy: { scheduledFor: "asc" },
            select: { id: true },
          });
      if (scheduledWorkoutId && !scheduled)
        return { kind: "schedule" as const };
      const session = await tx.workoutSession.create({
        data: { userId: user.id, planDayId },
        select: { id: true },
      });
      if (scheduled) {
        const updated = await tx.scheduledWorkout.updateMany({
          where: { id: scheduled.id, status: "PLANNED", sessionId: null },
          data: { sessionId: session.id },
        });
        if (updated.count !== 1)
          throw new Error("Schedule changed during workout start.");
      }
      return { kind: "created" as const, id: session.id, repeatFrom };
    });
    if (result.kind === "running")
      return NextResponse.json(
        { error: "Session already running", sessionId: result.id },
        { status: 409 },
      );
    if (result.kind === "missing")
      return NextResponse.json(
        { error: "Active plan day not found" },
        { status: 404 },
      );
    if (result.kind === "schedule")
      return NextResponse.json(
        { error: "Scheduled session is not available" },
        { status: 409 },
      );
    return NextResponse.json(
      { id: result.id, repeatFrom: result.repeatFrom },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Cannot start session" },
      { status: 500 },
    );
  }
}
