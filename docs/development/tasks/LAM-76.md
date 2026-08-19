# LAM-76: Create the Next.js and TypeScript application shell

## Input contract

- **Requested outcome:** Create and publish an isolated Next.js App Router shell for the modernization work.
- **Acceptance criteria:** The shell runs locally and in CI; uses strict TypeScript and App Router; has navigation, environment configuration, linting, unit-test setup, and a health page; it does not replace production modules or change persistence behavior.
- **Allowed scope:** `apps/web/**`, `docs/development/tasks/LAM-76.md`, and `.agent-reports/LAM-76.json` only.
- **Constraints/invariants:** Do not modify `allotment_v2/allotment_v2.html`, existing API behavior, SQL, persistence mappings, root/shared configuration, or `SYSTEM_MAP.md`. Do not transition Jira or merge the PR.
- **Base branch:** `origin/main` (`17a15c46429b126d6e2eda9f2ebcd6b26cb31351`)
- **Starting assumptions:** The repository had no `apps/web` shell or CI workflow owned by this task. The root Node application remains the production deployment.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Modernized web entry point | No isolated Next.js application existed. | `apps/web` is a standalone Next.js 16 App Router application with strict TypeScript. |
| Shell navigation | No shell navigation existed. | The shared header links to `/` and `/health`. |
| Health check | No Next.js health page existed. | Static `/health` renders `Healthy`, the application label, and public environment label. |
| Local and CI execution | No shell-specific commands existed. | Locked dependencies and `dev`, `build`, `start`, `typecheck`, `lint`, and `test` scripts are documented in `apps/web/README.md`. |
| Legacy production behavior | Existing production app serves the legacy module. | Unchanged; the new shell has no imports of legacy modules and no persistence, API, or database access. |

### Interfaces and contracts

- **Added:** Next routes `/` and `/health`; public display variables `NEXT_PUBLIC_APP_NAME` and `NEXT_PUBLIC_APP_ENV`; package scripts defined in `apps/web/package.json`.
- **Changed:** None in existing production interfaces.
- **Removed:** None.
- **Compatibility notes:** The shell requires Node.js 20.9+ (Next.js 16 requirement). Public environment values have safe local defaults and must not contain secrets.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `apps/web/.env.example` | Documents public shell display configuration. | Yes |
| `apps/web/.gitignore` | Excludes generated shell artifacts and local environment files. | Yes |
| `apps/web/README.md` | Documents local execution and CI validation commands. | Yes |
| `apps/web/eslint.config.mjs` | Configures Next core-web-vitals lint rules. | Yes |
| `apps/web/next-env.d.ts` | Next.js generated TypeScript declarations. | Yes |
| `apps/web/next.config.ts` | Enables React strict mode and isolates tracing to the shell. | Yes |
| `apps/web/package.json` | Declares locked shell commands and dependencies. | Yes |
| `apps/web/package-lock.json` | Locks shell dependencies for repeatable local and CI installs. | Yes |
| `apps/web/tsconfig.json` | Enables strict TypeScript for App Router sources. | Yes |
| `apps/web/vitest.config.ts` | Configures jsdom unit-test execution. | Yes |
| `apps/web/src/app/*` | Provides App Router layout, home, health page, and styling. | Yes |
| `apps/web/src/components/site-navigation.tsx` | Renders shared shell navigation. | Yes |
| `apps/web/src/lib/*` | Provides navigation and environment helpers plus a unit test. | Yes |
| `apps/web/src/test/setup.ts` | Registers test assertions. | Yes |
| `docs/development/tasks/LAM-76.md` | Task development record. | Yes |
| `.agent-reports/LAM-76.json` | Coordinator-readable task manifest. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None. The shell has no write paths and does not load legacy application state.

## Verification evidence

| Command/check | Result |
|---|---|
| `cd apps/web && npm ci` | Passed; installed the lockfile successfully. |
| `cd apps/web && npm run typecheck` | Passed. |
| `cd apps/web && npm run lint` | Passed. |
| `cd apps/web && npm test` | Passed: 1 test in 1 file. |
| `cd apps/web && npm run build` | Passed; static `/` and `/health` routes were generated. |
| `cd apps/web && npm audit --audit-level=high` | Passed; found 0 vulnerabilities. |
| `cd apps/web && ./node_modules/.bin/next start -p 3101` with `curl http://127.0.0.1:3101/health` | Passed; response contained `<h1 id="health-title">Healthy</h1>`. |

## Decisions, coordination, and rollback

- **Decisions:** Kept the shell completely self-contained under `apps/web`; used App Router server components, static health content, Next core-web-vitals linting, and Vitest/jsdom; pinned current audited dependency versions for repeatability.
- **Known risks:** This shell is intentionally not connected to legacy auth, APIs, persistence, or deployment. Future strangler slices need explicit integration contracts and ownership before they can be added.
- **Blockers:** None.
- **Dependencies:** A Node.js 20.9+ runtime is required by Next.js 16. Existing CI must invoke the documented commands from `apps/web`; changing root CI configuration is outside this task's ownership.
- **Follow-up work:** Add a separately owned CI workflow invocation, then migrate modules through explicit adapters without importing persistence logic directly into the shell.
- **Rollback procedure:** Revert the LAM-76 commits or delete the unreferenced `apps/web` directory. No data migration, persistence rollback, or legacy deployment change is required.

## Agent handoff

- **Task:** LAM-76
- **Branch:** `lam-76-nextjs-shell`
- **Worktree:** `C:/Users/ta-za/.pi/workflows/projects/wt-coordinator-6d3a93079ab9/sessions/01a01848-e03b-7eaf-b0b1-c703097d7229/runs/203096be-3173-4143-858b-c601e9ce8a3b/worktrees/6bdf1e7a29d9b824`
- **HEAD at scaffold:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **Merge base:** `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`
- **Commit:** Pending initial implementation commit; PR metadata will be recorded in a follow-up documentation commit.
- **PR:** Pending publication to `main`.
- **Manifest:** `.agent-reports/LAM-76.json`
- **Unrelated changes left untouched:** None.
