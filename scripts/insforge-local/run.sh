#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
unset GLOBSORT
shopt -s nullglob

if (($# > 3)); then
  echo "Usage: bash run.sh [migrations-dir [fixtures-dir [cluster-dir]]]" >&2
  exit 2
fi

harness_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
root_dir=$(cd -- "$harness_dir/../.." && pwd -P)
migrations_dir=${1:-$root_dir/insforge/migrations}
fixtures_dir=${2:-$root_dir/insforge/tests}
cluster_dir=${3:-$HOME/work/captain/pg-loop1-a}
pg_bin=${PG_BIN:-$HOME/kitchen-omniagent/runtime/pg/bin}
port=${PGPORT:-55432}
owner_id=00000000-0000-4000-8000-000000000001
other_id=00000000-0000-4000-8000-000000000002

passed=0
failed=0
summary() {
  printf 'Summary: %d passed, %d failures\n' "$passed" "$failed"
}
setup_failed() {
  printf 'FAIL setup %s\n' "$1" >&2
  failed=$((failed + 1))
  summary
  exit 1
}

if [[ -n ${1:-} && ! -d $migrations_dir ]]; then
  setup_failed "migrations directory not found: $migrations_dir"
fi
if [[ -n ${2:-} && ! -d $fixtures_dir ]]; then
  setup_failed "fixtures directory not found: $fixtures_dir"
fi

cluster_dir=$(cd -- "$cluster_dir" && pwd -P) || setup_failed "cluster directory not found"
captain_dir=$(cd -- "$HOME/work/captain" && pwd -P) || setup_failed "cluster parent directory not found"
data_dir=$(cd -- "$cluster_dir/data" && pwd -P) || setup_failed "cluster data directory not found"
if [[ $cluster_dir != "$captain_dir/"* || $data_dir != "$cluster_dir/data" || ! -S $cluster_dir/.s.PGSQL.$port ]]; then
  setup_failed "expected a dedicated local socket and data directory under $captain_dir"
fi

psql=(env -i "LD_LIBRARY_PATH=$pg_bin/../lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  "$pg_bin/psql" -X -w -h "$cluster_dir" -p "$port" -U postgres -v ON_ERROR_STOP=1 -q)
actual_data_dir=$("${psql[@]}" -d postgres -Atc 'SHOW data_directory') || setup_failed "connecting to local Postgres"
[[ $actual_data_dir == "$data_dir" ]] || setup_failed "socket does not belong to the requested cluster"
"${psql[@]}" -d postgres -c 'DROP DATABASE IF EXISTS tempo_test' -c 'CREATE DATABASE tempo_test' ||
  setup_failed "recreating tempo_test"
"${psql[@]}" -d tempo_test -1 -f "$harness_dir/stub.sql" || setup_failed "applying stub.sql"

run_sql() {
  local stage=$1 file=$2 output
  shift 2
  if output=$("${psql[@]}" -d tempo_test "$@" -f "$file" 2>&1); then
    printf 'OK   %s %s\n' "$stage" "${file##*/}"
    passed=$((passed + 1))
  else
    printf 'FAIL %s %s\n%s\n' "$stage" "${file##*/}" "$output"
    failed=$((failed + 1))
  fi
}

for file in "$migrations_dir"/*.sql; do
  run_sql migrate "$file" -1 -c 'SET ROLE project_admin'
done

if ! "${psql[@]}" -d tempo_test -v owner_id="$owner_id" -v other_id="$other_id" <<'SQL'
INSERT INTO auth.users (id, email) VALUES
  (:'owner_id', 'tempo-owner@example.invalid'),
  (:'other_id', 'tempo-other@example.invalid');
SQL
then
  setup_failed "seeding fixture users"
fi

for file in "$fixtures_dir"/*.sql; do
  run_sql fixture "$file" -v owner_id="$owner_id" -v other_id="$other_id"
done

summary
exit "$((failed > 0))"
