#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "用法：deploy/ops/mysql-restore.sh <backup.sql>"
  exit 1
fi

COMPOSE_FILE="${COMPOSE_FILE:-deploy/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "备份文件不存在：$BACKUP_FILE"
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop api
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T mysql \
  sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  < "$BACKUP_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d api

echo "数据库恢复完成：$BACKUP_FILE"
