#!/usr/bin/env bash
# Изолированный стенд. Нужны bash, flock и docker CLI с сокетом демона.
# Свои образы регистрируются по мере сборки. Чужие теги и registry не удаляются.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
switch="$root/scripts/switch-version.sh"
stand_compose="$root/scripts/switch-stand/compose.yml"
run_id="$$-$RANDOM"
app_dir="$(mktemp -d)"
build_dir="$(mktemp -d)"
registry_name="swarmhouse-switch-reg-$run_id"
good_api="swarmhouse-switch-good-api:$run_id"
good_web="swarmhouse-switch-good-web:$run_id"
broken_image="swarmhouse-switch-broken:$run_id"
registry_port=""
registered=()
failures=0
steps=0
last_output=""

remember() {
  local name="$1" known
  if [[ "${#registered[@]}" -gt 0 ]]; then
    for known in "${registered[@]}"; do
      [[ "$known" == "$name" ]] && return 0
    done
  fi
  registered+=("$name")
}

tag_image() {
  docker tag "$1" "$2"
  remember "$2"
}

build_image() {
  local dockerfile="$1" name="$2"
  docker build -q -f "$build_dir/$dockerfile" -t "$name" "$build_dir" >/dev/null
  remember "$name"
}

cleanup() {
  if [[ -f "$app_dir/docker-compose.yml" ]]; then
    docker compose --project-directory "$app_dir" down -v --remove-orphans >/dev/null 2>&1 || true
  fi
  if [[ -n "$registry_name" ]]; then
    docker rm -f "$registry_name" >/dev/null 2>&1 || true
  fi
  if [[ "${#registered[@]}" -gt 0 ]]; then
    docker image rm -f "${registered[@]}" >/dev/null 2>&1 || true
  fi
  rm -rf "$app_dir" "$build_dir"
}
trap cleanup EXIT

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'нет команды %s\n' "$1" >&2
    exit 1
  }
}

require docker
require flock
docker image inspect swarmhouse-api:local >/dev/null
docker image inspect swarmhouse-web:local >/dev/null

export COMPOSE_PROJECT_NAME="swarmhouse-switch-$run_id"

docker run -d --name "$registry_name" -p 127.0.0.1::5000 registry:2 >/dev/null
mapped="$(docker port "$registry_name" 5000/tcp | head -n 1)"
registry_port="127.0.0.1:${mapped##*:}"
export SWITCH_REGISTRY="$registry_port"

cp "$stand_compose" "$app_dir/docker-compose.yml"
cat >"$app_dir/.env" <<'EOF'
APP_VERSION=v0.0.0
DATABASE_URL=postgresql://robots:robots@postgres:5432/robots
JWT_ACCESS_SECRET=test-stand-jwt-secret
JWT_ACCESS_TTL=15m
EOF
chmod 640 "$app_dir/.env"

printf '%s\n' 'v1.0.0' >"$build_dir/allow-v1.0.0"
printf '%s\n' 'v1.0.0' >"$build_dir/allow-compat"
cat >"$build_dir/Dockerfile.allow" <<'EOF'
FROM swarmhouse-api:local
COPY allow-v1.0.0 prisma/rollback-allow
EOF
cat >"$build_dir/Dockerfile.sleep" <<'EOF'
FROM swarmhouse-api:local
CMD ["sleep", "infinity"]
EOF
cat >"$build_dir/Dockerfile.sleep-allow" <<'EOF'
FROM swarmhouse-api:local
COPY allow-v1.0.0 prisma/rollback-allow
CMD ["sleep", "infinity"]
EOF
cat >"$build_dir/Dockerfile.bad" <<'EOF'
FROM swarmhouse-api:local
RUN mkdir -p prisma/migrations/20990101000000_bad \
  && printf '%s\n' 'SELECT missing_relation_for_switch_test;' > prisma/migrations/20990101000000_bad/migration.sql
EOF
cat >"$build_dir/Dockerfile.compat" <<'EOF'
FROM swarmhouse-api:local
RUN mkdir -p prisma/migrations/20990102000000_note \
  && printf '%s\n' 'ALTER TABLE "warehouses" ADD COLUMN "note" TEXT;' > prisma/migrations/20990102000000_note/migration.sql
COPY allow-compat prisma/rollback-allow
EOF
cat >"$build_dir/Dockerfile.broken" <<'EOF'
FROM swarmhouse-api:local
ENTRYPOINT ["definitely-missing"]
EOF

push_image() {
  local image="$1" pushed=0 push_error=""
  for _ in $(seq 1 20); do
    if push_error="$(docker push "$image" 2>&1)"; then
      pushed=1
      break
    fi
    sleep 1
  done
  [[ "$pushed" -eq 1 ]] || {
    printf 'не удалось отправить %s в локальный registry\n%s\n' "$image" "$push_error" >&2
    exit 1
  }
}

ref() {
  printf '%s/%s' "$registry_port" "$1"
}

tag_image swarmhouse-api:local "$(ref swarmhouse-api:v1.0.0)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.0.0)"
tag_image "$(ref swarmhouse-api:v1.0.0)" "$good_api"
tag_image "$(ref swarmhouse-web:v1.0.0)" "$good_web"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.1.0)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.2.0)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.2.1)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.2.2)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.3.0)"
tag_image swarmhouse-web:local "$(ref swarmhouse-web:v1.4.0)"
build_image Dockerfile.sleep "$(ref swarmhouse-api:v0.1.0)"
tag_image "$(ref swarmhouse-api:v0.1.0)" "$(ref swarmhouse-web:v0.1.0)"
build_image Dockerfile.allow "$(ref swarmhouse-api:v1.1.0)"
build_image Dockerfile.sleep-allow "$(ref swarmhouse-api:v1.2.0)"
tag_image "$(ref swarmhouse-api:v1.2.0)" "$(ref swarmhouse-api:v1.2.1)"
tag_image "$(ref swarmhouse-api:v1.2.0)" "$(ref swarmhouse-api:v1.2.2)"
build_image Dockerfile.bad "$(ref swarmhouse-api:v1.3.0)"
build_image Dockerfile.compat "$(ref swarmhouse-api:v1.4.0)"
build_image Dockerfile.broken "$broken_image"

for image in \
  swarmhouse-api:v0.1.0 swarmhouse-web:v0.1.0 \
  swarmhouse-api:v1.0.0 swarmhouse-web:v1.0.0 \
  swarmhouse-api:v1.1.0 swarmhouse-web:v1.1.0 \
  swarmhouse-api:v1.2.0 swarmhouse-web:v1.2.0 \
  swarmhouse-api:v1.2.1 swarmhouse-web:v1.2.1 \
  swarmhouse-api:v1.2.2 swarmhouse-web:v1.2.2 \
  swarmhouse-api:v1.3.0 swarmhouse-web:v1.3.0 \
  swarmhouse-api:v1.4.0 swarmhouse-web:v1.4.0
do
  push_image "$(ref "$image")"
done

APP_VERSION=v0.0.0 docker compose --project-directory "$app_dir" up -d postgres >/dev/null
pg_id="$(docker compose --project-directory "$app_dir" ps -q postgres)"
pg_ready=0
for _ in $(seq 1 30); do
  if docker compose --project-directory "$app_dir" exec -T postgres pg_isready -U robots -d robots >/dev/null 2>&1; then
    pg_ready=1
    break
  fi
  sleep 1
done
[[ "$pg_ready" -eq 1 ]] || {
  printf 'postgres стенда не поднялся\n' >&2
  exit 1
}

container_id() {
  docker compose --project-directory "$app_dir" ps -q --status running "$1"
}

running_image() {
  local id
  id="$(container_id "$1")"
  [[ -n "$id" ]] || return 1
  docker inspect --format '{{.Config.Image}}' "$id"
}

postgres_same() {
  [[ "$(docker compose --project-directory "$app_dir" ps -q postgres)" == "$pg_id" ]]
}

migration_names() {
  docker compose --project-directory "$app_dir" exec -T postgres \
    psql -U robots -d robots -At -c \
    "SELECT migration_name FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY 1;"
}

scenario() {
  printf '\n== %s\n' "$1"
}

run_switch() {
  local expect_code="$1" expect_text="$2"
  shift 2
  local output code
  set +e
  output="$(APP_DIR="$app_dir" SWITCH_HEALTH_SECONDS="${HEALTH_SECONDS:-60}" bash "$switch" "$@" 2>&1)"
  code=$?
  set -e
  steps=$((steps + 1))
  if printf '%s\n' "$output" | grep -Eq 'DATABASE_URL=|JWT_ACCESS_SECRET=|postgresql://'; then
    printf 'fail step %s: вывод содержит секрет или DATABASE_URL\n' "$steps" >&2
    exit 1
  fi
  if [[ "$code" -ne "$expect_code" ]] || ! printf '%s\n' "$output" | grep -F -q "$expect_text"; then
    printf 'fail step %s: code %s, expected %s and [%s]\n' "$steps" "$code" "$expect_code" "$expect_text" >&2
    printf '%s\n' "$output" | sed -E 's#(postgresql://)[^[:space:]]+#\1redacted#g' >&2
    exit 1
  fi
  last_output="$output"
  printf 'ok step %s %s\n' "$steps" "$expect_text"
}

assert_true() {
  local name="$1"
  shift
  steps=$((steps + 1))
  if "$@"; then
    printf 'ok step %s %s\n' "$steps" "$name"
  else
    printf 'fail step %s %s\n' "$steps" "$name" >&2
    exit 1
  fi
}

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  steps=$((steps + 1))
  if [[ "$expected" == "$actual" ]]; then
    printf 'ok step %s %s\n' "$steps" "$name"
  else
    printf 'fail step %s %s expected [%s] actual [%s]\n' "$steps" "$name" "$expected" "$actual" >&2
    exit 1
  fi
}

field() {
  sed -n "s/^$1=//p" "$app_dir/schema-allow"
}

scenario "первый деплой не проходит health"
HEALTH_SECONDS=12
run_switch 1 "выкладка не удалась, предыдущей рабочей версии не было" release v0.1.0
assert_true "журнал не создан" test ! -f "$app_dir/deployed-versions"
assert_true "api остановлен" test -z "$(docker compose --project-directory "$app_dir" ps -q --status running api)"
assert_true "web остановлен" test -z "$(docker compose --project-directory "$app_dir" ps -q --status running web)"
assert_true "postgres жив" postgres_same
assert_eq "env не сменился" "v0.0.0" "$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"

scenario "успешная выкладка v1.0.0"
HEALTH_SECONDS=60
run_switch 0 "зафиксирована версия v1.0.0" release v1.0.0
assert_eq "журнал v1.0.0" "v1.0.0" "$(tail -n 1 "$app_dir/deployed-versions")"
assert_eq "env v1.0.0" "v1.0.0" "$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"
assert_eq "api v1.0.0" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "web v1.0.0" "$(ref swarmhouse-web:v1.0.0)" "$(running_image web)"
assert_eq "version v1.0.0" "v1.0.0" "$(field version)"
assert_eq "allow пуст" "" "$(field allow)"
assert_true "история из четырёх миграций" test "$(printf '%s' "$(field history)" | awk -F, '{print NF}')" -eq 4
assert_true "postgres не пересоздан" postgres_same
allow_after_first="$(cat "$app_dir/schema-allow")"

scenario "откат без допуска"
HEALTH_SECONDS=12
run_switch 1 "кандидата нет" rollback
assert_eq "после отказа api тот же" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "schema-allow не сменился" "$allow_after_first" "$(cat "$app_dir/schema-allow")"

scenario "успешная выкладка v1.1.0"
HEALTH_SECONDS=60
run_switch 0 "зафиксирована версия v1.1.0" release v1.1.0
assert_eq "version схемы v1.1.0" "v1.1.0" "$(field version)"
assert_eq "allow v1.0.0" "v1.0.0" "$(field allow)"
assert_eq "api v1.1.0" "$(ref swarmhouse-api:v1.1.0)" "$(running_image api)"
assert_true "postgres не пересоздан после release" postgres_same
allow_after_second="$(cat "$app_dir/schema-allow")"

scenario "устаревший допуск после изменения истории БД"
api_id="$(container_id api)"
web_id="$(container_id web)"
journal_before_history="$(cat "$app_dir/deployed-versions")"
env_before_history="$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"
docker compose --project-directory "$app_dir" exec -T postgres \
  psql -U robots -d robots -v ON_ERROR_STOP=1 \
  -c "UPDATE \"_prisma_migrations\" SET migration_name = '20990103000000_extra' WHERE migration_name = '20261110000000_init';" >/dev/null
run_switch 1 "нужна ручная сверка" rollback
assert_eq "история БД не дала переключить api" "$api_id" "$(container_id api)"
assert_eq "история БД не дала переключить web" "$web_id" "$(container_id web)"
assert_eq "журнал не изменился из-за устаревшего допуска" "$journal_before_history" "$(cat "$app_dir/deployed-versions")"
assert_eq "env не изменился из-за устаревшего допуска" "$env_before_history" "$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"
docker compose --project-directory "$app_dir" exec -T postgres \
  psql -U robots -d robots -v ON_ERROR_STOP=1 \
  -c "UPDATE \"_prisma_migrations\" SET migration_name = '20261110000000_init' WHERE migration_name = '20990103000000_extra';" >/dev/null

scenario "неудачный rollback возвращает версию схемы"
tag_image "$(ref swarmhouse-api:v0.1.0)" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$(ref swarmhouse-web:v0.1.0)" "$(ref swarmhouse-web:v1.0.0)"
push_image "$(ref swarmhouse-api:v1.0.0)"
push_image "$(ref swarmhouse-web:v1.0.0)"
HEALTH_SECONDS=45
run_switch 1 "выкладка не удалась, предыдущая версия восстановлена" rollback
assert_eq "после неудачного отката api v1.1.0" "$(ref swarmhouse-api:v1.1.0)" "$(running_image api)"
assert_eq "после неудачного отката web v1.1.0" "$(ref swarmhouse-web:v1.1.0)" "$(running_image web)"
assert_eq "кандидат не попал в env" "v1.1.0" "$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"
assert_eq "журнал остался на v1.1.0" "v1.1.0" "$(tail -n 1 "$app_dir/deployed-versions")"
assert_eq "schema-allow после неудачного отката" "$allow_after_second" "$(cat "$app_dir/schema-allow")"
tag_image "$good_api" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$good_web" "$(ref swarmhouse-web:v1.0.0)"
push_image "$(ref swarmhouse-api:v1.0.0)"
push_image "$(ref swarmhouse-web:v1.0.0)"

scenario "успешный откат"
HEALTH_SECONDS=60
run_switch 0 "зафиксирована версия v1.0.0" rollback
assert_eq "откат на v1.0.0" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "web откатился" "$(ref swarmhouse-web:v1.0.0)" "$(running_image web)"
assert_eq "schema-allow после rollback тот же" "$allow_after_second" "$(cat "$app_dir/schema-allow")"
assert_eq "последняя строка журнала v1.0.0" "v1.0.0" "$(tail -n 1 "$app_dir/deployed-versions")"
assert_true "postgres не пересоздан после rollback" postgres_same

scenario "релиз не выше максимума журнала"
journal_before="$(cat "$app_dir/deployed-versions")"
run_switch 1 "тег не выше максимального в журнале" release v1.0.1
assert_eq "поздний релиз не дописал журнал" "$journal_before" "$(cat "$app_dir/deployed-versions")"

scenario "обрыв между журналом и .env"
api_id="$(container_id api)"
web_id="$(container_id web)"
migrations_before_env="$(migration_names)"
sed -i 's/^APP_VERSION=.*/APP_VERSION=v9.9.9/' "$app_dir/.env"
run_switch 0 "выровнен только .env, версия не переключалась" release v2.0.0
assert_eq "env выровнен к журналу" "v1.0.0" "$(sed -n 's/^APP_VERSION=//p' "$app_dir/.env")"
assert_eq "контейнер api не пересоздан" "$api_id" "$(container_id api)"
assert_eq "контейнер web не пересоздан" "$web_id" "$(container_id web)"
assert_eq "образы не переключались" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "журнал после выравнивания env" "$journal_before" "$(cat "$app_dir/deployed-versions")"
assert_eq "повторной миграции не было" "$migrations_before_env" "$(migration_names)"

scenario "выравнивание образов по журналу"
APP_VERSION=v1.1.0 docker compose --project-directory "$app_dir" up -d --no-deps --pull never api web >/dev/null
run_switch 0 "выровнены образы по журналу, новая выкладка не выполнялась" release v2.0.0
assert_true "health пары журнала отвечает" grep -F -q "health пары журнала отвечает" <<<"$last_output"
assert_eq "образы возвращены к журналу" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"

scenario "пустой журнал при запущенном приложении"
mv "$app_dir/deployed-versions" "$app_dir/deployed-versions.bak"
run_switch 1 "неизвестное состояние" release v2.0.0
assert_eq "контейнер не остановлен" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
mv "$app_dir/deployed-versions.bak" "$app_dir/deployed-versions"

scenario "устаревший допуск"
cp "$app_dir/schema-allow" "$app_dir/schema-allow.bak"
printf '%s\n' 'history=not-real' 'version=v1.0.0' 'allow=v1.0.0' >"$app_dir/schema-allow"
run_switch 1 "нужна ручная сверка" rollback
assert_eq "устаревший допуск не переключил api" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
mv "$app_dir/schema-allow.bak" "$app_dir/schema-allow"

scenario "незавершённая миграция"
docker compose --project-directory "$app_dir" exec -T postgres \
  psql -U robots -d robots -v ON_ERROR_STOP=1 \
  -c "UPDATE \"_prisma_migrations\" SET finished_at = NULL WHERE migration_name = '20261110000000_init';" >/dev/null
run_switch 1 "нужна ручная сверка" rollback
assert_eq "незавершённая миграция не переключила api" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
docker compose --project-directory "$app_dir" exec -T postgres \
  psql -U robots -d robots -v ON_ERROR_STOP=1 \
  -c "UPDATE \"_prisma_migrations\" SET finished_at = NOW() WHERE migration_name = '20261110000000_init';" >/dev/null

scenario "сбой получения образов"
run_switch 1 "образы не получены" release v9.9.9
assert_eq "неудачный pull не сменил api" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"

scenario "сбой миграции"
schema_before_bad="$(cat "$app_dir/schema-allow")"
journal_before_bad="$(cat "$app_dir/deployed-versions")"
run_switch 1 "миграция не выполнена, нужна ручная сверка" release v1.3.0
assert_eq "сбой миграции не переписал допуск" "$schema_before_bad" "$(cat "$app_dir/schema-allow")"
assert_eq "сбой миграции не дописал журнал" "$journal_before_bad" "$(cat "$app_dir/deployed-versions")"
docker compose --project-directory "$app_dir" exec -T postgres \
  psql -U robots -d robots -v ON_ERROR_STOP=1 \
  -c "DELETE FROM \"_prisma_migrations\" WHERE migration_name = '20990101000000_bad';" >/dev/null

scenario "сбой health, предыдущая пара здорова"
HEALTH_SECONDS=45
run_switch 1 "выкладка не удалась, предыдущая версия восстановлена" release v1.2.0
assert_eq "после восстановления api v1.0.0" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "журнал не зафиксировал сбойную версию" "v1.0.0" "$(tail -n 1 "$app_dir/deployed-versions")"
assert_true "postgres не пересоздан при восстановлении" postgres_same

scenario "сбой health, предыдущая пара нездорова"
HEALTH_SECONDS=15
tag_image "$(ref swarmhouse-api:v1.2.0)" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$(ref swarmhouse-web:v0.1.0)" "$(ref swarmhouse-web:v1.0.0)"
run_switch 1 "предыдущие теги запущены, работоспособность не восстановлена" release v1.2.1
assert_eq "сбойный предыдущий тег запущен" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"

scenario "предыдущую пару не удалось запустить"
tag_image "$good_api" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$good_web" "$(ref swarmhouse-web:v1.0.0)"
APP_VERSION=v1.0.0 docker compose --project-directory "$app_dir" up -d --no-deps --pull never api web >/dev/null
tag_image "$broken_image" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$broken_image" "$(ref swarmhouse-web:v1.0.0)"
HEALTH_SECONDS=60
run_switch 1 "не удалось восстановить предыдущую версию" release v1.2.2

scenario "обратно совместимая миграция и откат"
tag_image "$good_api" "$(ref swarmhouse-api:v1.0.0)"
tag_image "$good_web" "$(ref swarmhouse-web:v1.0.0)"
push_image "$(ref swarmhouse-api:v1.0.0)"
push_image "$(ref swarmhouse-web:v1.0.0)"
HEALTH_SECONDS=60
run_switch 0 "зафиксирована версия v1.4.0" release v1.4.0
assert_eq "api на новой миграции" "$(ref swarmhouse-api:v1.4.0)" "$(running_image api)"
assert_true "история содержит note" grep -F -q "20990102000000_note" <<<"$(field history)"
migrations_after_release="$(migration_names)"
assert_true "в БД есть note" grep -F -q "20990102000000_note" <<<"$migrations_after_release"
run_switch 0 "зафиксирована версия v1.0.0" rollback
assert_eq "старый api на обновлённой БД" "$(ref swarmhouse-api:v1.0.0)" "$(running_image api)"
assert_eq "rollback не меняет миграции" "$migrations_after_release" "$(migration_names)"
assert_true "postgres не пересоздан на совместимой миграции" postgres_same

if [[ "$failures" -ne 0 ]]; then
  printf 'integration failed: %s\n' "$failures" >&2
  exit 1
fi
printf 'integration ok, steps %s\n' "$steps"
