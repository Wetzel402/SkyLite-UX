-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_home_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "singletonId" INTEGER NOT NULL DEFAULT 1,
    "photosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "photoTransitionSpeed" INTEGER NOT NULL DEFAULT 10000,
    "kenBurnsIntensity" REAL NOT NULL DEFAULT 1.0,
    "weatherEnabled" BOOLEAN NOT NULL DEFAULT true,
    "latitude" REAL,
    "longitude" REAL,
    "temperatureUnit" TEXT NOT NULL DEFAULT 'celsius',
    "clockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "eventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "todosEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mealsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "menuEnabled" BOOLEAN NOT NULL DEFAULT true,
    "countdownEnabled" BOOLEAN NOT NULL DEFAULT false,
    "countdownEventId" TEXT,
    "refreshInterval" REAL NOT NULL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_home_settings" ("clockEnabled", "countdownEnabled", "countdownEventId", "createdAt", "eventsEnabled", "id", "kenBurnsIntensity", "latitude", "longitude", "mealsEnabled", "menuEnabled", "photoTransitionSpeed", "photosEnabled", "singletonId", "temperatureUnit", "todosEnabled", "updatedAt", "weatherEnabled") SELECT "clockEnabled", "countdownEnabled", "countdownEventId", "createdAt", "eventsEnabled", "id", "kenBurnsIntensity", "latitude", "longitude", "mealsEnabled", "menuEnabled", "photoTransitionSpeed", "photosEnabled", "singletonId", "temperatureUnit", "todosEnabled", "updatedAt", "weatherEnabled" FROM "home_settings";
DROP TABLE "home_settings";
ALTER TABLE "new_home_settings" RENAME TO "home_settings";
CREATE UNIQUE INDEX "home_settings_singletonId_key" ON "home_settings"("singletonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
