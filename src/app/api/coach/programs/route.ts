import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { currentUser } from "@/server/auth";
import { programSnapshotSchema, publishSchema } from "@/lib/programs";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (user.role !== "COACH" || user.isDemo) return NextResponse.json({error:"Coach access required"},{status:403});
  const input = publishSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({error:"Select a source plan."},{status:400});
  const source = await prisma.plan.findFirst({
    where: {id:input.data.planId,userId:user.id},
    include: {days:{orderBy:{dayNumber:"asc"},include:{exercises:{orderBy:{sortOrder:"asc"}}}}},
  });
  if (!source) return NextResponse.json({error:"Source plan not found."},{status:404});
  const raw = {
    name:source.name,description:source.description,goal:source.goal,
    days:source.days.map(day=>({dayNumber:day.dayNumber,name:day.name,
      exercises:day.exercises.map(e=>({
        exerciseId:e.exerciseId,sortOrder:e.sortOrder,targetSets:e.targetSets,
        targetRepsMin:e.targetRepsMin,targetRepsMax:e.targetRepsMax,
        targetWeightKg:e.targetWeightKg?.toNumber()??null,
        targetDurationSeconds:e.targetDurationSeconds,
        targetDistanceMeters:e.targetDistanceMeters?.toNumber()??null,
        restSeconds:e.restSeconds,
      }))
    })),
  };
  const parsed = programSnapshotSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message??"Invalid training plan."},{status:400});
  try {
    const result = await prisma.$transaction(async tx => {
      let template;
      if (input.data.templateId) {
        template = await tx.programTemplate.findFirst({where:{id:input.data.templateId,coachId:user.id,status:"ACTIVE"}});
        if (!template) return {kind:"missing" as const};
        await tx.$queryRaw`SELECT id FROM "ProgramTemplate" WHERE id=${template.id} FOR UPDATE`;
        const latest = await tx.programVersion.findFirst({where:{templateId:template.id},orderBy:{version:"desc"},select:{version:true}});
        const version = await tx.programVersion.create({data:{templateId:template.id,version:(latest?.version??0)+1,snapshot:parsed.data}});
        await tx.programTemplate.update({where:{id:template.id},data:{name:parsed.data.name,goal:parsed.data.goal}});
        return {kind:"ok" as const,templateId:template.id,versionId:version.id,version:version.version};
      }
      template = await tx.programTemplate.create({data:{coachId:user.id,name:parsed.data.name,goal:parsed.data.goal}});
      const version = await tx.programVersion.create({data:{templateId:template.id,version:1,snapshot:parsed.data}});
      return {kind:"ok" as const,templateId:template.id,versionId:version.id,version:version.version};
    });
    if(result.kind==="missing") return NextResponse.json({error:"Template not found."},{status:404});
    return NextResponse.json(result,{status:201});
  } catch {
    return NextResponse.json({error:"Could not publish program."},{status:500});
  }
}