import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the authorization and database boundaries; no real DB is accessed.
const mocks = vi.hoisted(() => ({
  requireCoach: vi.fn(),
  findRelationships: vi.fn(),
  findAssignments: vi.fn(),
  groupScheduled: vi.fn(),
  groupSessions: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ requireCoach: mocks.requireCoach }));
vi.mock("@/server/db", () => ({
  prisma: {
    coachClient: { findMany: mocks.findRelationships },
    programAssignment: { findMany: mocks.findAssignments },
    scheduledWorkout: { groupBy: mocks.groupScheduled },
    workoutSession: { groupBy: mocks.groupSessions },
  },
}));

import { getCoachClientInsights } from "@/server/coach-client-insights";

const relationship = (id: string, name: string) => ({
  clientId: id,
  client: { name, email: `${id}@example.test` },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  // Wednesday, UTC. Reporting week begins Monday, 2026-10-26.
  vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
  mocks.requireCoach.mockResolvedValue({ id: "coach-a", role: "COACH" });
  mocks.findRelationships.mockResolvedValue([]);
  mocks.findAssignments.mockResolvedValue([]);
  mocks.groupScheduled.mockResolvedValue([]);
  mocks.groupSessions.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getCoachClientInsights", () => {
  it("requires coach authorization before querying client data", async () => {
    mocks.requireCoach.mockRejectedValue(new Error("Forbidden"));

    await expect(getCoachClientInsights()).rejects.toThrow("Forbidden");
    expect(mocks.findRelationships).not.toHaveBeenCalled();
    expect(mocks.findAssignments).not.toHaveBeenCalled();
  });

  it("returns empty metrics without reading client activity when no active relationship exists", async () => {
    const result = await getCoachClientInsights();

    expect(result.clients).toEqual([]);
    expect(result.summary).toMatchObject({
      activeClients: 0,
      clientsNeedingAttention: 0,
      overdueSessions: 0,
      adherencePercent: null,
    });
    expect(mocks.findRelationships).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { coachId: "coach-a", status: "ACTIVE" },
      }),
    );
    expect(mocks.findAssignments).not.toHaveBeenCalled();
    expect(mocks.groupScheduled).not.toHaveBeenCalled();
  });

  it("scopes assignment, schedule and history queries to approved clients and the coach", async () => {
    mocks.findRelationships.mockResolvedValue([relationship("c1", "Ada")]);

    await getCoachClientInsights();

    const expectedScope = {
      coachId: "coach-a",
      clientId: { in: ["c1"] },
      status: "ACTIVE",
    };

    expect(mocks.findAssignments).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedScope }),
    );
    expect(mocks.groupScheduled).toHaveBeenCalledTimes(2);
    for (const [query] of mocks.groupScheduled.mock.calls) {
      expect(query.where.assignment.is).toEqual(expectedScope);
    }
    expect(mocks.groupSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: { in: ["c1"] },
          status: "COMPLETED",
        },
      }),
    );
  });

  it("calculates per-client adherence, overall adherence and overdue priority", async () => {
    mocks.findRelationships.mockResolvedValue([
      relationship("c1", "Ada"),
      relationship("c2", "Bo"),
    ]);
    mocks.findAssignments.mockResolvedValue([
      { id: "a1", clientId: "c1" },
      { id: "a2", clientId: "c2" },
    ]);
    mocks.groupScheduled
      .mockResolvedValueOnce([
        { assignmentId: "a1", status: "COMPLETED", _count: { _all: 2 } },
        { assignmentId: "a1", status: "PLANNED", _count: { _all: 1 } },
        { assignmentId: "a2", status: "COMPLETED", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { assignmentId: "a1", _count: { _all: 1 } },
      ]);
    mocks.groupSessions.mockResolvedValue([
      {
        userId: "c1",
        _max: { completedAt: new Date("2026-10-27T15:00:00.000Z") },
      },
    ]);

    const result = await getCoachClientInsights();

    expect(result.summary).toEqual({
      activeClients: 2,
      clientsNeedingAttention: 1,
      overdueSessions: 1,
      dueThisWeek: 4,
      completedThisWeek: 3,
      adherencePercent: 75,
    });
    expect(result.clients[0]).toMatchObject({
      clientId: "c1",
      activeAssignments: 1,
      dueThisWeek: 3,
      completedThisWeek: 2,
      adherencePercent: 67,
      overdueSessions: 1,
      lastCompletedAt: "2026-10-27T15:00:00.000Z",
    });
    expect(result.clients[1]).toMatchObject({
      clientId: "c2",
      dueThisWeek: 1,
      completedThisWeek: 1,
      adherencePercent: 100,
      overdueSessions: 0,
      lastCompletedAt: null,
    });
  });

  it("uses no percentage when no workouts are due and excludes in-progress sessions from overdue criteria", async () => {
    mocks.findRelationships.mockResolvedValue([relationship("c1", "Ada")]);

    const result = await getCoachClientInsights();

    expect(result.summary.adherencePercent).toBeNull();
    expect(result.clients[0].adherencePercent).toBeNull();
    const overdueQuery = mocks.groupScheduled.mock.calls[1][0];
    expect(overdueQuery.where.status).toBe("PLANNED");
    expect(overdueQuery.where.scheduledFor.lt).toEqual(
      new Date("2026-10-28T00:00:00.000Z"),
    );
    expect(overdueQuery.where.OR).toEqual([
      { sessionId: null },
      { session: { is: { status: { not: "IN_PROGRESS" } } } },
    ]);
  });
});
