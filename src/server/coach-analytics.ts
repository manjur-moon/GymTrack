import "server-only";

import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
import type { CoachOverviewData } from "@/types/coach-analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getCoachOverviewData(): Promise<CoachOverviewData> {
  const coach = await requireCoach();
  const now = new Date();

  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrow = addUTCDays(today, 1);
  const chartStart = addUTCDays(today, -6);
  const rollingSevenDaysStart = new Date(now.getTime() - 7 * DAY_MS);

  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const weekStart = addUTCDays(today, -daysSinceMonday);
  const weekStartKey = utcDateKey(weekStart);
  const days = Array.from({ length: 7 }, (_, index) =>
    utcDateKey(addUTCDays(chartStart, index)),
  );

  const relationships = await prisma.coachClient.findMany({
    where: {
      coachId: coach.id,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: {
      clientId: true,
      status: true,
      client: { select: { name: true, email: true } },
    },
  });

  const activeRelationships = relationships.filter(
    (relationship) => relationship.status === "ACTIVE",
  );
  const activeClientIds = activeRelationships.map(
    (relationship) => relationship.clientId,
  );
  const pendingInvitations = relationships.filter(
    (relationship) => relationship.status === "PENDING",
  ).length;

  const emptyWeeklyActivity = days.map((date) => ({
    date,
    completedSessions: 0,
    scheduledSessions: 0,
  }));

  if (activeClientIds.length === 0) {
    return {
      metrics: {
        activeClients: 0,
        pendingInvitations,
        activeAssignments: 0,
        completedAssignedSessionsLast7Days: 0,
        scheduledDueThisWeek: 0,
        scheduledCompletedThisWeek: 0,
        adherencePercent: null,
        overdueScheduledSessions: 0,
      },
      attentionClients: [],
      weeklyActivity: emptyWeeklyActivity,
    };
  }

  const assignmentScope = {
    coachId: coach.id,
    clientId: { in: activeClientIds },
    status: "ACTIVE" as const,
  };

  const [
    assignments,
    scheduledGroups,
    overdueGroups,
    recentSessions,
    completedLastSevenDays,
  ] = await Promise.all([
    prisma.programAssignment.findMany({
      where: assignmentScope,
      select: { id: true, clientId: true },
    }),
    prisma.scheduledWorkout.groupBy({
      by: ["scheduledFor", "status"],
      where: {
        assignment: { is: assignmentScope },
        scheduledFor: { gte: chartStart, lt: tomorrow },
        status: { in: ["PLANNED", "COMPLETED"] },
      },
      _count: { _all: true },
    }),
    prisma.scheduledWorkout.groupBy({
      by: ["assignmentId"],
      where: {
        assignment: { is: assignmentScope },
        status: "PLANNED",
        scheduledFor: { lt: today },
        OR: [
          { sessionId: null },
          { session: { is: { status: { not: "IN_PROGRESS" } } } },
        ],
      },
      _count: { _all: true },
    }),
    prisma.workoutSession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: activeClientIds },
        status: "COMPLETED",
      },
      _max: { completedAt: true },
    }),
    prisma.workoutSession.count({
      where: {
        userId: { in: activeClientIds },
        status: "COMPLETED",
        completedAt: { gte: rollingSevenDaysStart, lte: now },
        scheduledWorkout: {
          is: {
            status: "COMPLETED",
            assignment: { is: assignmentScope },
          },
        },
      },
    }),
  ]);

  const weeklyMap = new Map(
    days.map((date) => [
      date,
      { date, completedSessions: 0, scheduledSessions: 0 },
    ]),
  );

  let scheduledDueThisWeek = 0;
  let scheduledCompletedThisWeek = 0;

  for (const group of scheduledGroups) {
    const date = utcDateKey(group.scheduledFor);
    const count = group._count._all;
    const day = weeklyMap.get(date);

    if (day) {
      day.scheduledSessions += count;
      if (group.status === "COMPLETED") {
        day.completedSessions += count;
      }
    }

    if (date >= weekStartKey) {
      scheduledDueThisWeek += count;
      if (group.status === "COMPLETED") {
        scheduledCompletedThisWeek += count;
      }
    }
  }

  const adherencePercent =
    scheduledDueThisWeek === 0
      ? null
      : Math.round(
          (scheduledCompletedThisWeek / scheduledDueThisWeek) * 100,
        );

  const clientIdByAssignment = new Map(
    assignments.map((assignment) => [assignment.id, assignment.clientId]),
  );
  const overdueByClient = new Map<string, number>();
  let overdueScheduledSessions = 0;

  for (const group of overdueGroups) {
    const clientId = clientIdByAssignment.get(group.assignmentId);
    if (!clientId) continue;

    const count = group._count._all;
    overdueScheduledSessions += count;
    overdueByClient.set(
      clientId,
      (overdueByClient.get(clientId) ?? 0) + count,
    );
  }

  const clientById = new Map(
    activeRelationships.map((relationship) => [
      relationship.clientId,
      relationship.client,
    ]),
  );
  const lastCompletedByClient = new Map(
    recentSessions.map((session) => [
      session.userId,
      session._max.completedAt?.toISOString() ?? null,
    ]),
  );

  const attentionClients = Array.from(overdueByClient.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([clientId, overdueCount]) => {
      const client = clientById.get(clientId);
      return {
        clientId,
        clientName: client?.name?.trim() || client?.email || "Client",
        overdueScheduledSessions: overdueCount,
        lastCompletedWorkoutAt:
          lastCompletedByClient.get(clientId) ?? null,
      };
    });

  return {
    metrics: {
      activeClients: activeClientIds.length,
      pendingInvitations,
      activeAssignments: assignments.length,
      completedAssignedSessionsLast7Days: completedLastSevenDays,
      scheduledDueThisWeek,
      scheduledCompletedThisWeek,
      adherencePercent,
      overdueScheduledSessions,
    },
    attentionClients,
    weeklyActivity: days.map((date) => weeklyMap.get(date)!),
  };
}
