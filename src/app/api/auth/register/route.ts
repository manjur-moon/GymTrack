import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
const schema = z.object({ name: z.string().trim().min(2).max(80), email: z.email().max(160), password: z.string().min(8).max(128) });
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({error:"Please enter a name, valid email and password (8+ characters)."},{status:400});
  const { name, password } = parsed.data; const email = parsed.data.email.toLowerCase();
  if (await prisma.user.findUnique({where:{email}})) return NextResponse.json({error:"Email already registered"},{status:409});
  try { const user = await prisma.user.create({data:{name,email,passwordHash:await bcrypt.hash(password,12),profile:{create:{}}},select:{id:true}}); return NextResponse.json(user,{status:201}); }
  catch { return NextResponse.json({error:"Registration failed"},{status:500}); }
}
