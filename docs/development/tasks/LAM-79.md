# LAM-79: Record the Next.js App Router modernization decision

## Input contract

- **Requested outcome:** Create and publish an ADR that selects Next.js App Router with strict TypeScript, documents the migration constraints, and is linked from `SYSTEM_MAP.md`.
- **Acceptance criteria:** ADR records the App Router/strict-TypeScript decision; compares React plus Vite; documents the strangler strategy, initial module boundaries, deployment implications, compatibility, and rollback constraints; `SYSTEM_MAP.md` links to the ADR.
- **Allowed scope:** `docs/adr/**`; the required architecture-documentation link in `SYSTEM_MAP.md`; `docs/development/tasks/LAM-79.md`; `.agent-reports/LAM-79.json`.
- **Constraints/invariants:** Documentation-only change; do not modify application, test, database, persistence, `apps/web/**`, `tests/legacy/**`, or `allotment_v2/allotment_v2.html`; do not replace a production module or change persistence behavior; publish a PR targeting `main` without merging or transitioning Jira.
- **Base branch:** `origin/main` at `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`.
- **Starting assumptions:** The isolated worktree was clean before branch creation. The legacy application remains the compatibility baseline; LAM-76 may introduce the referenced shell later.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Modernization architecture | No root-level ADR captured the framework choice or incremental migration guardrails. | ADR 001 records an additive Next.js App Router and strict-TypeScript shell, with compatibility and rollback constraints. |
| Architecture map | `SYSTEM_MAP.md` described the legacy system only. | Its reader guide links directly to ADR 001 and identifies the map as the legacy compatibility reference. |

### Interfaces and contracts

- **Added:** Documentation contract for the future `apps/web` App Router shell, typed legacy adapters, vertical feature boundaries, deployment configuration, and rollback gates.
- **Changed:** `SYSTEM_MAP.md` now links the architecture decision without changing any application interface.
- **Removed:** None.
- **Compatibility notes:** The ADR explicitly keeps `allotment_v2/allotment_v2.html` and its persistence contracts authoritative until each vertical slice has characterization evidence and an approved migration.

### Files changed

| Path | Change | Purpose | Owned by this task? |
|---|---|---|---|
| `docs/adr/001-nextjs-app-router.md` | Added | Decision record for framework, migration, deployment, compatibility, and rollback constraints. | Yes |
| `SYSTEM_MAP.md` | Modified | Required architecture-documentation link to ADR 001. | Yes |
| `docs/development/tasks/LAM-79.md` | Added | Human-readable input/output and publication handoff. | Yes |
| `.agent-reports/LAM-79.json` | Added | Machine-readable coordinator handoff. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None. The ADR requires routing/feature-flag rollback for the initial shell and an explicit backward-compatible data plan before any future writing slice is enabled.

## Verification evidence

| Command/check | Result |
|---|---|
| `git status --short --branch` before branch creation | Passed — isolated worktree was clean on its runtime-snapshot branch. |
| `git rev-parse --verify origin/main && git merge-base origin/main HEAD` after creating `LAM-79-nextjs-app-router-adr` | Passed — both resolved to `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`. |
| `node -e "const fs=require('fs'); const p='docs/adr/001-nextjs-app-router.md'; const text=fs.readFileSync(p,'utf8'); const required=['Next.js with the App Router and strict TypeScript','React plus Vite','Strangler migration strategy','Initial module boundaries','Deployment implications','Compatibility constraints','Rollback constraints and procedure']; const missing=required.filter(x=>!text.includes(x)); if(missing.length) throw new Error('Missing: '+missing.join(', ')); console.log('ADR requirements: '+required.length+'/'+required.length+' present');"` | Passed — `ADR requirements: 7/7 present`. |
| `node -e "const fs=require('fs'); const map=fs.readFileSync('SYSTEM_MAP.md','utf8'); const href='docs/adr/001-nextjs-app-router.md'; if(!map.includes(href)) throw new Error('Missing SYSTEM_MAP link'); if(!fs.existsSync(href)) throw new Error('Broken ADR target'); console.log('SYSTEM_MAP ADR link: valid');"` | Passed — `SYSTEM_MAP ADR link: valid`. |
| `git diff --check` | Passed — no whitespace errors. |
| `node C:/Users/ta-za/.pi/agent/git/github.com/TheTaTha5/my-own-skills/skills/agent-change-pr/scripts/change-report.mjs --validate .agent-reports/LAM-79.json --report docs/development/tasks/LAM-79.md` | Passed — `valid: LAM-79`. |

## Decisions, risks, and rollback

- **Decisions:** Next.js App Router plus strict TypeScript is the selected additive shell. React plus Vite was considered but rejected because it would require separate routing, server/API, health, environment, and deployment conventions. The migration is strangler-style and vertical-slice based.
- **Known risks:** Next.js adds a Node runtime and operational complexity; typed adapters can still encode legacy assumptions if a slice is not characterized first; routing rollback cannot undo incompatible future writes.
- **Blockers:** None.
- **Dependencies:** LAM-76 implements the shell referenced by the ADR. LAM-77 provides legacy characterization evidence required before extracting or enabling migrated workflow writes.
- **Follow-up work:** Implement the shell as an additive route/service, establish feature flags, and create per-slice migration and data-rollback plans before enabling writes.
- **Rollback procedure:** For the initial shell, disable its distinct route or feature flag and continue serving the unmodified legacy application. Do not couple the initial shell to destructive data changes. Future writing slices require an approved data rollback plan before rollout.

## Agent handoff

- **Task:** LAM-79
- **Branch:** `LAM-79-nextjs-app-router-adr`
- **Worktree:** `C:/Users/ta-za/.pi/workflows/projects/wt-coordinator-6d3a93079ab9/sessions/01a01848-e03b-7eaf-b0b1-c703097d7229/runs/203096be-3173-4143-858b-c601e9ce8a3b/worktrees/395ca071fce37b5c`
- **Initial implementation commit:** Pending; recorded after the focused implementation commit in the publication metadata update.
- **Jira:** LAM-79 (no transition performed).
- **PR:** Pending publication; the final number, URL, base, and head are recorded in the publication metadata update.
- **Manifest:** `.agent-reports/LAM-79.json`
- **Unrelated changes left untouched:** None.
