-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "singletonId" INTEGER NOT NULL DEFAULT 1;

-- Update any existing rows to have singletonId = 1
UPDATE "app_settings" SET "singletonId" = 1;

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_singletonId_key" ON "app_settings"("singletonId");
