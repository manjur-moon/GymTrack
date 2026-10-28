import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  TrendingUp,
  Users,
} from "lucide-react";

import { getCoachClientInsights } from "@/server/coach-client-insights";

type Filter = "all" | "attention" | "clear";

function formatDate(value: string | null): string {
  if (!value) return "No completed workouts";
  return `Last workout: ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))} (UTC)`;
}

export default async function CoachClientInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { clients, summary } = await getCoachClientInsights();
  const query = await searchParams;
  const filter: Filter =
    query.filter === "attention" || query.filter === "clear"
      ? query.filter
      : "all";

  const visibleClients = clients.filter((client) => {
    if (filter === "attention") return client.overdueSessions > 0;
    if (filter === "clear") return client.overdueSessions === 0;
    return true;
  });

  return (
    <div className="container stack">
      <header className="page-heading between">
        <div className="stack tight">
          <Link className="text-link" href="/coach">
            <ArrowLeft size={16} aria-hidden /> Coach overview
          </Link>
          <p className="eyebrow">COACH WORKSPACE / CLIENT INSIGHTS</p>
          <h1>Client adherence & attention</h1>
          <p className="muted">
            Compare scheduled-session completion and identify clients with
            overdue coached workouts. All reporting dates use UTC.
          </p>
        </div>
        <Link className="btn secondary" href="/coach/assignments">
          <ClipboardList size={16} aria-hidden /> View assignments
        </Link>
      </header>

      <section className="grid four metrics-grid" aria-label="Client insight metrics">
        <div className="metric-card">
          <span className="metric-icon"><Users size={20} aria-hidden /></span>
          <p className="sub">Approved clients</p>
          <p className="stat">{summary.activeClients}</p>
          <span className="metric-note">With an active coaching relationship</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon"><TrendingUp size={20} aria-hidden /></span>
          <p className="sub">Weekly adherence</p>
          <p className="stat">
            {summary.adherencePercent === null
              ? "—"
              : `${summary.adherencePercent}%`}
          </p>
          <span className="metric-note">
            {summary.completedThisWeek}/{summary.dueThisWeek} sessions due so far
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-icon"><AlertTriangle size={20} aria-hidden /></span>
          <p className="sub">Clients needing attention</p>
          <p className="stat">{summary.clientsNeedingAttention}</p>
          <span className="metric-note">At least one overdue session</span>
        </div>
        <div className="metric-card">
          <span className="metric-icon"><CalendarCheck2 size={20} aria-hidden /></span>
          <p className="sub">Overdue sessions</p>
          <p className="stat">{summary.overdueSessions}</p>
          <span className="metric-note">Across active assignments</span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="client-insights-title">
        <div className="between">
          <div className="stack tight">
            <p className="eyebrow">FOLLOW-UP PRIORITIES</p>
            <h2 id="client-insights-title">Client adherence</h2>
            <p className="sub">
              Weekly figures include sessions due Monday through today (UTC).
              Cancelled sessions are excluded. Overdue totals include previous weeks.
            </p>
          </div>
          <span className="badge">{visibleClients.length} clients</span>
        </div>

        <nav className="row" aria-label="Filter client insights">
          <Link
            className={filter === "all" ? "btn btn-small" : "btn secondary btn-small"}
            href="/coach/insights"
            aria-current={filter === "all" ? "page" : undefined}
          >
            All clients
          </Link>
          <Link
            className={filter === "attention" ? "btn btn-small" : "btn secondary btn-small"}
            href="/coach/insights?filter=attention"
            aria-current={filter === "attention" ? "page" : undefined}
          >
            Needs attention
          </Link>
          <Link
            className={filter === "clear" ? "btn btn-small" : "btn secondary btn-small"}
            href="/coach/insights?filter=clear"
            aria-current={filter === "clear" ? "page" : undefined}
          >
            No overdue sessions
          </Link>
        </nav>

        {visibleClients.length === 0 ? (
          <div className="empty-state">
            <CalendarCheck2 size={26} aria-hidden />
            <h3>
              {clients.length === 0
                ? "No approved clients yet"
                : "No clients match this filter"}
            </h3>
            <p className="muted">
              {clients.length === 0
                ? "Invite a client and have them approve the coaching relationship to see their training insights."
                : "Try another filter to review the rest of your approved clients."}
            </p>
            <Link className="btn secondary" href="/coach/clients">
              Manage clients <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="directory-list">
            {visibleClients.map((client) => (
              <div className="directory-row" key={client.clientId}>
                <span className="profile-avatar" aria-hidden>
                  {client.clientName.slice(0, 2).toUpperCase()}
                </span>
                <div className="client-list-copy" style={{ minWidth: 160 }}>
                  <strong>{client.clientName}</strong>
                  <span>{client.clientEmail}</span>
                  <span>{formatDate(client.lastCompletedAt)}</span>
                </div>
                <div className="stack tight" style={{ minWidth: 140 }}>
                  <strong>
                    {client.adherencePercent === null
                      ? "No sessions due"
                      : `${client.adherencePercent}% adherence`}
                  </strong>
                  <span className="sub">
                    {client.completedThisWeek}/{client.dueThisWeek} due this week
                  </span>
                  <span className="sub">
                    {client.activeAssignments} active assignment
                    {client.activeAssignments === 1 ? "" : "s"}
                  </span>
                </div>
                <span
                  className={`status-pill ${client.overdueSessions === 0 ? "is-success" : ""}`}
                >
                  {client.overdueSessions === 0
                    ? "No overdue"
                    : `${client.overdueSessions} overdue`}
                </span>
                <Link
                  className="btn secondary btn-small"
                  href={`/coach/clients/${encodeURIComponent(client.clientId)}`}
                >
                  View profile <ArrowRight size={15} aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="info-note">
        Only your currently approved clients and your ACTIVE program assignments
        are included. An overdue session is a past-due PLANNED workout that is
        not currently in progress. A client without due workouts displays no
        adherence percentage; this is not a failure score.
      </p>
    </div>
  );
}
