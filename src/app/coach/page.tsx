import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";

export default async function CoachOverview() {
  const user = await requireCoach();
  const clients = await prisma.coachClient.findMany({
    where: { coachId: user.id },
    include: { client: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const activeIds = clients
    .filter((c) => c.status === "ACTIVE")
    .map((c) => c.clientId);
  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const [programs, recentSessions] = await Promise.all([
    prisma.plan.count({ where: { userId: user.id } }),
    activeIds.length
      ? prisma.workoutSession.count({
          where: {
            userId: { in: activeIds },
            status: "COMPLETED",
            completedAt: { gte: weekStart },
          },
        })
      : Promise.resolve(0),
  ]);
  const active = clients.filter((c) => c.status === "ACTIVE");
  const pending = clients.filter((c) => c.status === "PENDING");

  return (
    <div className="container stack coach-overview">
      <div className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH WORKSPACE</p>
          <h1>Your coaching overview</h1>
          <p className="muted">
            Your client relationships and recent training activity, all in one
            place.
          </p>
        </div>
        <div className="row">
          <Link href="/coach/clients" className="btn">
            Manage clients <ArrowRight size={16} aria-hidden />
          </Link>
          <Link href="/coach/programs" className="btn secondary">
            Program templates
          </Link>
        </div>
      </div>
      <div className="grid four metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <Users size={20} aria-hidden />
          </div>
          <p className="sub">Active clients</p>
          <p className="stat">{active.length}</p>
          <span className="metric-note">Approved relationships</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <UserRoundCheck size={20} aria-hidden />
          </div>
          <p className="sub">Pending invitations</p>
          <p className="stat">{pending.length}</p>
          <span className="metric-note">Awaiting client response</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <ClipboardList size={20} aria-hidden />
          </div>
          <p className="sub">Your programs</p>
          <p className="stat">{programs}</p>
          <span className="metric-note">Saved plans</span>
        </div>
        <div className="metric-card">
          <div className="metric-icon">
            <CalendarCheck2 size={20} aria-hidden />
          </div>
          <p className="sub">Client sessions this week</p>
          <p className="stat">{recentSessions}</p>
          <span className="metric-note">Last 7 days · active clients</span>
        </div>
      </div>
      <section className="card stack" aria-labelledby="coach-clients-title">
        <div className="between">
          <div className="stack tight">
            <h2 id="coach-clients-title">Your active clients</h2>
            <p className="sub">
              Open a client to review their recorded progress.
            </p>
          </div>
          <Link className="text-link" href="/coach/clients">
            View all clients <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="empty-state">
            <Users size={25} aria-hidden />
            <h3>No active clients yet</h3>
            <p className="muted">
              Invite a client; after they approve, you&apos;ll be able to review
              their training data.
            </p>
            <Link className="btn secondary" href="/coach/clients">
              Go to clients
            </Link>
          </div>
        ) : (
          <div className="client-list">
            {active.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                className="client-list-item"
                href={`/coach/clients/${c.clientId}`}
              >
                <div className="profile-avatar" aria-hidden>
                  {(c.client.name ?? c.client.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="client-list-copy">
                  <strong>{c.client.name ?? c.client.email}</strong>
                  <span>{c.client.email}</span>
                </div>
                <span className="status-pill is-success">Active</span>
                <ArrowRight size={17} aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </section>
      <p className="info-note">
        R3 adds schedule-linked completion data. Full adherence and
        overdue-session insights are planned for R5.
      </p>
    </div>
  );
}
