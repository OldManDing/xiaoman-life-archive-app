#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-https://api.example.com}"
APP_BASE_URL="${APP_BASE_URL:-https://app.example.com}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-https://admin.example.com}"

curl -fsS "$API_BASE_URL/api/v1/health" >/dev/null
curl -fsSI "$APP_BASE_URL" >/dev/null
curl -fsSI "$ADMIN_BASE_URL" >/dev/null

echo "健康检查通过：API、App、管理后台均可访问"
