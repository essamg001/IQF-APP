#!/bin/bash
# Manual/on-demand version of the nightly backup -- dumps the local IQF
# Postgres database to a timestamped, gzipped file outside the repo. Safe to
# run by hand from Terminal any time.
#
# NOT what the nightly schedule actually runs: launchd-spawned processes
# can't read anything under ~/Desktop on modern macOS (Terminal has that
# access, launchd jobs don't), so the scheduled copy is fully self-contained
# under ~/IQF-Backups (script, pg_dump binary, and DB connection string all
# copied there) -- see ~/IQF-Backups/backup-db.sh and
# ~/Library/LaunchAgents/com.iqf.dbbackup.plist. If DATABASE_URL ever
# changes, update ~/IQF-Backups/dbconfig to match.
set -euo pipefail

PROJECT_DIR="/Users/essamghalia/Desktop/IQF APP"
PG_DUMP="$PROJECT_DIR/.devdb/pgsql/bin/pg_dump"
BACKUP_DIR="$HOME/IQF-Backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

DATABASE_URL=$(grep -m1 '^DATABASE_URL=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"')

mkdir -p "$BACKUP_DIR"

"$PG_DUMP" "$DATABASE_URL" | gzip > "$BACKUP_DIR/iqf-backup-$TIMESTAMP.sql.gz.tmp"
mv "$BACKUP_DIR/iqf-backup-$TIMESTAMP.sql.gz.tmp" "$BACKUP_DIR/iqf-backup-$TIMESTAMP.sql.gz"

find "$BACKUP_DIR" -name "iqf-backup-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

echo "$(date '+%Y-%m-%d %H:%M:%S') backed up to iqf-backup-$TIMESTAMP.sql.gz"
