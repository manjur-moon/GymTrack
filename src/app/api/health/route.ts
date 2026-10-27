import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
export const dynamic = "force-dynamic";
export async function GET() {try {await prisma.$queryRaw`SELECT 1`; return NextResponse.json({status:"healthy"},{headers:{"Cache-Control":"no-store"}});} catch {return NextResponse.json({status:"unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});} }
