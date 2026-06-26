#!/usr/bin/env bash
# Daily PostgreSQL backup with 14-day rotation.
# Install: copy to /opt/ochrona/backup.sh, chmod +x, add to root crontab:
#   0 2 * * * /opt/ochrona/backup.sh >> /var/log/ochrona-backup.log 2>&1
set -euo pipefail

DB_NAME="ochronazklasa"
DIR="/opt/ochrona/backups"
TS="$(date +%F_%H%M)"

mkdir -p "$DIR"
sudo -u postgres pg_dump "$DB_NAME" | gzip > "$DIR/${DB_NAME}_${TS}.sql.gz"

# Keep only the 14 most recent dumps
ls -1t "$DIR"/${DB_NAME}_*.sql.gz | tail -n +15 | xargs -r rm -f

echo "$(date -Is) backup ok: ${DB_NAME}_${TS}.sql.gz"

# OPTIONAL offsite copy (uncomment + configure a Hetzner Storage Box):
# rsync -az "$DIR"/ u123456@u123456.your-storagebox.de:backups/
