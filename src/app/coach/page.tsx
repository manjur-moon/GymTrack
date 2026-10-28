import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  Clock3,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { getCoachOverviewData } from "@/server/coach-analytics";
import { CoachWeeklyActivityChart } from "@/components/coach-weekly-activity-chart";

function formatLastWorkout(value: string | null): string {
  if (!value) return "No completed workouts";

  return `Last workout: ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))} (UTC)`;
}

export default async function CoachOverview() {
  // The service performs the coach role check and scopes every query
  // to this coach's currently approved client relationships.
  const { metrics, attentionClients, weeklyActivity } =
    await getCoachOverviewData();

  return (
    <div className="container stack coach-overview">
      <header className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH WORKSPACE / INSIGHTS</p>
          <h1>Coaching overview</h1>
          <p className="muted">
            Monitor assigned training, spot missed sessions, and support your
            approved clients.
          </p>
        </div>

        <div className="row">
          <Link className="btn" href="/coach/clients">
            Manage clients <ArrowRight size={16} aria-hidden />
          </Link>
          <Link className="btn secondary" href="/coach/assignments">
            View assignments
          </Link>
        </div>
      </header>

      <section className="grid four metrics-grid" aria-label="Coaching metrics">
        <div className="metric-card">
          <div className="metric-icon">
            <Users size={20} aria-hidden />
          </div>
          <p className="sub">Active clients</p>
          <p className="stat">{metrics.activeClients}</p>
          <span className="metric-note">Approved coaching relationships</span>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <ClipboardList size={20} aria-hidden />
          </div>
          <p className="sub">Active assignments</p>
          <p className="stat">{metrics.activeAssignments}</p>
          <span className="metric-note">Current R3 programs</span>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <TrendingUp size={20} aria-hidden />
          </div>
          <p className="sub">Scheduled adherence</p>
          <p className="stat">
            {metrics.adherencePercent === null
              ? "—"
              : `${metrics.adherencePercent}%`}
          </p>
          <span className="metric-note">
            {metrics.scheduledDueThisWeek === 0
              ? "No sessions due this UTC week"
              : `${metrics.scheduledCompletedThisWeek} of ${metrics.scheduledDueThisWeek} sessions due this UTC week`}
          </span>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <AlertTriangle size={20} aria-hidden />
          </div>
          <p className="sub">Overdue sessions</p>
          <p className="stat">{metrics.overdueScheduledSessions}</p>
          <span className="metric-note">
            Past-due scheduled workouts not in progress
          </span>
        </div>
      </section>

      <section
        className="panel between"
        aria-label="Additional coaching activity"
      >
        <div className="row">
          <CalendarCheck2 size={20} aria-hidden />
          <div className="stack tight">
            <strong>
              {metrics.completedAssignedSessionsLast7Days} assigned workouts
              completed
            </strong>
            <span className="sub">In the last 7 rolling days</span>
          </div>
        </div>
        <div className="row">
          <UserRoundCheck size={20} aria-hidden />
          <div className="stack tight">
            <strong>{metrics.pendingInvitations} pending invitations</strong>
            <span className="sub">Awaiting client acceptance</span>
          </div>
          <Link className="text-link" href="/coach/clients">
            Review <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </section>

      <div className="grid two">
        <section className="card stack" aria-labelledby="weekly-activity-title">
          <div className="between">
            <div className="stack tight">
              <p className="eyebrow">SCHEDULED TRAINING</p>
              <h2 id="weekly-activity-title">Last 7 calendar days</h2>
              <p className="sub">
                Completed versus scheduled sessions, grouped by scheduled UTC
                date.
              </p>
            </div>
            <Activity size={23} aria-hidden />
          </div>

          <CoachWeeklyActivityChart activity={weeklyActivity} />

          <Link className="text-link" href="/coach/assignments">
            Review scheduled programs <ArrowRight size={16} aria-hidden />
          </Link>
        </section>

        <section className="card stack" aria-labelledby="attention-title">
          <div className="between">
            <div className="stack tight">
              <p className="eyebrow">CLIENT FOLLOW-UP</p>
              <h2 id="attention-title">Clients needing attention</h2>
              <p className="sub">
                Approved clients with overdue assigned workouts.
              </p>
            </div>
            <Clock3 size={23} aria-hidden />
          </div>

          {attentionClients.length === 0 ? (
            <div className="empty-state">
              <CalendarCheck2 size={26} aria-hidden />
              <h3>No overdue assigned workouts</h3>
              <p className="muted">
                {metrics.activeAssignments === 0
                  ? "Assign a published program to an approved client to start tracking adherence."
                  : "There are currently no past-due, pending coached sessions that need follow-up."}
              </p>
              <Link className="btn secondary" href="/coach/assignments/new">
                Assign a program
              </Link>
            </div>
          ) : (
            <div className="client-list">
              {attentionClients.map((client) => (
                <Link
                  key={client.clientId}
                  className="client-list-item"
                  href={`/coach/clients/${encodeURIComponent(client.clientId)}`}
                >
                  <div className="profile-avatar" aria-hidden>
                    {client.clientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="client-list-copy">
                    <strong>{client.clientName}</strong>
                    <span>
                      {formatLastWorkout(client.lastCompletedWorkoutAt)}
                    </span>
                    <span>
                      {client.overdueScheduledSessions} overdue scheduled
                      {client.overdueScheduledSessions === 1
                        ? " workout"
                        : " workouts"}
                    </span>
                  </div>
                  <ArrowRight size={17} aria-hidden />
                </Link>
              ))}
            </div>
          )}

          <Link className="text-link" href="/coach/insights">
            View client adherence <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      </div>

      <div className="grid two">
        <Link className="card stack" href="/coach/programs">
          <ClipboardList size={23} aria-hidden />
          <h3>Program library</h3>
          <p className="sub">
            Manage published training templates and reusable program versions.
          </p>
          <span className="text-link">
            Open program library <ArrowRight size={16} aria-hidden />
          </span>
        </Link>

        <Link className="card stack" href="/coach/assignments/new">
          <Users size={23} aria-hidden />
          <h3>Assign a program</h3>
          <p className="sub">
            Schedule a published training program for an approved client.
          </p>
          <span className="text-link">
            Create assignment <ArrowRight size={16} aria-hidden />
          </span>
        </Link>
      </div>

      <p className="info-note">
        Analytics are limited to your currently approved clients and active R3
        assignments. Dates use UTC. Replaced and revoked assignments are not
        included in these overview metrics.
      </p>
    </div>
  );
}
