-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "holidayCountryCode" TEXT NOT NULL DEFAULT 'CA';
ALTER TABLE "app_settings" ADD COLUMN "holidaySubdivisionCode" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "enableHolidayCountdowns" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "holiday_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryCode" TEXT NOT NULL,
    "subdivisionCode" TEXT,
    "holidayName" TEXT NOT NULL,
    "holidayDate" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cachedUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
