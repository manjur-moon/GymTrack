import {z} from "zod";
export const extractionSchema=z.object({groups:z.array(z.object({sourceName:z.string().min(1),exerciseId:z.string().nullable(),sets:z.number().int().min(1).max(12),reps:z.number().int().min(1).max(1000),weightKg:z.number().min(0).max(2000).nullable()})).min(1).max(10),issues:z.array(z.string())});
export const batchSchema=z.object({entries:z.array(z.object({exerciseId:z.string().min(1),setNumber:z.number().int().min(1).max(30),reps:z.number().int().min(1).max(1000),weightKg:z.number().min(0).max(2000).nullable()})).min(1).max(30)});
export type Extracted=z.infer<typeof extractionSchema>;
