import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Dumbbell,
  TrendingUp,
} from "lucide-react";

import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";

type PageProps = {
  params: Promise<{ id: string }>;
};

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatElapsed(start: Date, end: Date) {
  const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  if (minutes < 1) return "Under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export default async function WorkoutSummaryPage({ params }: PageProps) {
  const user = await requireUser();
  const { id } = await params;

  // Scope the query to the authenticated account, not just the URL ID.
  const session = await prisma.workoutSession.findFirst({
    where: { id, userId: user.id },
    select: {
      status: true,
      startedAt: true,
      completedAt: true,
      planDay: {
        select: {
          name: true,
          plan: { select: { name: true } },
        },
      },
      scheduledWorkout: { select: { scheduledFor: true } },
      setLogs: {
        orderBy: [{ loggedAt: "asc" }, { setNumber: "asc" }],
        select: {
          id: true,
          exerciseId: true,
          setNumber: true,
          reps: true,
          weightKg: true,
          durationSeconds: true,
          distanceMeters: true,
          rpe: true,
          isWarmup: true,
          exercise: { select: { name: true } },
        },
      },
    },
  });

  if (!session) notFound();
  if (session.status === "IN_PROGRESS") redirect(`/workouts/${id}`);
  if (session.status !== "COMPLETED" || !session.completedAt) {
    redirect("/workouts/history");
  }

  const workingSets = session.setLogs.filter((set) => !set.isWarmup);
  const totalVolumeKg = workingSets.reduce((total, set) => {
    if (set.reps === null || set.weightKg === null) return total;
    return total + set.reps * set.weightKg.toNumber();
  }, 0);

  const groups = new Map<
    string,
    { id: string; name: string; sets: typeof session.setLogs }
  >();

  for (const set of session.setLogs) {
    const existing = groups.get(set.exerciseId);
    if (existing) {
      existing.sets.push(set);
    } else {
      groups.set(set.exerciseId, {
        id: set.exerciseId,
        name: set.exercise.name,
        sets: [set],
      });
    }
  }

  const exercises = Array.from(groups.values());
  const workoutName = session.planDay?.name ?? "Workout";
  const programName = session.planDay?.plan.name;

  return (
    <div className="container stack max-w-5xl gap-6 py-8 sm:py-12">
      <header className="rounded-3xl bg-[#10273a] p-6 text-white sm:p-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-semibold text-emerald-200">
          <CheckCircle2 size={17} aria-hidden="true" />
          Workout completed
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Nice work. Session complete.
        </h1>
        <p className="mt-3 text-lg font-semibold text-white">{workoutName}</p>
        {programName && (
          <p className="mt-1 text-sm text-slate-300">{programName}</p>
        )}
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          <CalendarDays size={16} aria-hidden="true" />
          {formatDate(session.completedAt)} (UTC)
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn">
            Back to dashboard <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/workouts/history" className="btn secondary">
            Workout history
          </Link>
        </div>
      </header>

      <section aria-label="Workout statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card">
          <Clock3 size={21} className="text-teal-700" aria-hidden="true" />
          <p className="sub">Elapsed time</p>
          <p className="stat">{formatElapsed(session.startedAt, session.completedAt)}</p>
          <p className="metric-note">From start to finish</p>
        </div>
        <div className="metric-card">
          <Dumbbell size={21} className="text-teal-700" aria-hidden="true" />
          <p className="sub">Exercises logged</p>
          <p className="stat">{exercises.length}</p>
          <p className="metric-note">Unique exercises</p>
        </div>
        <div className="metric-card">
          <CheckCircle2 size={21} className="text-teal-700" aria-hidden="true" />
          <p className="sub">Working sets</p>
          <p className="stat">{workingSets.length}</p>
          <p className="metric-note">Warm-ups excluded</p>
        </div>
        <div className="metric-card">
          <TrendingUp size={21} className="text-teal-700" aria-hidden="true" />
          <p className="sub">Weighted volume</p>
          <p className="stat">{numberFormat.format(totalVolumeKg)} kg</p>
          <p className="metric-note">Reps × kg, working sets only</p>
        </div>
      </section>

      <section className="card stack" aria-labelledby="breakdown-title">
        <div className="stack tight">
          <p className="eyebrow">YOUR TRAINING RECORD</p>
          <h2 id="breakdown-title">Exercise breakdown</h2>
          <p className="sub">These are the sets saved to your workout history.</p>
        </div>

        {exercises.length === 0 ? (
          <p className="sub">No exercise sets were recorded.</p>
        ) : (
          <div className="stack gap-4">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="between mb-3">
                  <h3>{exercise.name}</h3>
                  <span className="badge">
                    {exercise.sets.filter((set) => !set.isWarmup).length} working sets
                  </span>
                </div>

                <div className="stack gap-2">
                  {exercise.sets.map((set) => {
                    const details = [
                      set.reps !== null ? `${set.reps} reps` : null,
                      set.weightKg !== null
                        ? `${numberFormat.format(set.weightKg.toNumber())} kg`
                        : null,
                      set.durationSeconds !== null
                        ? `${set.durationSeconds} sec`
                        : null,
                      set.distanceMeters !== null
                        ? `${numberFormat.format(set.distanceMeters.toNumber())} m`
                        : null,
                      set.rpe !== null
                        ? `RPE ${numberFormat.format(set.rpe.toNumber())}`
                        : null,
                    ].filter(Boolean);

                    return (
                      <div key={set.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm">
                        <span className="font-semibold text-slate-700">
                          Set {set.setNumber}
                          {set.isWarmup && (
                            <span className="ml-2 text-xs font-normal text-slate-500">Warm-up</span>
                          )}
                        </span>
                        <span className="text-slate-700">
                          {details.join(" · ") || "Recorded set"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid two">
        <section className="card stack">
          <h2>Progress happens over time</h2>
          <p className="sub">
            Compare completed sessions, training volume and personal records
            to see how your performance changes.
          </p>
          <Link href="/dashboard/progress" className="text-link">
            View progress <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>

        <section className="card stack">
          <h2>{session.scheduledWorkout ? "Scheduled session completed" : "Session saved"}</h2>
          <p className="sub">
            {session.scheduledWorkout
              ? `This workout was assigned for ${formatDate(session.scheduledWorkout.scheduledFor)} (UTC). The linked schedule is updated when you finish.`
              : "This workout is now part of your personal training history."}
          </p>
          <Link href="/plans" className="text-link">
            View programs <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>
    </div>
  );
}
