# Disaster Recovery

Backup, restore, and migration-integrity strategy for the two Postgres
databases in this repo:

- **Marketplace DB** (`server/`) — orders, disputes, referrals, reviews, etc.
- **Production/campaign DB** (`agro-production/server/`) — campaigns,
  investments, disputes, conversations, etc.

Both hold the only off-chain record of context for on-chain transactions
(dispute evidence, order/campaign metadata, referral attribution), so
losing either without a working restore path means that context is gone
for good, even though the underlying chain state is untouched.

## RPO / RTO targets

| Database | RPO (max acceptable data loss) | RTO (max acceptable downtime) |
|---|---|---|
| Marketplace DB | 24 hours | 4 hours |
| Production/campaign DB | 24 hours | 4 hours |

Rationale: neither database is the source of truth for fund custody (that's
the Soroban contracts) — they hold off-chain metadata, dispute evidence,
and indexed event history. A 24h RPO is achievable with a daily backup
cadence without needing continuous WAL archiving; tighten this (e.g. to
hourly / point-in-time recovery) if either database starts holding data
that can't be reconstructed from on-chain events plus a daily snapshot.

## Backup strategy

Daily logical backups via `pg_dump --format=custom`, taken independently
per database, with a 30-day retention window.

- `pg_dump -Fc` produces a compressed, restorable-with-`pg_restore` backup
  that includes schema and data — no separate schema backup needed.
- If/when a managed Postgres provider is chosen for hosting (see the
  open deployment-pipeline work), prefer that provider's built-in
  point-in-time-recovery/snapshot feature as the primary backup mechanism
  — it typically gives a tighter RPO than daily dumps for free. The script
  here is the provider-agnostic fallback and is what CI/local restore
  drills use to prove the procedure works end-to-end.

### Running a backup

```bash
DATABASE_URL="$MARKETPLACE_DATABASE_URL" \
  ./scripts/db-backup.sh marketplace

DATABASE_URL="$PRODUCTION_DATABASE_URL" \
  ./scripts/db-backup.sh production
```

Writes to `backups/<label>/<label>_<UTC timestamp>.dump` and prunes dumps
older than 30 days (override with a third argument). Schedule this daily
(cron, or a scheduled GitHub Actions workflow once a hosting target
exists) for each database.

## Restore procedure (tested)

```bash
RESTORE_DATABASE_URL="postgresql://user:pass@host:5432/scratch_db" \
  ./scripts/db-restore.sh backups/marketplace/marketplace_20260101T000000Z.dump
```

`db-restore.sh` runs `pg_restore --clean --if-exists` against the target
and then verifies the restore by checking that the restored database has a
non-zero table count. **Never point `RESTORE_DATABASE_URL` at a database
you care about** — the script does not prompt for confirmation before
dropping/recreating objects in the target.

This was executed against a non-production scratch database as part of
this change: a marketplace test database was seeded with data, backed up
with `db-backup.sh`, restored into a separate fresh database with
`db-restore.sh`, and the restored database was confirmed to contain the
same row (41 tables restored, seeded row intact). Re-run this drill
periodically (e.g. quarterly, or whenever the schema changes
significantly) against a real production backup, not just a synthetic one.

## Migration history: replay and rollback

The `server/` migration history could not previously be replayed from an
empty database — CI's `server-integration` job worked around this by
applying only the single migration under test directly, rather than
running `prisma migrate deploy`. Root cause: the tracked migration history
never included a baseline migration creating the original tables (the
earliest tracked migration, `20260326000000_add_location_to_products`,
`ALTER`s a `products` table it never created). This meant:

- A fresh environment (a new hire, a disaster-recovery restore into a
  schema-only rebuild, a from-scratch CI run) could not stand up the
  schema via `prisma migrate deploy` at all.
- There was no verified path from "empty Postgres instance" to "schema
  matching `schema.prisma`" — which is exactly the scenario a real
  restore-from-backup-loss (as opposed to restore-from-dump) would need.

Fixed by adding `20260101000000_baseline_schema`, a migration generated
via `prisma migrate diff --from-empty` against the schema state that must
have existed before the tracked history begins (reconstructed by removing
every model/column/index the subsequent 12 migrations add), plus the
`migration_lock.toml` that was also missing from `server/prisma/migrations/`.
Fixing the replay also surfaced two smaller pre-existing bugs, fixed
alongside it since they block a clean replay/drift-free state:

- `Order.productId` and `PriceHistory.productId` were typed as plain
  `String` while `Product.id` is `String @db.Uuid` — Postgres refuses to
  create the foreign key once the tables are created in the same
  transaction from scratch (`text` and `uuid` are incompatible key types).
  Fixed by adding `@db.Uuid` to both fields.
- `schema.prisma` and the applied migrations had drifted apart: two
  indexes on `buyer_demands` and two on `farmer_supplies` were declared in
  `schema.prisma` but never created by any migration, `disputes` had an
  index (`disputes_orderIdOnChain_idx`) created by a migration but never
  declared in `schema.prisma` (redundant with the existing unique index on
  the same column), and `ContractWatcherCheckpoint.createdAt`/`updatedAt`
  were missing the `@map` needed to match the snake_case columns the
  migration actually created. Fixed via a new migration
  (`20260801000000_reconcile_index_drift`) for the index drift, and a
  schema-only `@map` fix for the column-name drift (non-destructive — the
  underlying columns already exist under those names).

`agro-production/server/` had a related but distinct bug: two migrations
(`add_dispute_lifecycle`, `add_product_marketplace`) were dated
`20250625`, a year before `20260425_init` — the migration that creates the
`campaigns` and `orders` tables both of them have foreign keys into. Since
Prisma applies migrations in filename-sort order, a fresh replay tried to
create `disputes`/`products` before `campaigns` existed and failed. Fixed
by renaming both migration folders to `20260427000000_add_dispute_lifecycle`
and `20260427000001_add_product_marketplace`, which sorts them after
`init` while preserving their original relative order and content.

Both migration histories are now verified to `prisma migrate deploy`
cleanly from an empty Postgres instance (verified locally against Postgres
16 for `server/`; `agro-production/server/`'s existing CI already runs
`prisma migrate deploy` against Postgres 15, so the ordering fix directly
unblocks that step — see `.github/workflows/server-ci.yml`). `server/`'s
CI (`.github/workflows/ci.yml`, `server-integration` job) now runs the
same `prisma migrate deploy` instead of the single-migration workaround,
plus `prisma migrate diff --exit-code` to catch future schema/migration
drift before it ships.

Note: `agro-production/server/schema.prisma` currently fails `prisma
generate`/`migrate diff` entirely due to an unrelated bug — a `Product`
model referenced by `Campaign.products` that doesn't exist in the schema.
That's tracked separately as
[#744](https://github.com/Cylo-Traders/Agrocylo-Global/issues/744) and is
out of scope here; it doesn't affect `prisma migrate deploy`, which
applies the raw SQL migrations directly rather than parsing the datamodel.

### Rollback

Prisma Migrate has no automated down-migration story. Rollback here means:
restore the pre-migration backup (see above) rather than attempting to
hand-write reverse SQL for a schema change already applied to production.
This is why the restore drill above matters more than the theoretical
existence of backups — an untested restore path is not a rollback plan.
