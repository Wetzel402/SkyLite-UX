-- CreateTable
CREATE TABLE "shift_rotations" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cycleWeeks" INTEGER NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_rotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_slots" (
    "id" TEXT NOT NULL,
    "shiftRotationId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "label" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftRotationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "shift_rotations" ADD CONSTRAINT "shift_rotations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_slots" ADD CONSTRAINT "shift_slots_shiftRotationId_fkey" FOREIGN KEY ("shiftRotationId") REFERENCES "shift_rotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftRotationId_fkey" FOREIGN KEY ("shiftRotationId") REFERENCES "shift_rotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
