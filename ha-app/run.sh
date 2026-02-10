#!/usr/bin/env sh
set -e

OPTIONS_FILE="/data/options.json"
if [ -f "$OPTIONS_FILE" ]; then
  database="$(jq -r '.database // "bundled"' "$OPTIONS_FILE")"
  data_location="$(jq -r '.data_location // "/data"' "$OPTIONS_FILE")"
  TZ_OPT="$(jq -r '.TZ // "America/Chicago"' "$OPTIONS_FILE")"
  log_level="$(jq -r '.log_level // "info"' "$OPTIONS_FILE")"
  DB_HOSTNAME="$(jq -r '.DB_HOSTNAME // ""' "$OPTIONS_FILE")"
  DB_PORT="$(jq -r '.DB_PORT // 5432' "$OPTIONS_FILE")"
  DB_USERNAME="$(jq -r '.DB_USERNAME // ""' "$OPTIONS_FILE")"
  DB_PASSWORD="$(jq -r '.DB_PASSWORD // ""' "$OPTIONS_FILE")"
  DB_DATABASE_NAME="$(jq -r '.DB_DATABASE_NAME // "skylite"' "$OPTIONS_FILE")"
else
  database="bundled"
  data_location="/data"
  TZ_OPT="America/Chicago"
  log_level="info"
  DB_HOSTNAME=""
  DB_PORT="5432"
  DB_USERNAME=""
  DB_PASSWORD=""
  DB_DATABASE_NAME="skylite"
fi

export TZ="$TZ_OPT"
export NUXT_PUBLIC_TZ="$TZ_OPT"
export NUXT_PUBLIC_LOG_LEVEL="$log_level"

if [ "$database" = "bundled" ]; then
  PGDATA="${data_location}/postgres"
  PWFILE="${data_location}/.skylite_db_password"
  if [ ! -f "$PWFILE" ]; then
    mkdir -p "$data_location"
    (od -An -N16 -tx1 /dev/urandom | tr -d ' \n') > "$PWFILE"
  fi
  SKYLITE_PW="$(cat "$PWFILE")"

  if [ ! -d "$PGDATA" ] || [ ! -f "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    su - postgres -c "initdb -D $PGDATA"
    su - postgres -c "pg_ctl -D $PGDATA -l ${PGDATA}/logfile start" || true
    sleep 2
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if su - postgres -c "pg_isready -D $PGDATA" 2>/dev/null; then break; fi
      sleep 1
    done
    su - postgres -c "psql -d postgres -c \"CREATE USER skylite WITH PASSWORD '$SKYLITE_PW';\""
    su - postgres -c "psql -d postgres -c \"CREATE DATABASE skylite OWNER skylite;\""
  else
    su - postgres -c "pg_ctl -D $PGDATA -l ${PGDATA}/logfile start" || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      if su - postgres -c "pg_isready -D $PGDATA" 2>/dev/null; then break; fi
      sleep 1
    done
  fi

  export DATABASE_URL="postgresql://skylite:${SKYLITE_PW}@localhost:5432/skylite"
else
  if [ -n "$DB_HOSTNAME" ] && [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
    export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOSTNAME}:${DB_PORT}/${DB_DATABASE_NAME}"
  else
    echo "External database selected but DB_HOSTNAME, DB_USERNAME or DB_PASSWORD missing." >&2
    exit 1
  fi
fi

cd /app
npx prisma migrate deploy
exec node .output/server/index.mjs
