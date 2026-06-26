import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 "proxy" convention (formerly "middleware"). Guards every matched
// route via the Auth.js `authorized` callback defined in auth.config.ts.
export const proxy = NextAuth(authConfig).auth;

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
