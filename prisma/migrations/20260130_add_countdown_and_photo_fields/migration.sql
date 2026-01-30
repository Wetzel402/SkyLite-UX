-- AlterTable: Add countdown fields to todos
ALTER TABLE "todos" ADD COLUMN "isCountdown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "todos" ADD COLUMN "countdownMessage" TEXT;
ALTER TABLE "todos" ADD COLUMN "messageGeneratedAt" DATETIME;

-- AlterTable: Add photo storage fields to selected_albums
ALTER TABLE "selected_albums" ADD COLUMN "localImagePath" TEXT;
ALTER TABLE "selected_albums" ADD COLUMN "downloadedAt" DATETIME;
ALTER TABLE "selected_albums" ADD COLUMN "cachedWidth" INTEGER;
ALTER TABLE "selected_albums" ADD COLUMN "cachedHeight" INTEGER;
