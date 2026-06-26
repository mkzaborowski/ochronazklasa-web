import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";

/**
 * Full Auth.js (NextAuth v5) config — runs in the Node runtime.
 * Two sign-in options for staff:
 *   1. Google Workspace SSO (optionally restricted to AUTH_ALLOWED_DOMAIN)
 *   2. Email + password (passwordHash on the User record)
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn: async ({ account, profile }) => {
      // Restrict Google SSO to the company domain, if one is configured.
      const allowed = process.env.AUTH_ALLOWED_DOMAIN;
      if (account?.provider === "google" && allowed) {
        const email = profile?.email ?? "";
        return email.endsWith(`@${allowed}`);
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) token.role = user.role ?? "AGENT";
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as Role | undefined;
      }
      return session;
    },
  },
});
