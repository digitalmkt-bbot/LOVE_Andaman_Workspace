# Migrations

Forward-only, checksummed, applied in filename order.

```
pnpm --filter @la/db migrate status   # what is applied, pending, or drifted
pnpm --filter @la/db migrate up       # apply everything pending
pnpm --filter @la/db migrate new add-booking-table
```

`DATABASE_URL` is read from the environment and never printed.

## Rules

1. **Filenames are `NNNN_kebab-name.sql`.** Anything else is rejected outright,
   so ordering can never depend on how a filesystem happens to sort.
2. **An applied migration is history.** The runner stores a sha256 of each file
   and refuses to continue if one changed, or if an applied file was deleted.
   Correct a mistake by writing the next migration, never by editing an old one.
3. **There is no `down`.** Production history must replay from empty. A revert
   is a new forward migration.
4. Each migration runs in its own transaction and rolls back on failure, so a
   half-applied migration is not a state you can end up in.

Checksums are taken over content with line endings normalised, so a Windows
checkout and Linux CI agree.

## The baseline

`migrate baseline` applies the P0-01 schema dumps in `db/baseline/` at the repo
root — 4 schemas, 184 tables, captured from production on 2026-08-20. It is how
CI gets from an empty Postgres to something migrations can run against. It
refuses to run unless `ALLOW_BASELINE=1` and `NODE_ENV` is not `production`.
