import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isDemo)
    return NextResponse.json({ error: "Read-only demo" }, { status: 403 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
      const running = await tx.workoutSession.count({
        where: { userId: user.id, status: "IN_PROGRESS" },
      });
      if (running) return "RUNNING";
      const plan = await tx.plan.findFirst({
        where: { id, userId: user.id },
        include: { days: { include: { exercises: { select: { id: true } } } } },
      });
      if (!plan) return "MISSING";
      if (!plan.days.length || plan.days.some((d) => !d.exercises.length))
        return "EMPTY";
      const previous = await tx.programAssignment.findMany({
        where: { clientId: user.id, status: "ACTIVE", planId: { not: id } },
        select: { id: true },
      });
      if (previous.length) {
        const ids = previous.map((x) => x.id);
        await tx.programAssignment.updateMany({
          where: { id: { in: ids } },
          data: { status: "REPLACED" },
        });
        await tx.scheduledWorkout.updateMany({
          where: { assignmentId: { in: ids }, status: "PLANNED" },
          data: { status: "CANCELLED" },
        });
      }
      await tx.plan.updateMany({
        where: { userId: user.id, status: "ACTIVE" },
        data: { status: "ARCHIVED" },
      });
      await tx.plan.update({ where: { id }, data: { status: "ACTIVE" } });
      return "OK";
    });
    return result === "OK"
      ? NextResponse.json({ status: "ACTIVE" })
      : NextResponse.json(
          { error: result },
          { status: result === "MISSING" ? 404 : 409 },
        );
  } catch {
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }
}
