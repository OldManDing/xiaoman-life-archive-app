#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-https://webapi.xmlga.top}"
APP_BASE_URL="${APP_BASE_URL:-https://nianlun.xmlga.top}"
ADMIN_BASE_URL="${ADMIN_BASE_URL:-https://nianlun.xmlga.top}"

curl -fsS "$API_BASE_URL/api/v1/health" >/dev/null
curl -fsSI "$APP_BASE_URL" >/dev/null
curl -fsSI "$ADMIN_BASE_URL" >/dev/null

echo "健康检查通过：API、App、管理后台均可访问"
