import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config. Contains NO database/bcrypt/provider code so it can
 * run in middleware (Edge runtime). The full config (adapter + providers) lives
 * in `auth.ts`. Sessions are JWT, so middleware can authorize from the token
 * without touching the database.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real providers are added in auth.ts
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      // Dev-only escape hatch so the UI can be previewed without a DB/login.
      // Never honoured in production.
      if (
        process.env.AUTH_DISABLED === "true" &&
        process.env.NODE_ENV !== "production"
      ) {
        return true;
      }

      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true; // allow access to the login page
      }

      return isLoggedIn; // protected: false -> redirect to signIn page
    },
  },
} satisfies NextAuthConfig;
