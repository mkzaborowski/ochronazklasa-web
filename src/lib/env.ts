import { z } from "zod";

/**
 * Centralised, validated environment access.
 *
 * Most vars are optional at this stage so the UI shell runs without a fully
 * configured backend. Tighten these to `.min(1)` once each feature is wired up.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().optional(),

  AUTH_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_ALLOWED_DOMAIN: z.string().optional(),

  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  GOOGLE_DRIVE_SHARED_DRIVE_ID: z.string().optional(),
  GOOGLE_DRIVE_ROOT_FOLDER_ID: z.string().optional(),
});

export const env = schema.parse(process.env);

export type Env = z.infer<typeof schema>;
