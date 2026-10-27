import type { SetLog } from "@/generated/prisma/client";
export function serializeSet(s:SetLog){return {id:s.id,exerciseId:s.exerciseId,setNumber:s.setNumber,reps:s.reps??undefined,weightKg:s.weightKg?.toNumber(),durationSeconds:s.durationSeconds??undefined,distanceMeters:s.distanceMeters?.toNumber(),rpe:s.rpe?.toNumber(),isWarmup:s.isWarmup};}
