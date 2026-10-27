import Link from "next/link";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
export default async function AssignmentList() {
  const user = await requireCoach();
  const activeLinks = await prisma.coachClient.findMany({
    where: { coachId: user.id, status: "ACTIVE" },
    select: { clientId: true },
  });
  const assignments = await prisma.programAssignment.findMany({
    where: {
      coachId: user.id,
      clientId: { in: activeLinks.map((x) => x.clientId) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      client: { select: { name: true, email: true } },
      version: {
        select: { version: true, template: { select: { name: true } } },
      },
      scheduledWorkouts: { select: { status: true, scheduledFor: true } },
    },
  });
  return (
    <div className="container stack">
      <div className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH / ASSIGNMENTS</p>
          <h1>Client programs</h1>
          <p className="muted">
            Published program versions and scheduled sessions.
          </p>
        </div>
        <Link className="btn" href="/coach/assignments/new">
          Assign program
        </Link>
      </div>
      <section className="card stack">
        <h2>Assignments for currently approved clients</h2>
        {assignments.length === 0 ? (
          <p className="sub">No assignments yet.</p>
        ) : (
          <div className="r3-program-list">
            {assignments.map((a) => {
              const completed = a.scheduledWorkouts.filter(
                (s) => s.status === "COMPLETED",
              ).length;
              return (
                <div className="r3-program-row" key={a.id}>
                  <div className="stack tight">
                    <h3>{a.client.name ?? a.client.email}</h3>
                    <p className="sub">
                      {a.version.template.name} · v{a.version.version} ·{" "}
                      {a.status}
                    </p>
                    <p className="sub">
                      {a.startDate.toISOString().slice(0, 10)} –{" "}
                      {a.endDate.toISOString().slice(0, 10)} · {completed}/
                      {a.scheduledWorkouts.length} scheduled sessions completed
                    </p>
                  </div>
                  <span className="status-pill">{a.status.toLowerCase()}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
