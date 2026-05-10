#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-deploy/backups/mysql}"
TIMESTAMP="$(date +%F_%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql \
  sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > "$BACKUP_DIR/xiaoman_$TIMESTAMP.sql"

echo "数据库备份完成：$BACKUP_DIR/xiaoman_$TIMESTAMP.sql"
