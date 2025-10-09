-- CreateTable
CREATE TABLE "calendar_sources" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "writePolicy" TEXT NOT NULL DEFAULT 'none',
    "serverUrl" TEXT,
    "username" TEXT,
    "password" TEXT,
    "etag" TEXT,
    "ctag" TEXT,
    "syncToken" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_audit" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "sourceId" TEXT,
    "op" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_tombstones" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_tombstones_pkey" PRIMARY KEY ("id")
);

-- Drop existing calendar_events table and recreate with new schema
DROP TABLE IF EXISTS "calendar_events" CASCADE;

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "uid" TEXT,
    "recurrenceId" TEXT,
    "lastRemoteEtag" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_events_sourceId_uid_start_end_idx" ON "calendar_events"("sourceId", "uid", "start", "end");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_sourceId_uid_recurrenceId_start_end_key" ON "calendar_events"("sourceId", "uid", "recurrenceId", "start", "end");

-- CreateIndex
CREATE INDEX "calendar_audit_sourceId_at_idx" ON "calendar_audit"("sourceId", "at");

-- CreateIndex
CREATE INDEX "calendar_tombstones_sourceId_deletedAt_idx" ON "calendar_tombstones"("sourceId", "deletedAt");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "calendar_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event_users" ADD CONSTRAINT "calendar_event_users_calendarEventId_fkey" FOREIGN KEY ("calendarEventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;



