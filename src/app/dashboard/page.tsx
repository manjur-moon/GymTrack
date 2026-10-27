
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  History,
  PlayCircle,
  TrendingUp,
} from "lucide-react";

import { StartWorkout } from "@/components/start-workout";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

function formatUTC(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();

  const today = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  );

  const todayISO = today.toISOString().slice(0, 10);

  const weekStart = new Date(today);
  weekStart.setUTCDate(
    today.getUTCDate() - ((today.getUTCDay() + 6) % 7)
  );

  const nextSevenDays = new Date(today);
  nextSevenDays.setUTCDate(today.getUTCDate() + 7);

  const [
    activePlan,
    runningSession,
    totalCompleted,
    recentlyCompleted,
    dueThisWeek,
    completedDueThisWeek,
    pendingSchedule,
    lastCompleted,
  ] = await Promise.all([
    prisma.plan.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        days: {
          orderBy: {
            dayNumber: "asc",
          },
          select: {
            id: true,
            name: true,
            dayNumber: true,
            _count: {
              select: {
                exercises: true,
              },
            },
          },
        },
        programAssignment: {
          select: {
            status: true,
          },
        },
      },
    }),

    prisma.workoutSession.findFirst({
      where: {
        userId: user.id,
        status: "IN_PROGRESS",
      },
      select: {
        id: true,
        startedAt: true,
        planDay: {
          select: {
            name: true,
          },
        },
      },
    }),

    prisma.workoutSession.count({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
    }),

    prisma.workoutSession.count({
      where: {
        userId: user.id,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(
            now.getTime() - 7 * 24 * 60 * 60 * 1000
          ),
        },
      },
    }),

    prisma.scheduledWorkout.count({
      where: {
        assignment: {
          clientId: user.id,
          status: "ACTIVE",
        },
        status: {
          in: ["PLANNED", "COMPLETED"],
        },
        scheduledFor: {
          gte: weekStart,
          lte: today,
        },
      },
    }),

    prisma.scheduledWorkout.count({
      where: {
        assignment: {
          clientId: user.id,
          status: "ACTIVE",
        },
        status: "COMPLETED",
        scheduledFor: {
          gte: weekStart,
          lte: today,
        },
      },
    }),

    prisma.scheduledWorkout.findMany({
      where: {
        assignment: {
          clientId: user.id,
          status: "ACTIVE",
        },
        status: "PLANNED",
        scheduledFor: {
          lt: nextSevenDays,
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
      take: 28,
      select: {
        id: true,
        sessionId: true,
        scheduledFor: true,
        planDay: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                exercises: true,
              },
            },
          },
        },
      },
    }),

    prisma.workoutSession.findFirst({
      where: {
        userId: user.id,
        status: "COMPLETED",
      },
      orderBy: {
        completedAt: "desc",
      },
      select: {
        completedAt: true,
        planDay: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const name =
    user.name?.trim().split(/\s+/)[0] || "Athlete";

  const hasCoachProgram =
    activePlan?.programAssignment?.status === "ACTIVE";

  const scheduledToday = pendingSchedule.find(
    (item) =>
      item.scheduledFor.toISOString().slice(0, 10) ===
      todayISO
  );

  const overdue = pendingSchedule.find(
    (item) =>
      item.scheduledFor.toISOString().slice(0, 10) <
      todayISO
  );

  const featured =
    scheduledToday ?? overdue ?? pendingSchedule[0] ?? null;

  const dateKind = featured
    ? featured.scheduledFor.toISOString().slice(0, 10) ===
      todayISO
      ? "TODAY'S WORKOUT"
      : featured.scheduledFor < today
        ? "OVERDUE WORKOUT"
        : "UPCOMING WORKOUT"
    : null;

  const dueRatio = dueThisWeek
    ? `${completedDueThisWeek}/${dueThisWeek}`
    : "—";

  return (
    <div className="container dashboard-page stack">
      {/* Dashboard heading */}
      <header className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">
            YOUR TRAINING WORKSPACE
          </p>

          <h1>Ready when you are, {name}.</h1>

          <p className="muted">
            Your next session, training schedule, and
            progress in one place.
          </p>
        </div>

        <Link
          className="btn secondary"
          href="/workouts/history"
        >
          <History size={17} aria-hidden />
          Workout history
        </Link>
      </header>

      {/* Dashboard statistics */}
      <div className="grid three metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <CalendarCheck2 size={20} aria-hidden />
          </div>

          <p className="sub">Sessions completed</p>
          <p className="stat">{recentlyCompleted}</p>

          <span className="metric-note">
            Completed in the last 7 days
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <CheckCircle2 size={20} aria-hidden />
          </div>

          <p className="sub">
            Scheduled sessions done
          </p>

          <p className="stat">{dueRatio}</p>

          <span className="metric-note">
            Due so far this UTC week
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <TrendingUp size={20} aria-hidden />
          </div>

          <p className="sub">Total completed</p>
          <p className="stat">{totalCompleted}</p>

          <span className="metric-note">
            All recorded workouts
          </span>
        </div>
      </div>

      {/* Primary workout action */}
      <section
        className="feature-panel stack"
        aria-labelledby="next-workout-heading"
      >
        <div className="between">
          <div className="stack tight">
            <p className="eyebrow">
              {runningSession
                ? "SESSION IN PROGRESS"
                : dateKind ??
                  (hasCoachProgram
                    ? "COACHED PROGRAM"
                    : "YOUR NEXT STEP")}
            </p>

            <h2 id="next-workout-heading">
              {runningSession
                ? runningSession.planDay?.name ??
                  "Continue your workout"
                : featured
                  ? featured.planDay.name
                  : hasCoachProgram
                    ? "You're caught up on scheduled workouts"
                    : activePlan
                      ? "Choose your next workout"
                      : "Start your training journey"}
            </h2>

            <p className="muted">
              {runningSession
                ? "Continue logging sets where you left off."
                : featured
                  ? `${formatUTC(featured.scheduledFor)} (UTC) · ${featured.planDay._count.exercises} exercises · ${activePlan?.name ?? "Assigned program"}`
                  : hasCoachProgram
                    ? "No pending coached sessions in your current schedule."
                    : activePlan
                      ? `${activePlan.name} · ${activePlan.days.length} training days`
                      : "Create a plan or accept a coach invitation to get started."}
            </p>
          </div>

          <div className="feature-symbol" aria-hidden>
            <Dumbbell size={28} />
          </div>
        </div>

        {/* Resume running workout */}
        {runningSession ? (
          <div className="action-row">
            <Link
              className="btn"
              href={`/workouts/${runningSession.id}`}
            >
              <PlayCircle size={17} aria-hidden />
              Resume workout
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        ) : featured ? (
          /* Start assigned workout */
          <div className="action-row">
            {user.isDemo ? (
              <span className="badge">
                Read-only demo
              </span>
            ) : featured.sessionId ? (
              <Link
                className="btn"
                href={`/workouts/${featured.sessionId}`}
              >
                Resume scheduled workout
                <ArrowRight size={16} aria-hidden />
              </Link>
            ) : (
              <StartWorkout
                planDayId={featured.planDay.id}
                scheduledWorkoutId={featured.id}
                label="Start scheduled workout"
              />
            )}
          </div>
        ) : hasCoachProgram ? (
          /* No scheduled sessions pending */
          <div className="action-row">
            <Link className="btn" href="/plans">
              View assigned program
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        ) : activePlan ? (
          /* Self-managed workout plan */
          <div className="session-grid">
            {activePlan.days.map((day) => (
              <div
                className="session-choice"
                key={day.id}
              >
                <div>
                  <p className="session-step">
                    DAY {day.dayNumber}
                  </p>

                  <h3>{day.name}</h3>

                  <p className="sub">
                    {day._count.exercises} exercises
                  </p>
                </div>

                {user.isDemo ? (
                  <span className="badge">
                    Preview only
                  </span>
                ) : (
                  <StartWorkout
                    planDayId={day.id}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* No active workout plan */
          <div className="action-row">
            <Link
              className="btn"
              href={
                user.isDemo
                  ? "/plans"
                  : "/onboarding"
              }
            >
              {user.isDemo
                ? "Explore demo plans"
                : "Create your first plan"}

              <ArrowRight size={16} aria-hidden />
            </Link>

            <Link
              className="btn secondary"
              href="/dashboard/coaches"
            >
              My coaches
            </Link>
          </div>
        )}
      </section>

      <div className="grid two">
        {/* Training schedule */}
        <section
          className="card stack"
          aria-labelledby="schedule-heading"
        >
          <div className="between">
            <div className="stack tight">
              <h2 id="schedule-heading">
                Training schedule
              </h2>

              <p className="sub">
                Pending coached sessions, shown
                in UTC dates.
              </p>
            </div>

            <CalendarClock size={22} aria-hidden />
          </div>

          {pendingSchedule.length > 0 ? (
            <div className="r3-schedule">
              {pendingSchedule
                .slice(0, 4)
                .map((item) => {
                  const iso = item.scheduledFor
                    .toISOString()
                    .slice(0, 10);

                  const label =
                    iso === todayISO
                      ? "Today"
                      : iso < todayISO
                        ? "Overdue"
                        : "Upcoming";

                  return (
                    <div
                      className="r3-schedule-card"
                      key={item.id}
                    >
                      <div className="stack tight">
                        <strong>
                          {item.planDay.name}
                        </strong>

                        <span className="sub">
                          {formatUTC(item.scheduledFor)}
                          {" · "}
                          {label}
                        </span>
                      </div>

                      {item.sessionId ? (
                        <Link
                          className="btn secondary"
                          href={`/workouts/${item.sessionId}`}
                        >
                          Resume
                        </Link>
                      ) : !user.isDemo &&
                        !runningSession ? (
                        <StartWorkout
                          planDayId={item.planDay.id}
                          scheduledWorkoutId={item.id}
                          label="Start"
                        />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="empty-state">
              <CalendarCheck2
                size={23}
                aria-hidden
              />

              <strong>
                No pending coached sessions
              </strong>

              <p className="muted">
                {hasCoachProgram
                  ? "Your current schedule has no remaining pending workouts."
                  : "When a coach assigns a program, upcoming sessions will appear here."}
              </p>
            </div>
          )}

          <Link
            className="text-link"
            href="/plans"
          >
            View all training plans
            <ArrowRight size={16} aria-hidden />
          </Link>
        </section>

        {/* Training progress */}
        <section
          className="card stack"
          aria-labelledby="progress-heading"
        >
          <div className="between">
            <div className="stack tight">
              <h2 id="progress-heading">
                Your progress
              </h2>

              <p className="sub">
                Build consistency, one completed
                session at a time.
              </p>
            </div>

            <TrendingUp size={22} aria-hidden />
          </div>

          <div className="panel stack">
            <p className="sub">
              Scheduled sessions completed /
              due this week
            </p>

            <p className="stat">{dueRatio}</p>

            <div
              role="progressbar"
              aria-label="Scheduled workout completion this week"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                dueThisWeek
                  ? Math.round(
                      (completedDueThisWeek /
                        dueThisWeek) *
                        100
                    )
                  : 0
              }
              aria-valuetext={
                dueThisWeek
                  ? `${completedDueThisWeek} of ${dueThisWeek} due sessions completed`
                  : "No scheduled sessions due"
              }
              style={{
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                background: "#dce8e6",
              }}
            >
              <div
                style={{
                  width: `${
                    dueThisWeek
                      ? Math.round(
                          (completedDueThisWeek /
                            dueThisWeek) *
                            100
                        )
                      : 0
                  }%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "var(--accent)",
                }}
              />
            </div>

            <p className="metric-note">
              {dueThisWeek === 0
                ? "No coached sessions have been due this week."
                : "Completed versus scheduled sessions due through today (UTC)."}
            </p>
          </div>

          <p className="sub">
            {lastCompleted?.completedAt
              ? `Last completed: ${
                  lastCompleted.planDay?.name ??
                  "Workout"
                } · ${formatUTC(
                  lastCompleted.completedAt
                )} (UTC)`
              : "Your completed workout summary will appear here."}
          </p>

          <Link
            className="text-link"
            href="/dashboard/progress"
          >
            View detailed insights
            <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </div>

      {/* Secondary navigation */}
      <div className="grid two">
        <Link
          className="card action-card"
          href="/dashboard/coaches"
        >
          <ClipboardList size={22} aria-hidden />

          <h3>Coaching & permissions</h3>

          <p className="sub">
            Manage invitations, coach relationships,
            and shared data.
          </p>

          <span className="action-link">
            Manage coaches
            <ArrowRight size={16} aria-hidden />
          </span>
        </Link>

        <Link
          className="card action-card"
          href="/workouts/history"
        >
          <History size={22} aria-hidden />

          <h3>Workout history</h3>

          <p className="sub">
            Review completed sessions and previous
            set performance.
          </p>

          <span className="action-link">
            Open history
            <ArrowRight size={16} aria-hidden />
          </span>
        </Link>
      </div>
    </div>
  );
}
