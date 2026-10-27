import {NextResponse} from "next/server";import {prisma} from "@/server/db";
export async function GET(){const data=await prisma.exercise.findMany({where:{isActive:true},orderBy:{name:"asc"},select:{id:true,name:true,muscle:true,pattern:true,equipment:true,difficulty:true,trackingType:true,slug:true}});return NextResponse.json({exercises:data})}
