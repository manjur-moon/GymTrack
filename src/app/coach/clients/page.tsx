import Link from "next/link";
import { ArrowLeft, ArrowRight, UserRoundPlus, Users } from "lucide-react";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  InviteClientForm,
  ReinviteClientButton,
} from "@/components/coach-invitations";

const statuses = ["ALL", "ACTIVE", "PENDING", "DECLINED", "REVOKED"] as const;
type StatusFilter = (typeof statuses)[number];
const PER_PAGE = 20;

type Search = { q?: string; status?: string; page?: string };

function directoryHref(q: string, status: StatusFilter, page: number) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (status !== "ALL") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  const suffix = p.toString();
  return suffix ? `/coach/clients?${suffix}` : "/coach/clients";
}

export default async function CoachClientsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const coach = await requireCoach();
  const search = await searchParams;
  const q = typeof search.q === "string" ? search.q.trim().slice(0, 80) : "";
  const status: StatusFilter =
    statuses.find((s) => s === search.status) ?? "ALL";
  const candidatePage = Number.parseInt(search.page ?? "1", 10);
  const page = Number.isFinite(candidatePage)
    ? Math.max(1, Math.min(candidatePage, 100000))
    : 1;

  const where = {
    coachId: coach.id,
    ...(status !== "ALL" ? { status } : {}),
    ...(q
      ? {
          client: {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const [total, clients] = await Promise.all([
    prisma.coachClient.count({ where }),
    prisma.coachClient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        client: { select: { name: true, email: true } },
      },
    }),
  ]);

  const activeIds = clients
    .filter((c) => c.status === "ACTIVE")
    .map((c) => c.clientId);
  const latest = activeIds.length
    ? await prisma.workoutSession.groupBy({
        by: ["userId"],
        where: { userId: { in: activeIds }, status: "COMPLETED" },
        _max: { completedAt: true },
      })
    : [];
  const recentByUser = new Map(
    latest.map((row) => [row.userId, row._max.completedAt]),
  );

  return (
    <div className="container stack">
      <div className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH WORKSPACE / CLIENT MANAGEMENT</p>
          <h1>Client directory</h1>
          <p className="muted">
            Invite athletes, track consent and review approved clients.
          </p>
        </div>
        <Link href="/coach" className="btn ghost btn-small">
          <ArrowLeft size={16} aria-hidden /> Overview
        </Link>
      </div>

      {coach.role === "COACH" && !coach.isDemo && (
        <section
          className="card stack invite-card"
          aria-labelledby="invite-title"
        >
          <div className="row">
            <span className="metric-icon">
              <UserRoundPlus size={21} aria-hidden />
            </span>
            <div>
              <h2 id="invite-title">Invite a client</h2>
              <p className="sub">
                No access is granted until the client accepts.
              </p>
            </div>
          </div>
          <InviteClientForm />
        </section>
      )}

      <section className="card stack" aria-labelledby="directory-title">
        <div className="between">
          <h2 id="directory-title">Clients & invitations</h2>
          <span className="badge">{total} matching relationships</span>
        </div>

        <form
          action="/coach/clients"
          method="get"
          className="r2-filter-row"
          role="search"
        >
          <label className="field">
            Search by name or email
            <input
              name="q"
              className="input"
              defaultValue={q}
              placeholder="Search clients"
              maxLength={80}
            />
          </label>
          <label className="field">
            Relationship status
            <select name="status" className="input" defaultValue={status}>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn secondary">
            Apply filters
          </button>
          <Link className="btn ghost" href="/coach/clients">
            Clear
          </Link>
        </form>

        {clients.length === 0 ? (
          <div className="empty-state">
            <Users size={26} aria-hidden />
            <h3>
              {q || status !== "ALL"
                ? "No matching relationships"
                : "No clients yet"}
            </h3>
            <p className="muted">
              {q || status !== "ALL"
                ? "Try a different search or status."
                : "Invite a registered athlete to begin."}
            </p>
          </div>
        ) : (
          <div className="directory-list">
            {clients.map((link) => {
              const name = link.client.name ?? link.client.email;
              const completedAt = recentByUser.get(link.clientId);
              return (
                <div className="directory-row" key={link.id}>
                  <span className="profile-avatar" aria-hidden>
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="client-list-copy">
                    <strong>{name}</strong>
                    <span>{link.client.email}</span>
                    {link.status === "ACTIVE" && (
                      <span>
                        Last completed workout:{" "}
                        {completedAt
                          ? completedAt.toISOString().slice(0, 10)
                          : "None yet"}
                      </span>
                    )}
                  </div>
                  <span
                    className={`status-pill ${link.status === "ACTIVE" ? "is-success" : ""}`}
                  >
                    {link.status.toLowerCase()}
                  </span>
                  <div className="directory-actions">
                    {link.status === "ACTIVE" && (
                      <Link
                        href={`/coach/clients/${link.clientId}`}
                        className="btn secondary btn-small"
                      >
                        Client profile <ArrowRight size={15} aria-hidden />
                      </Link>
                    )}
                    {link.status === "PENDING" && (
                      <span className="sub">Awaiting client acceptance</span>
                    )}
                    {(link.status === "DECLINED" ||
                      link.status === "REVOKED") &&
                      coach.role === "COACH" &&
                      !coach.isDemo && (
                        <ReinviteClientButton email={link.client.email} />
                      )}
                  </div>
                  {link.status === "ACTIVE" &&
                    coach.role === "COACH" &&
                    !coach.isDemo && (
                      <Link
                        className="btn secondary btn-small"
                        href={`/coach/assignments/new?clientId=${encodeURIComponent(link.clientId)}`}
                      >
                        Assign program
                      </Link>
                    )}
                </div>
              );
            })}
          </div>
        )}

        <div className="r2-pagination">
          <span className="sub">
            {total === 0
              ? "0"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)}`}{" "}
            of {total}
          </span>
          <div className="row">
            {page > 1 && (
              <Link
                className="btn ghost btn-small"
                href={directoryHref(q, status, page - 1)}
              >
                Previous
              </Link>
            )}
            {page * PER_PAGE < total && (
              <Link
                className="btn secondary btn-small"
                href={directoryHref(q, status, page + 1)}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
      <p className="info-note">
        Program assignment uses published versions and a guided schedule. Only
        active relationships allow viewing client training data.
      </p>
    </div>
  );
}
