/*
  Warnings:

  - You are about to drop the column `recurrencePattern` on the `todos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "todos" DROP COLUMN "recurrencePattern",
ADD COLUMN     "rrule" JSONB;
