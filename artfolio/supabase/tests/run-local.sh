#!/usr/bin/env bash
# Tests the site_content migration on a throwaway local Postgres:
#   1. applies the Artfolio base schema (from the artfolio-app branch, or the
#      file given as $ARTFOLIO_INIT) and the new migration;
#   2. runs the access-rule tests;
#   3. checks the migration is additive (no ALTER/DROP/REPLACE of anything).
#
#   bash artfolio/supabase/tests/run-local.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
migration="$here/../migrations/20261122120000_site_content.sql"
bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d)"
port="${PG_PORT:-55432}"
trap 'su postgres -c "$bin/pg_ctl -D $work/db -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

init="${ARTFOLIO_INIT:-}"
if [[ -z "$init" ]]; then
  init="$work/init.sql"
  git -C "$repo" show origin/artfolio-app:supabase/migrations/20261115000000_init.sql > "$init"
fi

echo "== additive check"
node "$here/check-additive.mjs" "$migration"

chown -R postgres "$work"
su postgres -c "$bin/initdb -D $work/db -A trust -U postgres" >/dev/null
su postgres -c "$bin/pg_ctl -D $work/db -o '-p $port -k $work' -l $work/log start -w" >/dev/null
psql=(psql -h "$work" -p "$port" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

echo "== schema"
"${psql[@]}" -f "$here/stubs.sql"
"${psql[@]}" -f "$init" >/dev/null
"${psql[@]}" -f "$migration"
echo "== access rules"
"${psql[@]}" -f "$here/site_content.test.sql"
