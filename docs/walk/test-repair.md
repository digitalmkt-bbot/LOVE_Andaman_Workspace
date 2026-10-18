# Test repair (branch fix/unit-tests-flakes)

## Unit tests: `node --test test/unit/ops-*.test.mjs`
Before: 84 failing of 579. After: 0 failing of 579.

Fixes (tests only):
- 8 files: stub `laOps` lacked `onWrite` / `onChange` (agent-programs-bulk, agent-resync-contract, contracts, fleet-daily, pier-job, rate-seasons, rate-type-bulk-assign); pier-office also lacked `today`. Added no-ops (`today` returns the test date).
- ops-park: the adapter now also reads `GET /v1/pier-office/{pier}/days/{date}/boats`; the stub answers it without counting it as a call.
- ops-contracts: removed the stale assertion that artifact reopen is "blocked"; it now asserts reopen is wired (`window.ctArtifactReopen`).
- ops-pier-job: the job projection now carries `dep` (departure time); expectation updated.
- ops-pier-office: licences now carry `srv` (server state); booking lines no longer send `adults` (server's heads; only extra lines do); the vm context needed the global `SB_BOOKINGS`.

## Browser walks (one at a time)
Seeds now send `guides: { english: true }` and `leadNationality` (t_walk_fleet x2, t_walk_agents, t_ops; locks, dayops, booking, daymisc already had them; t_walk_pier uses `b2c_` ids, exempt).
- t_ops: pass. t_walk_locks: pass. t_walk_booking: pass. t_walk_agents: pass. t_walk_pier: pass. t_walk_fleet: pass (11 items).
- t_walk_dayops: items 1-3 pass; item 4 has 2 FAILs (second machine sees the moved-away strand row; cancelled-but-arranged row with clear button), then the script times out waiting for that button. This is the known red item 4 (app code, fixed elsewhere); items after 4 were not reached.

## t_assetver
Fails on stale `?v=` hashes (LF hash vs CRLF checkout). Not rehashed.

## Possible real app bugs
None found in the unit tests (all failures were test drift). Only the dayops item 4 above.
