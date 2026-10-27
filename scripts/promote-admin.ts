import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!email) throw new Error("Set ADMIN_EMAIL to an existing registered email before running this local-only script.");
const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL!})});
try {
 const existing = await db.user.findUnique({where:{email}});
 if (!existing || existing.isDemo) throw new Error("An existing non-demo account is required");
 await db.user.update({where:{id:existing.id},data:{role:"ADMIN"}});
 console.log("Promoted existing account to ADMIN:",email);
} finally {await db.$disconnect()}
