-- CreateEnum
CREATE TYPE "WritePolicy" AS ENUM ('NONE', 'WRITE');

-- Data migration: update existing values before type change
UPDATE "calendar_sources" SET "writePolicy" = 'WRITE' WHERE "writePolicy" = 'read-write';
UPDATE "calendar_sources" SET "writePolicy" = 'NONE' WHERE "writePolicy" = 'read-only';

-- AlterTable
ALTER TABLE "calendar_sources" ALTER COLUMN "writePolicy" DROP DEFAULT;
ALTER TABLE "calendar_sources" ALTER COLUMN "writePolicy" TYPE "WritePolicy" USING "writePolicy"::"WritePolicy";
ALTER TABLE "calendar_sources" ALTER COLUMN "writePolicy" SET DEFAULT 'NONE';
