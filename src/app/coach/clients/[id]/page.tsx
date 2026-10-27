import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Dumbbell, ShieldCheck, TrendingUp } from "lucide-react";
import { requireCoach, coachHasClient } from "@/server/auth";
import { getProgress } from "@/server/progress";
import { prisma } from "@/server/db";

export default async function ClientProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const coach = await requireCoach();
  const { id } = await params;

  // Ownership is checked on the server before loading private information.
  const relationship = await coachHasClient(coach.id, id);
  if (!relationship) notFound();

  const [client, progress, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true },
    }),
    getProgress(id),
    prisma.workoutSession.findMany({
      where: { userId: id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 5,
      select: {
        id: true,
        completedAt: true,
        planDay: { select: { name: true } },
        _count: { select: { setLogs: true } },
      },
    }),
  ]);
  if (!client) notFound();

  return (
    <div className="container stack">
      <div className="page-heading stack tight">
        <Link href="/coach/clients" className="text-link">
          <ArrowLeft size={16} aria-hidden /> Client directory
        </Link>
        <p className="eyebrow">APPROVED CLIENT / TRAINING SUMMARY</p>
        <h1>{client.name ?? client.email}</h1>
        <p className="muted">{client.email}</p>
        {coach.role === "COACH" && !coach.isDemo && (
          <Link
            className="btn secondary"
            href={`/coach/assignments/new?clientId=${encodeURIComponent(id)}`}
          >
            Assign program
          </Link>
        )}
      </div>

      <div className="grid three">
        <div className="metric-card">
          <Dumbbell size={20} aria-hidden />
          <p className="sub">Completed sessions</p>
          <p className="stat">{progress.workoutCount}</p>
        </div>
        <div className="metric-card">
          <TrendingUp size={20} aria-hidden />
          <p className="sub">Workout streak</p>
          <p className="stat">{progress.streak}</p>
        </div>
        <div className="metric-card">
          <ShieldCheck size={20} aria-hidden />
          <p className="sub">Weighted PRs</p>
          <p className="stat">{progress.records.length}</p>
        </div>
      </div>

      <section className="card stack" aria-labelledby="recent-title">
        <h2 id="recent-title">Recent completed workouts</h2>
        {sessions.length === 0 ? (
          <p className="sub">No completed workout sessions yet.</p>
        ) : (
          <div className="r2-session-list">
            {sessions.map((session) => (
              <div className="r2-session-row" key={session.id}>
                <div className="stack tight">
                  <strong>{session.planDay?.name ?? "Workout session"}</strong>
                  <span className="sub">
                    {session.completedAt?.toISOString().slice(0, 10) ??
                      "Date unavailable"}
                  </span>
                </div>
                <span className="badge">
                  {session._count.setLogs} saved sets
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="records-title">
        <h2 id="records-title">Strength records</h2>
        <p className="sub">
          Best completed weighted sets; warmup sets excluded.
        </p>
        {progress.records.length === 0 ? (
          <p className="sub">No strength records available.</p>
        ) : (
          <div className="r2-table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Exercise</th>
                  <th scope="col">Best weight</th>
                  <th scope="col">Estimated 1RM</th>
                </tr>
              </thead>
              <tbody>
                {progress.records.map((record) => (
                  <tr key={record.exerciseId}>
                    <td>{record.name}</td>
                    <td>{record.bestWeightKg.toFixed(2)} kg</td>
                    <td>
                      {record.bestEstimated1RMKg === null
                        ? "N/A"
                        : `${record.bestEstimated1RMKg.toFixed(2)} kg`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="permission-title">
        <h2 id="permission-title">Privacy & permissions</h2>
        <p className="sub">Client-approved active coaching relationship.</p>
        <p className="sub">
          Body-weight sharing:{" "}
          <strong>
            {relationship.shareBodyWeight ? "Enabled" : "Disabled"}
          </strong>
        </p>
        {relationship.shareBodyWeight && (
          <div className="stack tight">
            <h3>Body-weight history</h3>
            {progress.weights.length === 0 ? (
              <p className="sub">No measurements recorded.</p>
            ) : (
              progress.weights.map((weight) => (
                <p key={weight.date} className="sub">
                  {weight.date} — {weight.weightKg} kg
                </p>
              ))
            )}
          </div>
        )}
      </section>
      <p className="info-note">
        Coaches can only view client data while the relationship is ACTIVE.
        Progress sharing and measurement sharing have separate permissions.
      </p>
    </div>
  );
}
