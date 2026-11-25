#!/usr/bin/env bash
# Переключение api и web. Режимы: release <vMAJOR.MINOR.PATCH> и rollback.
# APP_DIR — каталог с compose и .env. APP_VERSION в окружении процесса перекрывает .env.
set -euo pipefail

tag_valid() {
  [[ "$1" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]
}

version_gt() {
  local a1 a2 a3 b1 b2 b3
  IFS=. read -r a1 a2 a3 <<<"${1#v}"
  IFS=. read -r b1 b2 b3 <<<"${2#v}"
  if ((10#$a1 > 10#$b1)); then return 0; fi
  if ((10#$a1 < 10#$b1)); then return 1; fi
  if ((10#$a2 > 10#$b2)); then return 0; fi
  if ((10#$a2 < 10#$b2)); then return 1; fi
  if ((10#$a3 > 10#$b3)); then return 0; fi
  return 1
}

max_tag() {
  local max="" tag
  [[ -f "$1" ]] || return 0
  while IFS= read -r tag || [[ -n "$tag" ]]; do
    tag="${tag//$'\r'/}"
    tag_valid "$tag" || continue
    if [[ -z "$max" ]] || version_gt "$tag" "$max"; then
      max="$tag"
    fi
  done <"$1"
  printf '%s' "$max"
}

last_tag() {
  local line="" tag=""
  [[ -f "$1" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -n "$line" ]] && tag="$line"
  done <"$1"
  tag_valid "$tag" || tag=""
  printf '%s' "$tag"
}

csv_has() {
  local needle="$1" csv="$2" item
  IFS=',' read -ra items <<<"$csv"
  for item in "${items[@]}"; do
    [[ "$item" == "$needle" ]] && return 0
  done
  return 1
}

sorted_csv() {
  printf '%s' "$1" | tr ',' '\n' | sed '/^$/d' | LC_ALL=C sort | paste -sd, -
}

select_release_tag() {
  local candidate="$1" journal="$2" max
  tag_valid "$candidate" || return 1
  max="$(max_tag "$journal")"
  if [[ -n "$max" ]] && ! version_gt "$candidate" "$max"; then
    return 1
  fi
  printf '%s' "$candidate"
}

select_rollback_tag() {
  local journal="$1" allow_csv="$2" current best="" tag
  current="$(last_tag "$journal")"
  [[ -n "$current" ]] || return 0
  while IFS= read -r tag || [[ -n "$tag" ]]; do
    tag="${tag//$'\r'/}"
    tag_valid "$tag" || continue
    version_gt "$current" "$tag" || continue
    csv_has "$tag" "$allow_csv" || continue
    if [[ -z "$best" ]] || version_gt "$tag" "$best"; then
      best="$tag"
    fi
  done <"$journal"
  printf '%s' "$best"
}

read_app_version() {
  local line
  [[ -f "$1" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    if [[ "$line" == APP_VERSION=* ]]; then
      printf '%s' "${line#APP_VERSION=}"
      return 0
    fi
  done <"$1"
}

read_schema_field() {
  local file="$1" key="$2" line
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    if [[ "$line" == "$key"=* ]]; then
      printf '%s' "${line#"$key"=}"
      return 0
    fi
  done <"$file"
}

# Вызов через if/|| отключает set -e. mv только после успешной подготовки файла.
stage_replace() {
  local tmp="$1" dest="$2" mode="$3"
  if ! chmod "$mode" "$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if ! mv -f "$tmp" "$dest"; then
    rm -f "$tmp"
    return 1
  fi
}

write_app_version() {
  local file="$1" value="$2" tmp mode
  [[ -f "$file" ]] || return 1
  mode="$(stat -c %a "$file")" || return 1
  tmp="$(mktemp "${file}.XXXXXX")" || return 1
  if ! awk -v value="$value" '
    BEGIN { found = 0 }
    /^APP_VERSION=/ { print "APP_VERSION=" value; found = 1; next }
    { print }
    END { if (!found) print "APP_VERSION=" value }
  ' "$file" >"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  stage_replace "$tmp" "$file" "$mode"
}

append_journal_file() {
  local file="$1" value="$2" tmp mode
  tmp="$(mktemp "${file}.XXXXXX")" || return 1
  if [[ -f "$file" ]]; then
    mode="$(stat -c %a "$file")" || {
      rm -f "$tmp"
      return 1
    }
    if ! cat "$file" >"$tmp"; then
      rm -f "$tmp"
      return 1
    fi
  else
    mode=644
  fi
  if ! printf '%s\n' "$value" >>"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  stage_replace "$tmp" "$file" "$mode"
}

write_schema_allow_file() {
  local file="$1" history="$2" version="$3" allow="$4" tmp mode
  tag_valid "$version" || return 1
  history="$(sorted_csv "$history")"
  allow="$(sorted_csv "$allow")"
  tmp="$(mktemp "${file}.XXXXXX")" || return 1
  if ! printf 'history=%s\nversion=%s\nallow=%s\n' "$history" "$version" "$allow" >"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if [[ -f "$file" ]]; then
    mode="$(stat -c %a "$file")" || {
      rm -f "$tmp"
      return 1
    }
  else
    mode=644
  fi
  stage_replace "$tmp" "$file" "$mode"
}

# version — тег, для которого записан допуск. allow — только более старые теги.
schema_tag_ok() {
  local file="$1" tag="$2" finished="$3" history version allow
  [[ -f "$file" ]] || return 1
  history="$(sorted_csv "$(read_schema_field "$file" history)")"
  finished="$(sorted_csv "$finished")"
  [[ "$history" == "$finished" ]] || return 1
  version="$(read_schema_field "$file" version)"
  if [[ -n "$version" && "$tag" == "$version" ]]; then
    return 0
  fi
  allow="$(read_schema_field "$file" allow)"
  [[ -n "$allow" ]] || return 1
  csv_has "$tag" "$allow"
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  return 0
fi

die() {
  printf '%s\n' "$1" >&2
  exit 1
}

: "${APP_DIR:?APP_DIR}"
[[ -d "$APP_DIR" ]] || die "нет каталога приложения"

MODE="${1:-}"
CANDIDATE="${2:-}"
case "$MODE" in
  release)
    [[ -n "$CANDIDATE" ]] || die "release требует тег"
    tag_valid "$CANDIDATE" || die "тег не vMAJOR.MINOR.PATCH"
    ;;
  rollback)
    [[ -z "$CANDIDATE" ]] || die "rollback не принимает версию"
    ;;
  *)
    die "режим: release <tag> или rollback"
    ;;
esac

cd "$APP_DIR"
exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || die "уже выполняется переключение"

JOURNAL="$APP_DIR/deployed-versions"
ALLOW_FILE="$APP_DIR/schema-allow"
ENV_FILE="$APP_DIR/.env"
HEALTH_SECONDS="${SWITCH_HEALTH_SECONDS:-60}"

compose_at() {
  local version="$1"
  shift
  [[ -n "$version" ]] || version="v0.0.0"
  APP_VERSION="$version" docker compose "$@"
}

image_tag() {
  local maybe="${1##*:}"
  tag_valid "$maybe" || return 1
  printf '%s' "$maybe"
}

read_running() {
  local out service image tag
  API_TAG=""
  WEB_TAG=""
  APP_RUNNING=0
  if ! out="$(compose_at "$ENV_VERSION" ps --status running --format '{{.Service}} {{.Image}}' api web)"; then
    return 1
  fi
  while read -r service image; do
    [[ -n "${service:-}" ]] || continue
    APP_RUNNING=1
    if tag="$(image_tag "$image")"; then
      case "$service" in
        api) API_TAG="$tag" ;;
        web) WEB_TAG="$tag" ;;
      esac
    fi
  done <<<"$out"
}

probe() {
  compose_at "${ENV_VERSION:-}" exec -T "$1" node -e \
    "fetch(process.argv[1],{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))" \
    "$2"
}

health_ok() {
  local start now
  start=$(date +%s)
  while true; do
    if probe api "http://127.0.0.1:3001/api/health" \
      && probe web "http://127.0.0.1:3000/ru" \
      && probe web "http://127.0.0.1:3000/api/health"; then
      return 0
    fi
    now=$(date +%s)
    if ((now - start >= HEALTH_SECONDS)); then
      return 1
    fi
    sleep 2
  done
}

# Запросы к PostgreSQL и каталогам образа. main их не разбирает.
NODE_READ_MIGRATIONS='
const {createRequire}=require("module");
const {Client}=createRequire(require.resolve("@prisma/adapter-pg"))("pg");
(async()=>{
  const client=new Client({connectionString:process.env.DATABASE_URL});
  try { await client.connect(); }
  catch { console.error("db-connect"); process.exit(2); }
  try {
    const result=await client.query("SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations");
    for (const row of result.rows) {
      const done=row.finished_at && !row.rolled_back_at;
      console.log((done?"F ":"U ")+row.migration_name);
    }
  } catch (error) {
    if (error && error.code==="42P01") process.exit(0);
    console.error("db-read");
    process.exit(2);
  } finally {
    await client.end().catch(()=>{});
  }
})();
'

NODE_LIST_MIGRATIONS='
const fs=require("fs");
const path=require("path");
const dir="prisma/migrations";
if (!fs.existsSync(dir)) process.exit(0);
for (const name of fs.readdirSync(dir)) {
  if (fs.statSync(path.join(dir,name)).isDirectory()) console.log(name);
}
'

NODE_LIST_ALLOW='
const fs=require("fs");
const file="prisma/rollback-allow";
if (!fs.existsSync(file)) process.exit(0);
for (const line of fs.readFileSync(file,"utf8").split(/\r?\n/)) {
  if (line.length>0) console.log(line);
}
'

node_in_image() {
  compose_at "$1" run -T --rm --no-deps --entrypoint node api -e "$2"
}

read_db_state() {
  node_in_image "$1" "$NODE_READ_MIGRATIONS"
}

image_migration_names() {
  node_in_image "$1" "$NODE_LIST_MIGRATIONS"
}

image_allow_tags() {
  node_in_image "$1" "$NODE_LIST_ALLOW"
}

parse_db_state() {
  local raw="$1" line kind name
  DB_FINISHED=""
  DB_UNFINISHED=0
  if [[ "$raw" == *$'\n'db-connect || "$raw" == db-connect* || "$raw" == *$'\n'db-read || "$raw" == db-read* ]]; then
    return 1
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    kind="${line%% *}"
    name="${line#* }"
    if [[ "$kind" == "F" ]]; then
      if [[ -n "$DB_FINISHED" ]]; then
        DB_FINISHED+=",$name"
      else
        DB_FINISHED="$name"
      fi
    elif [[ "$kind" == "U" ]]; then
      DB_UNFINISHED=1
    else
      return 1
    fi
  done <<<"$raw"
  DB_FINISHED="$(sorted_csv "$DB_FINISHED")"
}

read_db() {
  local raw
  raw="$(read_db_state "$1")" || return 1
  parse_db_state "$raw"
}

finished_in_image() {
  local finished="$1" raw="$2" names name
  [[ -z "$finished" ]] && return 0
  names="$(printf '%s\n' "$raw" | paste -sd, -)"
  names="$(sorted_csv "$names")"
  finished="$(sorted_csv "$finished")"
  IFS=',' read -ra have <<<"$finished"
  for name in "${have[@]}"; do
    [[ -n "$name" ]] || continue
    csv_has "$name" "$names" || return 1
  done
}

allow_from_image() {
  local tag line csv="" raw
  raw="$(image_allow_tags "$1")" || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    tag="${line//$'\r'/}"
    tag_valid "$tag" || continue
    if [[ -n "$csv" ]]; then
      csv+=",$tag"
    else
      csv="$tag"
    fi
  done <<<"$raw"
  printf '%s' "$csv"
}

permit_tag() {
  local tag="$1"
  read_db "$tag" || return 1
  [[ "$DB_UNFINISHED" -eq 0 ]] || return 1
  schema_tag_ok "$ALLOW_FILE" "$tag" "$DB_FINISHED"
}

up_version() {
  compose_at "$1" up -d --no-deps --pull never api web
}

stop_app() {
  compose_at "${ENV_VERSION:-}" stop api web >/dev/null 2>&1 || true
}

reconcile() {
  if [[ -z "$LAST" && "$APP_RUNNING" -eq 1 ]]; then
    die "неизвестное состояние"
  fi
  if [[ -n "$LAST" && "$API_TAG" == "$LAST" && "$WEB_TAG" == "$LAST" && "$ENV_VERSION" != "$LAST" ]]; then
    write_app_version "$ENV_FILE" "$LAST" || die "не удалось записать .env"
    printf '%s\n' "выровнен только .env, версия не переключалась"
    exit 0
  fi
  if [[ -n "$LAST" && ("$API_TAG" != "$LAST" || "$WEB_TAG" != "$LAST") ]]; then
    permit_tag "$LAST" || die "нужна ручная сверка"
    up_version "$LAST" || die "не удалось восстановить предыдущую версию"
    if health_ok; then
      printf '%s\n' "health пары журнала отвечает"
    else
      printf '%s\n' "health пары журнала не отвечает"
    fi
    printf '%s\n' "выровнены образы по журналу, новая выкладка не выполнялась"
    exit 0
  fi
  if [[ "$MODE" == release && -n "$LAST" && "$API_TAG" == "$LAST" && "$WEB_TAG" == "$LAST" ]]; then
    health_ok || die "текущая пара согласована, но нездорова"
  fi
}

choose_target() {
  local allow
  if [[ "$MODE" == release ]]; then
    TARGET="$(select_release_tag "$CANDIDATE" "$JOURNAL")" || die "тег не выше максимального в журнале"
    return 0
  fi
  [[ -n "$LAST" ]] || die "кандидата нет"
  permit_tag "$LAST" || die "нужна ручная сверка"
  allow="$(read_schema_field "$ALLOW_FILE" allow)"
  TARGET="$(select_rollback_tag "$JOURNAL" "$allow")"
  [[ -n "$TARGET" ]] || die "кандидата нет"
}

apply_migrations() {
  local names allow
  read_db "$TARGET" || die "нужна ручная сверка"
  [[ "$DB_UNFINISHED" -eq 0 ]] || die "нужна ручная сверка"
  names="$(image_migration_names "$TARGET")" || die "нужна ручная сверка"
  finished_in_image "$DB_FINISHED" "$names" || die "нужна ручная сверка"
  if ! compose_at "$TARGET" run -T --rm --no-deps --entrypoint prisma api migrate deploy; then
    die "миграция не выполнена, нужна ручная сверка"
  fi
  read_db "$TARGET" || die "нужна ручная сверка"
  [[ "$DB_UNFINISHED" -eq 0 ]] || die "нужна ручная сверка"
  allow="$(allow_from_image "$TARGET")" || die "нужна ручная сверка"
  write_schema_allow_file "$ALLOW_FILE" "$DB_FINISHED" "$TARGET" "$allow" || die "нужна ручная сверка"
}

restore_after_failure() {
  if [[ "$HAD_JOURNAL" -eq 0 ]]; then
    stop_app
    die "выкладка не удалась, предыдущей рабочей версии не было"
  fi
  permit_tag "$LAST" || die "нужна ручная сверка"
  if ! up_version "$LAST"; then
    die "не удалось восстановить предыдущую версию"
  fi
  if health_ok; then
    die "выкладка не удалась, предыдущая версия восстановлена"
  fi
  die "предыдущие теги запущены, работоспособность не восстановлена"
}

fixate() {
  append_journal_file "$JOURNAL" "$TARGET" || die "фиксация не записана"
  write_app_version "$ENV_FILE" "$TARGET" || die "обрыв между журналом и .env"
  printf '%s\n' "зафиксирована версия $TARGET"
}

main() {
  ENV_VERSION="$(read_app_version "$ENV_FILE")"
  LAST="$(last_tag "$JOURNAL")"
  if ! read_running; then
    die "не удалось прочитать запущенные контейнеры"
  fi
  reconcile
  choose_target
  if ! compose_at "$TARGET" pull api web; then
    die "образы не получены"
  fi
  if [[ "$MODE" == release ]]; then
    apply_migrations
  fi
  HAD_JOURNAL=0
  [[ -n "$LAST" ]] && HAD_JOURNAL=1
  if ! up_version "$TARGET"; then
    restore_after_failure
  fi
  if ! health_ok; then
    restore_after_failure
  fi
  fixate
}

main
