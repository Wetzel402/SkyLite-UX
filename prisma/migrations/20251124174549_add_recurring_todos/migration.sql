-- AlterTable
ALTER TABLE "todos" ADD COLUMN     "recurrencePattern" JSONB,
ADD COLUMN     "recurringGroupId" TEXT;
