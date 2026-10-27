import "server-only";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, isDemo: true } });
}
export async function requireUser() { const user = await currentUser(); if (!user) redirect("/login"); return user; }
export async function requireCoach() { const user = await requireUser(); if (user.role !== "COACH" && user.role !== "ADMIN") redirect("/dashboard"); return user; }
export function canWrite(user: { isDemo: boolean }) { return !user.isDemo; }
export async function coachHasClient(coachId: string, clientId: string) { return prisma.coachClient.findFirst({ where: { coachId, clientId, status: "ACTIVE" } }); }
