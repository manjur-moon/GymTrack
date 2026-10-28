import "server-only";

import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";

export type CoachClientInsight = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  activeAssignments: number;
  dueThisWeek: number;
  completedThisWeek: number;
  adherencePercent: number | null;
  overdueSessions: number;
  lastCompletedAt: string | null;
};

export type CoachClientInsightsData = {
  clients: CoachClientInsight[];
  summary: {
    activeClients: number;
    clientsNeedingAttention: number;
    overdueSessions: number;
    dueThisWeek: number;
    completedThisWeek: number;
    adherencePercent: number | null;
  };
};

function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Read-only analytics, scoped to the signed-in coach's approved clients and
 * their currently ACTIVE R3 assignments. All reporting dates use UTC.
 */
export async function getCoachClientInsights(): Promise<CoachClientInsightsData> {
  const coach = await requireCoach();
  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrow = addUTCDays(today, 1);
  const weekStart = addUTCDays(today, -((today.getUTCDay() + 6) % 7));

  // Never read a client's records unless this coach has an ACTIVE relationship.
  const relationships = await prisma.coachClient.findMany({
    where: { coachId: coach.id, status: "ACTIVE" },
    select: {
      clientId: true,
      client: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const emptySummary: CoachClientInsightsData["summary"] = {
    activeClients: relationships.length,
    clientsNeedingAttention: 0,
    overdueSessions: 0,
    dueThisWeek: 0,
    completedThisWeek: 0,
    adherencePercent: null,
  };

  if (relationships.length === 0) {
    return { clients: [], summary: emptySummary };
  }

  const activeClientIds = relationships.map((r) => r.clientId);
  const assignmentScope = {
    coachId: coach.id,
    clientId: { in: activeClientIds },
    status: "ACTIVE" as const,
  };

  // Four bounded-query-pattern requests, independent of the number of clients.
  // Do not replace with a separate database query for every client (N+1).
  const [assignments, weeklyGroups, overdueGroups, lastSessions] =
    await Promise.all([
      prisma.programAssignment.findMany({
        where: assignmentScope,
        select: { id: true, clientId: true },
      }),
      prisma.scheduledWorkout.groupBy({
        by: ["assignmentId", "status"],
        where: {
          assignment: { is: assignmentScope },
          status: { in: ["PLANNED", "COMPLETED"] },
          scheduledFor: { gte: weekStart, lt: tomorrow },
        },
        _count: { _all: true },
      }),
      prisma.scheduledWorkout.groupBy({
        by: ["assignmentId"],
        where: {
          assignment: { is: assignmentScope },
          status: "PLANNED",
          scheduledFor: { lt: today },
          // An underway workout should not trigger an overdue alert.
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
    ]);

  const assignmentClient = new Map(
    assignments.map((assignment) => [assignment.id, assignment.clientId]),
  );

  const byClient = new Map<string, CoachClientInsight>(
    relationships.map((relationship) => [
      relationship.clientId,
      {
        clientId: relationship.clientId,
        clientName:
          relationship.client.name?.trim() || relationship.client.email,
        clientEmail: relationship.client.email,
        activeAssignments: 0,
        dueThisWeek: 0,
        completedThisWeek: 0,
        adherencePercent: null,
        overdueSessions: 0,
        lastCompletedAt: null,
      },
    ]),
  );

  for (const assignment of assignments) {
    const client = byClient.get(assignment.clientId);
    if (client) client.activeAssignments += 1;
  }

  for (const group of weeklyGroups) {
    const clientId = assignmentClient.get(group.assignmentId);
    const client = clientId ? byClient.get(clientId) : undefined;
    if (!client) continue;

    const count = group._count._all;
    client.dueThisWeek += count;
    if (group.status === "COMPLETED") client.completedThisWeek += count;
  }

  for (const group of overdueGroups) {
    const clientId = assignmentClient.get(group.assignmentId);
    const client = clientId ? byClient.get(clientId) : undefined;
    if (client) client.overdueSessions += group._count._all;
  }

  for (const session of lastSessions) {
    const client = byClient.get(session.userId);
    if (client) {
      client.lastCompletedAt =
        session._max.completedAt?.toISOString() ?? null;
    }
  }

  const clients = Array.from(byClient.values());
  for (const client of clients) {
    client.adherencePercent =
      client.dueThisWeek === 0
        ? null
        : Math.round((client.completedThisWeek / client.dueThisWeek) * 100);
  }

  // Clients with more overdue sessions appear first, then by name.
  clients.sort(
    (a, b) =>
      b.overdueSessions - a.overdueSessions ||
      a.clientName.localeCompare(b.clientName),
  );

  const dueThisWeek = clients.reduce((total, c) => total + c.dueThisWeek, 0);
  const completedThisWeek = clients.reduce(
    (total, c) => total + c.completedThisWeek,
    0,
  );

  return {
    clients,
    summary: {
      activeClients: clients.length,
      clientsNeedingAttention: clients.filter((c) => c.overdueSessions > 0)
        .length,
      overdueSessions: clients.reduce(
        (total, c) => total + c.overdueSessions,
        0,
      ),
      dueThisWeek,
      completedThisWeek,
      adherencePercent:
        dueThisWeek === 0
          ? null
          : Math.round((completedThisWeek / dueThisWeek) * 100),
    },
  };
}
