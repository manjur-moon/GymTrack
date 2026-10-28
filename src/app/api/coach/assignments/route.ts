import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { assignmentSchema, buildSchedule, programSnapshotSchema } from "@/lib/programs";

export async function POST(req: Request) {
  const coach = await currentUser();
  if (!coach) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (coach.role!=="COACH" || coach.isDemo) return NextResponse.json({error:"Coach access required"},{status:403});
  const input = assignmentSchema.safeParse(await req.json().catch(()=>null));
  if (!input.success) return NextResponse.json({error:input.error.issues[0]?.message??"Invalid assignment"},{status:400});
  const v = input.data;
  try {
    const result = await prisma.$transaction(async tx => {
      // All operations touching this client's active plan serialize on the same user row.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${v.clientId} FOR UPDATE`;
      const link = await tx.coachClient.findFirst({where:{coachId:coach.id,clientId:v.clientId,status:"ACTIVE"}});
      if (!link) return {kind:"unauthorized" as const};
      const existing = await tx.programAssignment.findUnique({where:{coachId_idempotencyKey:{coachId:coach.id,idempotencyKey:v.idempotencyKey}}});
      if (existing) {
        const same = existing.clientId===v.clientId && existing.versionId===v.versionId &&
          existing.startDate.toISOString().slice(0,10)===v.startDate &&
          JSON.stringify([...existing.weekdays].sort((a,b)=>a-b))===JSON.stringify([...v.weekdays].sort((a,b)=>a-b));
        return same ? {kind:"duplicate" as const,id:existing.id} : {kind:"requestConflict" as const};
      }
      const running = await tx.workoutSession.count({where:{userId:v.clientId,status:"IN_PROGRESS"}});
      if (running) return {kind:"running" as const};
      const version = await tx.programVersion.findFirst({where:{id:v.versionId,template:{coachId:coach.id,status:"ACTIVE"}}});
      if (!version) return {kind:"missing" as const};
      const parsed = programSnapshotSchema.safeParse(version.snapshot);
      if (!parsed.success) return {kind:"invalid" as const};
      const snap = parsed.data;
      if (v.weekdays.length!==snap.days.length) return {kind:"weekdays" as const};
      const slots = buildSchedule(v.startDate,v.weekdays,snap.days.length);
      const end = new Date(`${v.startDate}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate()+27);

      // Preserve previous history while making the new assigned plan the only active one.
      const prior = await tx.programAssignment.findMany({where:{clientId:v.clientId,status:"ACTIVE"},select:{id:true}});
      if(prior.length){
        const priorIds=prior.map(x=>x.id);
        await tx.programAssignment.updateMany({where:{id:{in:priorIds}},data:{status:"REPLACED"}});
        await tx.scheduledWorkout.updateMany({where:{assignmentId:{in:priorIds},status:"PLANNED"},data:{status:"CANCELLED"}});
      }
      await tx.plan.updateMany({where:{userId:v.clientId,status:"ACTIVE"},data:{status:"ARCHIVED"}});
      const clientPlan = await tx.plan.create({data:{
        userId:v.clientId,name:snap.name,description:snap.description,goal:snap.goal,status:"ACTIVE",
        days:{create:snap.days.map(d=>({dayNumber:d.dayNumber,name:d.name,
          exercises:{create:d.exercises.map(e=>({...e}))}}))},
      },include:{days:{orderBy:{dayNumber:"asc"},select:{id:true}}}});
      const assignment=await tx.programAssignment.create({data:{
        coachId:coach.id,clientId:v.clientId,versionId:version.id,planId:clientPlan.id,
        startDate:new Date(`${v.startDate}T00:00:00.000Z`),endDate:end,
        weekdays:[...v.weekdays].sort((a,b)=>a-b),idempotencyKey:v.idempotencyKey,
      }});
      await tx.scheduledWorkout.createMany({data:slots.map(slot=>({
        assignmentId:assignment.id,planDayId:clientPlan.days[slot.dayIndex].id,
        scheduledFor:slot.scheduledFor,
      }))});
      return {kind:"created" as const,id:assignment.id,planId:clientPlan.id,sessions:slots.length};
    },{maxWait:10000,timeout:20000});
    if(result.kind==="duplicate") return NextResponse.json({id:result.id,duplicate:true},{status:200});
    if(result.kind==="created") return NextResponse.json(result,{status:201});
    const errors={requestConflict:["Idempotency key was reused for a different assignment",409],unauthorized:["Active client relationship required",403],running:["Client has a workout in progress",409],missing:["Published program version not found",404],invalid:["Program version is invalid",409],weekdays:["Select one weekday per program day",400]} as const;
    const [message,status]=errors[result.kind];
    return NextResponse.json({error:message},{status});
  } catch {
    return NextResponse.json({error:"Could not assign program."},{status:500});
  }
}