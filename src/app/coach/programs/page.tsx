import Link from "next/link";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
import { ProgramPublisher } from "@/components/program-publisher";

export default async function CoachProgramsPage() {
  const coach = await requireCoach();
  const [plans, templates] = await Promise.all([
    prisma.plan.findMany({
      where: { userId: coach.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.programTemplate.findMany({
      where: { coachId: coach.id },
      orderBy: { updatedAt: "desc" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    }),
  ]);
  const writable = coach.role === "COACH" && !coach.isDemo;
  return (
    <div className="container stack">
      <div className="page-heading between">
        <div className="stack tight">
          <p className="eyebrow">COACH WORKSPACE / PROGRAM LIBRARY</p>
          <h1>Reusable programs</h1>
          <p className="muted">
            Publish versioned plans and assign the same program safely to many
            clients.
          </p>
        </div>
        <Link href="/plans/new" className="btn">
          Create a source plan
        </Link>
      </div>
      {writable ? (
        <ProgramPublisher
          plans={plans}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        />
      ) : (
        <p className="info-note">This account cannot publish coach programs.</p>
      )}
      <section className="card stack">
        <h2>Published templates</h2>
        {templates.length === 0 ? (
          <p className="sub">
            No published templates yet. Create a plan, then publish the first
            version above.
          </p>
        ) : (
          <div className="r3-program-list">
            {templates.map((t) => {
              const latest = t.versions[0];
              return (
                <article key={t.id} className="r3-program-row">
                  <div className="stack tight">
                    <h3>{t.name}</h3>
                    <p className="sub">
                      {t.goal.replaceAll("_", " ")} · {t.status} ·{" "}
                      {latest
                        ? `Latest version: v${latest.version}`
                        : "Not published"}
                    </p>
                  </div>
                  {writable && latest && (
                    <Link
                      className="btn secondary"
                      href={`/coach/assignments/new?versionId=${latest.id}`}
                    >
                      Assign program
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="info-note">
        To revise a program, create an updated source plan and select “Publish
        next version” above. Previous assigned versions remain unchanged.
      </p>
    </div>
  );
}
