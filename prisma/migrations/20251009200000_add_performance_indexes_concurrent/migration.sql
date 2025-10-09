-- Add performance indexes for CalendarEvent queries
-- Using CONCURRENTLY to avoid blocking reads/writes during index creation

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CalendarEvent_start_end_idx"
  ON "calendar_events" ("start","end");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CalendarEvent_status_idx"
  ON "calendar_events" ("status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CalendarEvent_source_start_idx"
  ON "calendar_events" ("sourceId","start");

-- Optional: Convert datetime columns to timestamptz for proper timezone handling
-- Uncomment if you want to convert existing timestamp columns to timestamptz
-- ALTER TABLE "calendar_events"
--   ALTER COLUMN "start" TYPE timestamptz USING "start" AT TIME ZONE 'UTC',
--   ALTER COLUMN "end"   TYPE timestamptz USING "end"   AT TIME ZONE 'UTC';
