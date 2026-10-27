import Link from "next/link";
import { requireCoach } from "@/server/auth";
import { prisma } from "@/server/db";
import { programSnapshotSchema } from "@/lib/programs";
import { ProgramAssigner } from "@/components/program-assigner";
export default async function AssignmentNew({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; versionId?: string }>;
}) {
  const user = await requireCoach();
  const params = await searchParams;
  const [links, templates] = await Promise.all([
    prisma.coachClient.findMany({
      where: { coachId: user.id, status: "ACTIVE" },
      include: { client: { select: { id: true, name: true, email: true } } },
    }),
    prisma.programTemplate.findMany({
      where: { coachId: user.id, status: "ACTIVE" },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    }),
  ]);
  const programs = templates.flatMap((t) =>
    t.versions.flatMap((v) => {
      const parsed = programSnapshotSchema.safeParse(v.snapshot);
      return parsed.success
        ? [
            {
              id: v.id,
              name: t.name,
              version: v.version,
              dayCount: parsed.data.days.length,
            },
          ]
        : [];
    }),
  );
  return (
    <div className="container stack">
      <Link className="text-link" href="/coach/assignments">
        ← All assignments
      </Link>
      <div className="stack tight">
        <p className="eyebrow">COACH / ASSIGNMENTS</p>
        <h1>Assign a program</h1>
        <p className="muted">
          Choose an approved client and a published version. No database IDs
          required.
        </p>
      </div>
      {user.role !== "COACH" || user.isDemo ? (
        <p className="warn">Coach account required to assign a program.</p>
      ) : links.length === 0 ? (
        <div className="empty-state">
          <h2>No active clients</h2>
          <p>Invite a registered client and ask them to accept first.</p>
          <Link className="btn" href="/coach/clients">
            Manage clients
          </Link>
        </div>
      ) : programs.length === 0 ? (
        <div className="empty-state">
          <h2>No published programs</h2>
          <p>Publish a source plan before assigning it.</p>
          <Link className="btn" href="/coach/programs">
            Program library
          </Link>
        </div>
      ) : (
        <ProgramAssigner
          clients={links.map((l) => ({
            id: l.client.id,
            name: l.client.name ?? l.client.email,
          }))}
          programs={programs}
          initialClientId={params.clientId}
          initialVersionId={params.versionId}
          minStartDate={new Date().toISOString().slice(0, 10)}
        />
      )}
    </div>
  );
}
