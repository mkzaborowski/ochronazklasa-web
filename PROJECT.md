# Ochrona z Klasą — Panel (internal dashboard)

Internal web dashboard for an insurance agency: issue policies (Ergo Hestia,
InterRisk), and store / sort / manage existing policies as files on Google
Drive. This document is the single source of truth for architecture and the
build roadmap.

---

## 1. Decisions (locked)

| Area | Decision | Why |
|------|----------|-----|
| Users | **Internal staff only** | Simplest + most secure; client portal can be added later |
| Hosting | **Hetzner Cloud VPS (EU), self-managed** | Full control, cheapest, EU data residency. Deploy guide: `DEPLOY.md` |
| Database | **Self-hosted PostgreSQL on the VPS (localhost-only)** | No managed DB; runs next to the app, not exposed to the internet |
| Runtime | **`next start` via systemd + Caddy reverse proxy (auto-HTTPS)** | Simple to operate; templates read from disk (no bundling concerns) |
| File storage | **In Postgres for now; Google Drive deferred** | No Google Workspace → Shared Drives unavailable; generated DOCX already stored in DB and downloadable |
| Sign-in | **Email + password (primary)**; Google OAuth optional via test-user allowlist | No Workspace → no domain-restricted SSO; password login is the baseline |

## 2. Tech stack

- **Next.js 16** (App Router, React 19, TypeScript, Turbopack)
- **Tailwind CSS v4 + shadcn/ui** (Base UI variant) — the slick, professional UI
- **PostgreSQL + Prisma 6** — searchable index, users, audit log
- **Auth.js v5 (NextAuth)** — Google SSO + credentials, JWT sessions
- **googleapis** — Drive access via service account (Shared Drive)
- **Document engine**: `pdf-lib` (PDF), `docxtemplater` + `pizzip` (DOCX), `exceljs` (XLSX)
- **zod** — input validation · **bcryptjs** — password hashing

> Note: Next is the *newest*. Prisma is intentionally pinned to **6.x** (stable);
> Prisma 7 removed schema-based datasource URLs in favour of mandatory driver
> adapters — unnecessary complexity for this foundation. Revisit later if desired.

## 3. Cost (target: ≤ 1000 PLN/month — aiming far lower)

| Item | Est. monthly |
|------|--------------|
| Hetzner CX22 VPS (2 vCPU, 4 GB, EU) | ~€4–5 |
| Postgres (self-hosted on the same VPS) | €0 |
| Hetzner automated VM backups (~20% of server) | ~€1 |
| Domain | ~€1 (amortised) |
| Google Workspace | not used (no Workspace) |
| **Total** | **≈ €6–8 / month (~25–35 PLN)** |

Self-hosted on one Hetzner VPS (EU region for RODO). Google Drive is deferred; if
added later it needs Workspace (Shared Drives) or a dedicated-Gmail OAuth flow.
Full deployment walkthrough: `DEPLOY.md`.

## 4. Directory structure

```
src/
  app/
    (dashboard)/            # authenticated app shell (sidebar layout)
      layout.tsx
      page.tsx              # overview / pulpit
      policies/            # list + /new (issue wizard)
      clients/
      documents/           # Google Drive browser
      settings/
    api/auth/[...nextauth]/ # Auth.js route handler
    layout.tsx             # root (fonts, Toaster, <html lang="pl">)
  auth.ts                  # Auth.js config (Google + credentials)
  components/
    ui/                    # shadcn/ui primitives
    app-sidebar.tsx
    page-placeholder.tsx
  lib/
    db.ts                  # Prisma singleton
    env.ts                 # validated env (zod)
    constants.ts           # insurers, product types, status labels
    google/drive.ts        # Shared Drive service (upload/download/list/folders)
    documents/
      pdf.ts               # fillPdfForm / listPdfFields
      docx.ts              # renderDocx (template → filled doc)
      xlsx.ts              # readRows / appendRows (registry)
  types/next-auth.d.ts
prisma/schema.prisma       # data model
```

## 5. Data model (see `prisma/schema.prisma`)

- **User** (+ Account/Session/VerificationToken for Auth.js) — `role`: ADMIN | AGENT | VIEWER
- **Client** — individual (PESEL) or company (NIP/REGON), contact + address
- **Policy** — insurer, product, status, dates, premium, **Drive file/folder IDs**
- **PolicyDocument** — extra files per policy (proposal, invoice, attachments)
- **AuditLog** — who/what/when (RODO accountability + security forensics)

The DB never stores the policy file itself — only its metadata and Drive ID.

## 6. Google Drive design

- One **company Shared Drive** holds everything; a **service account** is granted
  Content-manager access. Files are org-owned and survive staff changes.
- Suggested folder layout (auto-created via `ensureFolder`):
  `/<Insurer>/<Year>/<ClientName-PolicyNumber>/...`
- All API calls pass `supportsAllDrives` / `includeItemsFromAllDrives`
  (already wired in `lib/google/drive.ts`).

## 7. Document engine (policy-issuance prep)

The complex issuance flow you'll specify later will compose these building blocks:

1. **Load template** for the chosen insurer/product (PDF AcroForm or DOCX with `{placeholders}`).
2. **Fill** it: `fillPdfForm()` for fillable PDFs, `renderDocx()` for Word templates.
3. **Update registry**: `appendRows()` adds the new policy to the company XLSX register;
   `readRows()` fetches/looks up data from the big reference lists.
4. **Store**: `uploadFile()` puts the finished file in the right Drive folder.
5. **Record**: create a `Policy` row + `AuditLog` entry.

### Open questions for the issuance flow (need your input later)
- What template format does each insurer use — fillable PDF, Word, or a portal export?
- Exact field mapping per insurer (we can extract field names with `listPdfFields`).
- Structure of the "big data lists" (XLSX columns, lookup keys).
- Numbering scheme for policy numbers (assigned by us or by the insurer?).
- Any insurer API/portal, or is this purely document generation?

## 8. Security & RODO/GDPR checklist

- [x] EU-only hosting (Hetzner DE) — data residency
- [x] Audit log of sensitive actions (`lib/audit.ts`, written by all mutations)
- [x] Auth guard on all `(dashboard)` routes (Next 16 `proxy.ts` + Auth.js)
      — dev-only `AUTH_DISABLED=true` bypass for previewing without a DB
- [x] RBAC helpers (`requireUser` / `requireRole`) — apply `requireRole` per action as policies are added
- [ ] Role-based access control enforced on every sensitive action
- [ ] HTTPS everywhere (reverse proxy: Caddy/Nginx + Let's Encrypt)
- [ ] Encrypt DB backups; restrict DB to localhost / private network
- [ ] Secrets in env / secret manager, never in git (`.env` is git-ignored)
- [ ] Rate-limit + lockout on the password login
- [ ] Data Processing Agreement with Google (Workspace) + EU data region
- [ ] Consider encrypting PESEL at rest; minimise what's stored
- [ ] Retention policy for expired policies & personal data

## 9. Roadmap

**Phase 0 — Foundation (DONE):** Next.js + UI shell + data model + service
interfaces + auth scaffolding + build green.

**Phase 1 — Auth & access control (DONE):** login page (Google SSO + password),
`proxy.ts` route guard, RBAC helpers, `create-admin` script, sign-out, audit log.

**Phase 2 — Clients & policies storage (DONE):** create/list/search/filter/delete
for clients and policies, with validation + audit. *(Your "manage & sort policies" goal.)*

**Phase 3 — Drive integration (PARTIAL):** Shared-Drive service + folder browser
done (`/documents`); folder automation + upload/preview wiring lands with issuance.

**Phase 4 — Policy issuance:** InterRisk DOCX flow **DONE** (see §11). Ergo Hestia
still to come once its templates/process are specified.

**Phase 5 — Deploy:** Hetzner VPS, Postgres, Caddy/HTTPS, backups, CI.

## 11. InterRisk issuance flow (Phase 4)

5-step wizard at **`/schools/new`** → creates a `School`, generates one DOCX per
selected variant, assigns an unused bank account per policy, derives the policy
number, stores the file, and redirects to the school profile.

- **Variants & templates:** `src/lib/interrisk/variants.ts` maps each variant code
  to `templates/policies/<CODE>.docx`. Templates use `{{placeholders}}`; only the
  dynamic fields are injected (pricing/terms/sums stay as in the template).
  Current template files are **auto-generated samples** — replace with the real
  InterRisk docs (`templates/policies/README.md`).
- **Placeholders:** `ubezpieczajacy_*`, `kontakt_*`, `okres_ubezpieczenia`,
  `numer_polisy` (= last 6 digits of the bank account), `numer_konta_bankowego`.
- **Bank accounts:** `BankAccount` pool, one per policy, claimed atomically inside
  a DB transaction (no double-allocation). Seed via `npm run seed-accounts -- data/bank-accounts.csv`.
- **Storage:** generated DOCX stored as bytes in `GeneratedPolicy.fileData`
  (download via `/api/policies/[id]/download`; "edit" = re-upload a revised DOCX).
  Swap to Google Drive later by writing to Drive and keeping the file id.
- **Models:** `School`, `BankAccount`, `GeneratedPolicy` (separate from the generic
  `Client`/`Policy` scaffolding).
- **Future:** search/auto-fill school by REGON (the `School.regonPesel` index is ready).

## 10. Local development

```bash
cp .env.example .env        # then fill DATABASE_URL, AUTH_SECRET (npx auth secret)
npm run db:push             # create tables (needs a running Postgres)
npm run dev                 # http://localhost:3000
```

The UI shell runs without a database; backend features need `.env` configured.
