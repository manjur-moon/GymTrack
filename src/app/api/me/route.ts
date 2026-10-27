import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
export async function GET() { const user = await currentUser(); return user ? NextResponse.json({user}) : NextResponse.json({error:"Unauthorized"},{status:401}); }
