import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
const globalStore = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalStore.prisma ?? new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
if (process.env.NODE_ENV !== "production") globalStore.prisma = prisma;
