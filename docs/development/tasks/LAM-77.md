# LAM-77: Characterize critical legacy booking workflows

## Input contract

- **Requested outcome:** Add repeatable, source-backed characterization tests for legacy booking behavior before modular extraction, then publish a pull request without merging or transitioning Jira.
- **Acceptance criteria:**
  - Tests document booking persistence, edit-preserve fields, cancelled-status aggregates, seat locks, boat assignment, and rate-type pricing.
  - Tests are repeatable and identify intentional exceptions.
  - No production behavior or persistence schema is changed.
- **Allowed scope:** `tests/legacy/**`, `docs/development/tasks/LAM-77.md`, and `.agent-reports/LAM-77.json`.
- **Constraints/invariants:** Do not edit the monolithic HTML, application/configuration files, persistence code, `apps/web/**`, ADRs, or `SYSTEM_MAP.md`. Keep tests isolated from the application runtime and run them with Node's built-in test runner.
- **Base branch:** `origin/main` at `17a15c46429b126d6e2eda9f2ebcd6b26cb31351`.
- **Starting assumptions:** The legacy application is a single static HTML file with no existing root unit-test runner. Tests must evaluate selected production functions only, with test-owned globals, rather than booting the UI.

## Output contract

### Observable behavior

| Area | Before | After |
|---|---|---|
| Legacy critical-workflow coverage | Behavior existed only in the monolith and informal documentation. | Eight repeatable Node tests characterize the selected source functions and edit-preserve contract. |
| Intentional exceptions | Exceptions were embedded in implementation comments. | Five extraction-sensitive exceptions are recorded in a test fixture next to executable tests. |

### Interfaces and contracts

- **Added:** `node --test tests/legacy/legacy-characterization.test.mjs` as an isolated characterization-test command.
- **Changed:** None; production interfaces and behavior are unchanged.
- **Removed:** None.
- **Compatibility notes:** Tests read `allotment_v2/allotment_v2.html` without modifying or executing the application shell. They execute only extracted target functions in a VM with test-owned collaborators.

### Files changed

| Path | Purpose | Owned by this task? |
|---|---|---|
| `tests/legacy/helpers/legacy-source.mjs` | Safely extracts named legacy functions and evaluates them in an isolated VM context. | Yes |
| `tests/legacy/legacy-characterization.test.mjs` | Characterizes persistence, cancellation aggregates, locks, boat assignment, pricing, and edit-preserve behavior. | Yes |
| `tests/legacy/fixtures/intentional-exceptions.json` | Documents intentional behavior that a future extraction must not silently change. | Yes |
| `docs/development/tasks/LAM-77.md` | Durable task input/output record and PR body. | Yes |
| `.agent-reports/LAM-77.json` | Coordinator-readable task manifest. | Yes |

### Data and persistence impact

- **Database/schema:** None.
- **API or mapper:** None.
- **Migration required:** No.
- **Rollback effect on data:** None; the change contains tests and documentation only.

## Verification evidence

| Command/check | Result |
|---|---|
| `node --test tests/legacy/legacy-characterization.test.mjs` | Passed: 8 tests passed, 0 failed. |
| `git diff --check` | Passed: no whitespace errors. |

## Decisions, coordination, and rollback

- **Decisions:** Tests extract specific production function declarations instead of evaluating the entire HTML script, avoiding UI startup, localStorage mutation outside test-owned storage, network access, and production changes. The duplicate top-level `save` declaration is selected explicitly by occurrence so the persistence characterization targets the localStorage read-modify-write function rather than the cloud-sync helper.
- **Known risks:** Source-extraction tests intentionally bind to function names and selected source shape. A future rename or a substantial conversion away from function declarations will fail tests and require the characterization harness to move with the extracted module.
- **Blockers:** None.
- **Dependencies:** Node.js 18+ (repository engine requirement) and the checked-out legacy HTML source. No package installation or root configuration change is needed.
- **Follow-up work:** During modular extraction, move these cases to module-level tests while retaining the fixture exceptions until a separately approved behavior change supersedes them.
- **Rollback procedure:** Revert the LAM-77 commit. No persisted data, schema, API, or production bundle behavior is affected.

## Agent handoff

- **Branch:** `task/LAM-77`
- **Commit:** `ad63bb00a81441c8e3c5b15afb04cd73c70bc645` (implementation); PR metadata follows in an artifact-only commit.
- **Worktree:** `C:/Users/ta-za/.pi/workflows/projects/wt-coordinator-6d3a93079ab9/sessions/01a01848-e03b-7eaf-b0b1-c703097d7229/runs/203096be-3173-4143-858b-c601e9ce8a3b/worktrees/f68526b059ab576c`
- **Jira:** LAM-77 (do not transition).
- **PR:** #2 · https://github.com/digitalmkt-bbot/LOVE_Andaman_Workspace/pull/2 (open; base `main`, head `task/LAM-77`).
- **Manifest:** `.agent-reports/LAM-77.json`
- **Unrelated changes left untouched:** None.
