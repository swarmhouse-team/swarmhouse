#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$root/scripts/switch-version.sh"

failures=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    printf 'ok %s\n' "$name"
  else
    printf 'fail %s expected [%s] actual [%s]\n' "$name" "$expected" "$actual" >&2
    failures=$((failures + 1))
  fi
}

check_ok() {
  local name="$1"
  shift
  if "$@"; then
    printf 'ok %s\n' "$name"
  else
    printf 'fail %s\n' "$name" >&2
    failures=$((failures + 1))
  fi
}

check "valid v1.2.3" "yes" "$(tag_valid v1.2.3 && echo yes || echo no)"
check "reject beta" "no" "$(tag_valid v1.2.3-beta && echo yes || echo no)"
check "reject leading zero" "no" "$(tag_valid v01.2.3 && echo yes || echo no)"
check "v1.10 > v1.9" "yes" "$(version_gt v1.10.0 v1.9.0 && echo yes || echo no)"
check "v1.2 not > v1.2" "no" "$(version_gt v1.2.0 v1.2.0 && echo yes || echo no)"
check "v2 > v1.9" "yes" "$(version_gt v2.0.0 v1.9.9 && echo yes || echo no)"

tmp="$(mktemp -d)"
printf '%s\n' v1.0.0 v1.2.0 v1.1.0 >"$tmp/journal"
check "max is v1.2.0" "v1.2.0" "$(max_tag "$tmp/journal")"
check "last is v1.1.0" "v1.1.0" "$(last_tag "$tmp/journal")"
check "release above max" "v1.3.0" "$(select_release_tag v1.3.0 "$tmp/journal" || true)"
check "release equal max rejected" "" "$(select_release_tag v1.2.0 "$tmp/journal" || true)"
check "release below max rejected" "" "$(select_release_tag v1.1.0 "$tmp/journal" || true)"
check "rollback nearest below last" "v1.0.0" "$(select_rollback_tag "$tmp/journal" "v1.0.0,v1.2.0")"
check "rollback ignores tag not allowed" "" "$(select_rollback_tag "$tmp/journal" "v1.2.0")"
printf '%s\n' v1.0.0 v1.9.0 v1.10.0 v1.11.0 >"$tmp/journal-near"
check "rollback nearest is v1.10 not v1.9" "v1.10.0" "$(select_rollback_tag "$tmp/journal-near" "v1.0.0,v1.9.0,v1.10.0")"
check "sorted history" "a,b" "$(sorted_csv "b,a")"

printf '%s\n' 'DATABASE_URL=postgresql://robots:secret@postgres:5432/robots' 'JWT_ACCESS_SECRET=secret' >"$tmp/.env"
chmod 640 "$tmp/.env"
before_mode="$(stat -c %a "$tmp/.env")"
write_app_version "$tmp/.env" v1.2.0
check "env version" "v1.2.0" "$(read_app_version "$tmp/.env")"
check "env keeps database line" "1" "$(grep -c '^DATABASE_URL=' "$tmp/.env")"
check "env mode preserved" "$before_mode" "$(stat -c %a "$tmp/.env")"
if grep -q 'secret' <<<"$(read_app_version "$tmp/.env")"; then
  printf 'fail version reader leaked a secret\n' >&2
  failures=$((failures + 1))
else
  printf 'ok version reader stays on APP_VERSION\n'
fi

append_journal_file "$tmp/deployed-versions" v1.0.0
append_journal_file "$tmp/deployed-versions" v1.2.0
check "journal last after append" "v1.2.0" "$(last_tag "$tmp/deployed-versions")"
write_schema_allow_file "$tmp/schema-allow" "b,a" v1.1.0 "v1.0.0"
check "schema history" "a,b" "$(read_schema_field "$tmp/schema-allow" history)"
check "schema version" "v1.1.0" "$(read_schema_field "$tmp/schema-allow" version)"
check "schema allow" "v1.0.0" "$(read_schema_field "$tmp/schema-allow" allow)"
check_ok "schema version runs on its history" schema_tag_ok "$tmp/schema-allow" v1.1.0 "b,a"
check_ok "old allow tag runs on its history" schema_tag_ok "$tmp/schema-allow" v1.0.0 "a,b"
if schema_tag_ok "$tmp/schema-allow" v1.1.0 "other"; then
  printf 'fail stale history must not permit the schema version\n' >&2
  failures=$((failures + 1))
else
  printf 'ok stale history is not permission\n'
fi
if schema_tag_ok "$tmp/missing-allow" v1.0.0 "a,b"; then
  printf 'fail missing allow must not permit a tag\n' >&2
  failures=$((failures + 1))
else
  printf 'ok missing allow is not permission\n'
fi
printf '%s\n' 'history=a,b' 'allow=v1.0.0' >"$tmp/allow-without-version"
check_ok "old tag allowed without version field" schema_tag_ok "$tmp/allow-without-version" v1.0.0 "a,b"
if schema_tag_ok "$tmp/allow-without-version" v1.1.0 "a,b"; then
  printf 'fail current tag is not implied by the old-tag list\n' >&2
  failures=$((failures + 1))
else
  printf 'ok schema version is separate from old tags\n'
fi

touch "$tmp/not-a-directory"
if append_journal_file "$tmp/not-a-directory/deployed-versions" v1.3.0 2>/dev/null; then
  printf 'fail journal write should fail when the parent is not a directory\n' >&2
  failures=$((failures + 1))
else
  printf 'ok journal write fails closed\n'
fi
check "journal unchanged after failed write" "v1.2.0" "$(last_tag "$tmp/deployed-versions")"

env_before="$(mktemp)"
cp -a "$tmp/.env" "$env_before"
(
  awk() { return 1; }
  if write_app_version "$tmp/.env" v9.9.9; then
    exit 1
  fi
  cmp -s "$tmp/.env" "$env_before"
  [[ -z "$(find "$tmp" -name '.env.*' -print -quit)" ]]
) && printf 'ok awk failure keeps .env and removes temp\n' || {
  printf 'fail awk failure kept .env byte-for-byte without a temp file\n' >&2
  failures=$((failures + 1))
}

journal_before="$(mktemp)"
cp -a "$tmp/deployed-versions" "$journal_before"
(
  cat() { return 1; }
  if append_journal_file "$tmp/deployed-versions" v9.9.9; then
    exit 1
  fi
  cmp -s "$tmp/deployed-versions" "$journal_before"
  [[ -z "$(find "$tmp" -name 'deployed-versions.*' -print -quit)" ]]
) && printf 'ok cat failure keeps journal and removes temp\n' || {
  printf 'fail cat failure kept journal byte-for-byte without a temp file\n' >&2
  failures=$((failures + 1))
}
rm -f "$env_before" "$journal_before"

run_fake_docker() {
  local ps_fail="$1" log="$2" app="$3" bin
  bin="$(mktemp -d)"
  cat >"$bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "${DOCKER_LOG:?}"
if [[ "$1" == "compose" && "$2" == "ps" && "${DOCKER_PS_FAIL:-}" == 1 ]]; then
  printf '%s\n' "daemon unavailable" >&2
  exit 1
fi
exit 0
EOF
  cat >"$bin/flock" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$bin/docker" "$bin/flock"
  printf '%s\n' 'APP_VERSION=v0.0.0' >"$app/.env"
  set +e
  PATH="$bin:$PATH" \
    DOCKER_LOG="$log" \
    DOCKER_PS_FAIL="$ps_fail" \
    APP_DIR="$app" \
    bash "$root/scripts/switch-version.sh" release v1.0.0 >"$app/out" 2>&1
  fake_code=$?
  set -e
  rm -rf "$bin"
}

docker_app="$(mktemp -d)"
docker_log="$(mktemp)"
run_fake_docker 1 "$docker_log" "$docker_app"
check "docker ps error exits" "1" "$fake_code"
if grep -F -q "не удалось прочитать запущенные контейнеры" "$docker_app/out"; then
  printf 'ok docker ps error message\n'
else
  printf 'fail docker ps error message\n' >&2
  failures=$((failures + 1))
fi
if grep -Eq 'compose (pull|up|run)' "$docker_log"; then
  printf 'fail docker ps error started a deploy\n' >&2
  failures=$((failures + 1))
else
  printf 'ok docker ps error does not start first deploy\n'
fi

docker_app_ok="$(mktemp -d)"
docker_log_ok="$(mktemp)"
run_fake_docker 0 "$docker_log_ok" "$docker_app_ok"
if grep -Eq 'compose pull' "$docker_log_ok"; then
  printf 'ok empty ps proceeds to pull\n'
else
  printf 'fail empty ps should reach pull\n' >&2
  failures=$((failures + 1))
fi

rm -rf "$tmp" "$docker_app" "$docker_app_ok"
rm -f "$docker_log" "$docker_log_ok"
if [[ "$failures" -ne 0 ]]; then
  printf '%s failed\n' "$failures" >&2
  exit 1
fi
printf 'unit ok\n'
