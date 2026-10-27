import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { z } from "zod";
const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma), session: { strategy: "jwt" }, pages: { signIn: "/login" },
  providers: [
    Credentials({ credentials: { email: {}, password: {}, demo: {} }, authorize: async (data) => {
      if (data.demo === "true") return prisma.user.findUnique({ where: { email: "demo@gymtrack.local" } });
      const input = z.object({ email: z.email(), password: z.string().min(1) }).safeParse(data);
      if (!input.success) return null;
      const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } });
      if (!user?.passwordHash || user.isDemo) return null;
      return await bcrypt.compare(input.data.password, user.passwordHash) ? user : null;
    } }),
    ...(googleEnabled ? [Google({ clientId: process.env.AUTH_GOOGLE_ID!, clientSecret: process.env.AUTH_GOOGLE_SECRET! })] : []),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) token.sub = user.id; return token; },
    async session({ session, token }) { if (session.user && token.sub) session.user.id = token.sub; return session; },
  },
});
