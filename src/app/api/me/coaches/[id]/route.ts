import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { clientRelationshipUpdate } from "@/lib/coach-relationship";

const schema = z.object({
  action: z.enum(["accept", "decline", "revoke", "weight-on", "weight-off"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const client = await currentUser();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (client.isDemo) {
    return NextResponse.json({ error: "Read-only demo" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid relationship action." }, { status: 400 });
  }

  const relationship = await prisma.coachClient.findFirst({
    where: { id, clientId: client.id },
    select: { id: true, status: true },
  });
  if (!relationship) {
    return NextResponse.json({ error: "Relationship not found." }, { status: 404 });
  }

  const update = clientRelationshipUpdate(relationship.status, parsed.data.action);
  if (!update) {
    return NextResponse.json(
      { error: "This action is not allowed for the current relationship status." },
      { status: 409 },
    );
  }

  // The condition on status prevents a stale response from restoring revoked access.
  const changed = await prisma.coachClient.updateMany({
    where: { id, clientId: client.id, status: relationship.status },
    data: update,
  });
  if (changed.count !== 1) {
    return NextResponse.json({ error: "Relationship changed. Refresh and retry." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, ...update });
}
