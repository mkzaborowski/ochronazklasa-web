<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ochrona z Klasą — project rules

Internal insurance-agency dashboard. **Read `PROJECT.md` first** — architecture,
locked decisions, roadmap.

## Stack
Next.js 16 (App Router, RSC) · TypeScript · Tailwind v4 + shadcn/ui (Base UI
variant) · Prisma 6 / PostgreSQL · Auth.js v5 · Google Drive (service account) ·
pdf-lib / docxtemplater / exceljs.

## Conventions
- UI text is **Polish**; code/comments in English.
- shadcn components here use Base UI's **`render={<El/>}` prop, NOT `asChild`**.
- Route guard is **`src/proxy.ts`** (Next 16 renamed `middleware` → `proxy`).
- Auth: edge-safe config in `@/auth.config`, full config (adapter/providers) in `@/auth`.
- Server actions live in `@/lib/actions/*`; validate with `@/lib/validations` (zod).
- Import the Prisma singleton from `@/lib/db` (never `new PrismaClient()`).
- Read env through `@/lib/env` (zod-validated).
- Google Drive calls go through `@/lib/google/drive` (Shared-Drive aware).
- Document helpers: `@/lib/documents/{pdf,docx,xlsx}.ts`.
- Mutating/sensitive actions must call `requireUser`/`requireRole` and write an `AuditLog` via `logAudit`.
- `@/*` → `src/*`.

## Commands
- `npm run dev` — UI runs without a DB; backend features need `.env`.
- `npm run build` — must stay green (type-check runs here).
- `npm run db:push` / `db:migrate` / `db:studio` — Prisma.

## Domain model note
Two distinct "school" concepts: **`School`** = the policyholder (Ubezpieczający)
created at issuance; **`SchoolRecord`** = the imported nationwide reference
directory (~28k rows, leads). `Agent` owns `SchoolRecord`s and `School`s. Don't
conflate them.

## Status
Phases 0–4 done. Auth guard in `proxy.ts`; dev-only `AUTH_DISABLED=true` bypasses
it for DB-less preview. InterRisk wizard at `/schools/new` (real templates in
`templates/policies/*.docx`, all 13 working). REGON→`SchoolRecord` / PESEL→`Client`
autofill (`lookupPolicyholder`). Agents at `/agents`, school directory at
`/directory` (server-paginated). Import dir: `npm run import:schools`. Flyer
generation scaffolded in `src/lib/flyers/*` (awaiting PDF templates). Ergo Hestia
issuance + Drive upload still to come.

## Commands (extra)
`npm run import:schools` (XLSX→SchoolRecord), `npm run seed-accounts`,
`npm run create-admin`, `npm run gen-templates`, `node scripts/build-real-templates.mjs`.
