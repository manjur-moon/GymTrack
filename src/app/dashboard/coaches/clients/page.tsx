import Link from "next/link";
import { ArrowRight, UserRoundPlus, Users } from "lucide-react";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
import { CoachForm } from "@/components/coach-actions";

export default async function CoachClientsPage() {
  const user = await requireCoach();
  const [clients, plans] = await Promise.all([
    prisma.coachClient.findMany({
      where: { coachId: user.id },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, email: true } } },
    }),
    prisma.plan.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="container stack">
      <div className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH WORKSPACE / CLIENTS</p>
          <h1>Client directory</h1>
          <p className="muted">
            Manage invitations and open approved client progress reports.
          </p>
        </div>
        <span className="badge">{clients.length} relationships</span>
      </div>
      {user.role === "COACH" && !user.isDemo && (
        <section
          className="card invite-card stack"
          aria-labelledby="invite-title"
        >
          <div className="row">
            <div className="metric-icon">
              <UserRoundPlus size={21} aria-hidden />
            </div>
            <div>
              <h2 id="invite-title">Invite a client</h2>
              <p className="sub">
                Clients must already have an account and accept your invitation.
              </p>
            </div>
          </div>
          <CoachForm
            endpoint="/api/coach/invite"
            label="Send invitation"
            fields={[{ name: "email", placeholder: "Client email address" }]}
          />
        </section>
      )}
      <section className="card stack" aria-labelledby="directory-title">
        <div className="between">
          <h2 id="directory-title">Clients & invitations</h2>
          <Link className="text-link" href="/coach">
            Back to overview <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        {clients.length === 0 ? (
          <div className="empty-state">
            <Users size={26} aria-hidden />
            <h3>No clients to show</h3>
            <p className="muted">
              Invite someone using their registered email address to get
              started.
            </p>
          </div>
        ) : (
          <div className="directory-list">
            {clients.map((c) => (
              <div key={c.id} className="directory-row">
                <div className="profile-avatar" aria-hidden>
                  {(c.client.name ?? c.client.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="client-list-copy">
                  <strong>{c.client.name ?? c.client.email}</strong>
                  <span>{c.client.email}</span>
                </div>
                <span
                  className={`status-pill ${c.status === "ACTIVE" ? "is-success" : ""}`}
                >
                  {c.status.replaceAll("_", " ").toLowerCase()}
                </span>
                <div className="directory-actions">
                  {c.status === "ACTIVE" ? (
                    <Link
                      className="btn secondary btn-small"
                      href={`/coach/clients/${c.clientId}`}
                    >
                      View progress <ArrowRight size={15} aria-hidden />
                    </Link>
                  ) : (
                    <span className="sub">Waiting for approval</span>
                  )}
                </div>
                {c.status === "ACTIVE" &&
                plans.length > 0 &&
                user.role === "COACH" &&
                !user.isDemo ? (
                  <details className="legacy-tools">
                    <summary>Assign an existing plan (legacy tool)</summary>
                    <p className="sub">
                      The current assignment API requires database IDs. A
                      searchable plan selector and schedule will replace this
                      form in R3.
                    </p>
                    <CoachForm
                      endpoint="/api/coach/assign"
                      label="Assign plan"
                      fields={[
                        {
                          name: "clientId",
                          placeholder: `Client ID: ${c.clientId}`,
                        },
                        {
                          name: "planId",
                          placeholder: `Plan ID: ${plans.map((p) => p.id).join(", ")}`,
                        },
                      ]}
                    />
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
