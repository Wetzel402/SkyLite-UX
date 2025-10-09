-- Convert timestamp columns to timestamptz for proper timezone handling
-- This migration is safe and can be run multiple times

-- Convert start and end columns to timestamptz
ALTER TABLE "calendar_events"
  ALTER COLUMN "start" TYPE timestamptz USING "start" AT TIME ZONE 'UTC',
  ALTER COLUMN "end" TYPE timestamptz USING "end" AT TIME ZONE 'UTC';

-- Update the audit table timestamps as well
ALTER TABLE "calendar_audit"
  ALTER COLUMN "at" TYPE timestamptz USING "at" AT TIME ZONE 'UTC';

-- Update the tombstone table timestamps
ALTER TABLE "calendar_tombstones"
  ALTER COLUMN "deletedAt" TYPE timestamptz USING "deletedAt" AT TIME ZONE 'UTC';
