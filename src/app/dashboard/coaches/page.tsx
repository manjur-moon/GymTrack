
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { CoachAction } from "@/components/coach-actions";

export default async function MyCoachesPage() {
  const user = await requireUser();

  const links = await prisma.coachClient.findMany({
    where: {
      clientId: user.id,
    },
    include: {
      coach: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeCoaches = links.filter(
    (link) => link.status === "ACTIVE"
  ).length;

  const pendingInvitations = links.filter(
    (link) => link.status === "PENDING"
  ).length;

  return (
    <div className="container stack">
      {/* Page header */}
      <div className="stack">
        <p className="eyebrow">
          COACHING & PERMISSIONS
        </p>

        <h1>My Coaches</h1>

        <p className="sub">
          Manage your coaching relationships and
          control who can access your workout
          progress.
        </p>

        <p className="sub">
          Your body-weight information remains
          private unless you explicitly allow a
          coach to view it.
        </p>
      </div>

      {/* Summary */}
      <div className="grid three">
        <div className="card stack">
          <p className="sub">Total relationships</p>

          <p className="stat">{links.length}</p>
        </div>

        <div className="card stack">
          <p className="sub">Active coaches</p>

          <p className="stat">{activeCoaches}</p>
        </div>

        <div className="card stack">
          <p className="sub">
            Pending invitations
          </p>

          <p className="stat">
            {pendingInvitations}
          </p>
        </div>
      </div>

      {/* Demo account notice */}
      {user.isDemo && (
        <div className="warn" role="status">
          You are viewing the read-only demo.
          Coaching permissions cannot be changed
          in demo mode.
        </div>
      )}

      {/* Empty state */}
      {links.length === 0 && (
        <div className="card stack">
          <h2>No coaching relationships yet</h2>

          <p className="sub">
            When a registered coach invites you,
            the invitation will appear here.
          </p>

          <p className="sub">
            You can accept or decline invitations
            and manage access to your progress
            at any time.
          </p>
        </div>
      )}

      {/* Coach relationships */}
      {links.map((link) => {
        const isPending =
          link.status === "PENDING";

        const isActive =
          link.status === "ACTIVE";

        const coachName =
          link.coach.name ??
          link.coach.email ??
          "Unknown coach";

        return (
          <section
            className="card stack"
            key={link.id}
          >
            {/* Coach information */}
            <div className="between">
              <div className="stack">
                <h2>{coachName}</h2>

                <p className="sub">
                  {link.coach.email}
                </p>
              </div>

              <span className="badge">
                {link.status}
              </span>
            </div>

            <div className="divider" />

            {/* Relationship details */}
            <div className="stack">
              <p className="sub">
                <strong>
                  Relationship status:
                </strong>{" "}
                {link.status}
              </p>

              <p className="sub">
                <strong>
                  Body-weight sharing:
                </strong>{" "}
                {link.shareBodyWeight
                  ? "Enabled"
                  : "Disabled"}
              </p>
            </div>

            {/* Pending invitation actions */}
            {isPending && !user.isDemo && (
              <div className="stack">
                <p className="sub">
                  This coach has invited you to
                  share your training progress.
                  You can accept or decline
                  the invitation.
                </p>

                <div className="row">
                  <CoachAction
                    path={`/api/me/coaches/${link.id}`}
                    body={{
                      action: "accept",
                    }}
                    label="Accept invitation"
                  />

                  <CoachAction
                    path={`/api/me/coaches/${link.id}`}
                    body={{
                      action: "decline",
                    }}
                    label="Decline invitation"
                  />
                </div>
              </div>
            )}

            {/* Active relationship actions */}
            {isActive && !user.isDemo && (
              <div className="stack">
                <p className="sub">
                  This coach can view your
                  workout progress. You can
                  manage additional permissions
                  or revoke access.
                </p>

                <div className="row">
                  <CoachAction
                    path={`/api/me/coaches/${link.id}`}
                    body={{
                      action: link.shareBodyWeight
                        ? "weight-off"
                        : "weight-on",
                    }}
                    label={
                      link.shareBodyWeight
                        ? "Stop sharing body weight"
                        : "Share body weight"
                    }
                  />

                  <CoachAction
                    path={`/api/me/coaches/${link.id}`}
                    body={{
                      action: "revoke",
                    }}
                    label="Revoke coach access"
                  />
                </div>
              </div>
            )}

            {/* Declined relationship */}
            {link.status === "DECLINED" && (
              <p className="sub">
                You declined this coaching
                invitation. This coach cannot
                access your training progress
                through this relationship.
              </p>
            )}

            {/* Revoked relationship */}
            {link.status === "REVOKED" && (
              <p className="sub">
                You revoked this coach&apos;s
                access to your training data.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
