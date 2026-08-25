# platform — the new stack

Fastify API + React ops app that replaces `allotment_v2.html` by strangler migration.
Plan of record: `allotment_v2/docs/rewrite/README.md`. Task specs: `.../TASKS.md`.

## Why this is nested under `platform/` and not at the repo root

The repo root `package.json` and `railway.json` belong to the **monolith**: Railway builds from the
root with Nixpacks and runs `npm start` → `node server.js`. Converting the root into a pnpm
workspace would change how the monolith builds — and keeping the monolith running is task `P0-00`,
because the strangler needs something to strangle.

So the new stack lives in its own workspace root here. Nothing at the repo root is touched.
When the monolith is retired (Phase 8) this can be promoted with `git mv`.

## Layout

```
platform/
├── apps/
│   ├── api/        Fastify — the ONLY thing that opens a database connection
│   └── ops-web/    Vite + React SPA — staff app, talks to the API over HTTP only
└── packages/
    ├── contracts/  zod schemas + inferred types. Shared by api, ops-web, and
    │               (published) by Loveandaman-Kingdom for B2C + ERP
    ├── db/         Postgres pool + schema constants
    └── pricing/    pure price calculation, no DB access (filled by BK-09)
```

`packages/contracts` is the reason api and ops-web share a repo: change a shape there and both
sides fail to compile immediately, in one commit. It must never import from `apps/*` — it is the
bottom of the dependency graph so it stays independently publishable.

## Commands

```bash
pnpm install          # pnpm 11, Node 22+
pnpm dev              # builds packages, then api on :3001 and web on :5173
pnpm check            # typecheck + lint + test  (what CI runs)
pnpm build            # everything, topologically
```

`typecheck` and `dev` build `packages/*` first — `apps/*` resolve them through their built `dist/`.

## Status

Scaffold only (`P0-02` / LAM-88). The API serves `/healthz` and `/readyz` and returns the shared
error envelope; there are no domain routes yet. Booking work starts at `BK-01`.
