import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton — avoids exhausting DB connections during dev
 * hot-reload. Import `db` everywhere instead of `new PrismaClient()`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
