import { NextResponse } from "next/server";
import { z } from "zod";

import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";

const inviteSchema = z.object({
  email: z.email(),
});

export async function POST(req: Request) {
  const coach = await currentUser();

  if (!coach) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (coach.role !== "COACH" || coach.isDemo) {
    return NextResponse.json(
      { error: "Coach access required" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();

  const client = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      isDemo: true,
    },
  });

  if (!client || client.isDemo || client.id === coach.id) {
    return NextResponse.json(
      { error: "Eligible client not found" },
      { status: 404 },
    );
  }

  const existing = await prisma.coachClient.findUnique({
    where: {
      coachId_clientId: {
        coachId: coach.id,
        clientId: client.id,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.status === "ACTIVE"
            ? "This client is already connected to you."
            : existing.status === "PENDING"
              ? "An invitation is already pending."
              : "This relationship was previously declined or revoked.",
      },
      { status: 409 },
    );
  }

  try {
    const invitation = await prisma.coachClient.create({
      data: {
        coachId: coach.id,
        clientId: client.id,
        status: "PENDING",
        shareBodyWeight: false,
      },
    });

    return NextResponse.json(
      {
        message: "Invitation created successfully",
        id: invitation.id,
        status: invitation.status,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Could not create invitation. Check whether it already exists.",
      },
      { status: 409 },
    );
  }
}
