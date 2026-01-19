#!/bin/bash
set -e

echo "Skylite UX - Database Setup"
echo "============================"

# Detect database type from DATABASE_URL
if [[ -z "$DATABASE_URL" ]] || [[ "$DATABASE_URL" == file:* ]]; then
  echo "Database: SQLite"

  # Default SQLite path if not set
  if [[ -z "$DATABASE_URL" ]]; then
    export DATABASE_URL="file:/data/skylite.db"
    echo "Using default path: /data/skylite.db"
  else
    echo "Using path: $DATABASE_URL"
  fi

  # Use SQLite schema
  echo "Copying SQLite schema..."
  cp /app/prisma/schema.sqlite.prisma /app/prisma/schema.prisma

  # Parse file path from DATABASE_URL (strip "file:" prefix and query params)
  DB_FILE_PATH="${DATABASE_URL#file:}"
  DB_FILE_PATH="${DB_FILE_PATH%%\?*}"
  DB_DIR="$(dirname "$DB_FILE_PATH")"

  # Ensure the database directory exists
  echo "Ensuring database directory exists: $DB_DIR"
  mkdir -p "$DB_DIR"

  # Generate Prisma client for SQLite
  echo "Generating Prisma client..."
  npx prisma generate

  # Push schema to database (creates tables if needed)
  echo "Syncing database schema..."
  if [[ "$PRISMA_ACCEPT_DATA_LOSS" == "true" ]]; then
    echo "WARNING: PRISMA_ACCEPT_DATA_LOSS is enabled. Destructive schema changes will be applied automatically."
    npx prisma db push --accept-data-loss
  else
    npx prisma db push
  fi

elif [[ "$DATABASE_URL" == postgresql://* ]]; then
  echo "Database: PostgreSQL"

  # Use PostgreSQL schema
  echo "Copying PostgreSQL schema..."
  cp /app/prisma/schema.postgres.prisma /app/prisma/schema.prisma

  # Generate Prisma client for PostgreSQL
  echo "Generating Prisma client..."
  npx prisma generate

  # PostgreSQL uses migrations
  echo "Running database migrations..."
  npx prisma migrate deploy

else
  echo "ERROR: Invalid DATABASE_URL format"
  echo "Expected: postgresql://... or file:... or empty (defaults to SQLite)"
  exit 1
fi

echo ""
echo "Starting Skylite UX..."
exec node .output/server/index.mjs
