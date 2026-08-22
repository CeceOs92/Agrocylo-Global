#!/usr/bin/env bash
# Restores a logical backup produced by db-backup.sh into a target
# database, then runs a basic post-restore sanity check (table count).
# Intended for restore drills against a scratch/non-production database —
# it does not confirm before dropping objects in the target, so never
# point RESTORE_DATABASE_URL at a database you care about.
#
# Usage:
#   RESTORE_DATABASE_URL=postgresql://user:pass@host:5432/dbname \
#     ./scripts/db-restore.sh <dump-file>

set -euo pipefail

dump_file="${1:?usage: db-restore.sh <dump-file>}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must be set (point this at a scratch database, never production)}"

if [ ! -f "$dump_file" ]; then
  echo "Dump file not found: ${dump_file}" >&2
  exit 1
fi

echo "Restoring ${dump_file} into target database ..."
pg_restore --dbname="$RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$dump_file"

echo "Restore finished. Verifying table count ..."
table_count="$(psql "$RESTORE_DATABASE_URL" --tuples-only --no-align -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")"

echo "Restored database has ${table_count} tables in the public schema."

if [ "$table_count" -eq 0 ]; then
  echo "Restore verification failed: no tables found after restore." >&2
  exit 1
fi

echo "Restore verified."
