#!/usr/bin/env bash
# Takes a compressed logical backup of a Postgres database and prunes
# backups older than the retention window. Works against any Postgres
# target (self-hosted, docker-compose, or a managed provider) since it
# only needs a DATABASE_URL.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:5432/dbname \
#     ./scripts/db-backup.sh <label> [backup-dir] [retention-days]
#
# Example:
#   DATABASE_URL=$MARKETPLACE_DATABASE_URL ./scripts/db-backup.sh marketplace
#   DATABASE_URL=$PRODUCTION_DATABASE_URL  ./scripts/db-backup.sh production

set -euo pipefail

label="${1:?usage: db-backup.sh <label> [backup-dir] [retention-days]}"
backup_dir="${2:-backups/${label}}"
retention_days="${3:-30}"

: "${DATABASE_URL:?DATABASE_URL must be set}"

mkdir -p "$backup_dir"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="${backup_dir}/${label}_${timestamp}.dump"

echo "Backing up '${label}' to ${dump_file} ..."
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$dump_file"

size="$(du -h "$dump_file" | cut -f1)"
echo "Backup complete: ${dump_file} (${size})"

echo "Pruning ${label} backups older than ${retention_days} days from ${backup_dir} ..."
find "$backup_dir" -name "${label}_*.dump" -type f -mtime "+${retention_days}" -print -delete

echo "Done."
