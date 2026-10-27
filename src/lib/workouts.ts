import {z} from "zod";
export const logSetSchema=z.object({exerciseId:z.string().min(1),setNumber:z.number().int().min(1).max(30),reps:z.number().int().min(1).max(1000).optional(),weightKg:z.number().min(0).max(2000).optional(),durationSeconds:z.number().int().min(1).max(36000).optional(),distanceMeters:z.number().positive().max(100000).optional(),rpe:z.number().min(1).max(10).optional(),isWarmup:z.boolean().default(false)});
export type LoggedSet={id:string;exerciseId:string;setNumber:number;reps?:number;weightKg?:number;durationSeconds?:number;distanceMeters?:number;rpe?:number;isWarmup:boolean};
export const round=(n:number)=>Math.round(n*100)/100;
