-- AlterTable
ALTER TABLE "chore_completions" ALTER COLUMN "completedAt" DROP NOT NULL,
ALTER COLUMN "completedAt" DROP DEFAULT;
