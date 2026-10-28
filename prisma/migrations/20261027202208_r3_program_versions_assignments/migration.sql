-- CreateEnum
CREATE TYPE "ProgramTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgramAssignmentStatus" AS ENUM ('ACTIVE', 'REPLACED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ScheduledWorkoutStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" "FitnessGoal" NOT NULL,
    "status" "ProgramTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" "ProgramAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledWorkout" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "planDayId" TEXT NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "status" "ScheduledWorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "sessionId" TEXT,

    CONSTRAINT "ScheduledWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramTemplate_coachId_status_idx" ON "ProgramTemplate"("coachId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramVersion_templateId_version_key" ON "ProgramVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_planId_key" ON "ProgramAssignment"("planId");

-- CreateIndex
CREATE INDEX "ProgramAssignment_clientId_status_idx" ON "ProgramAssignment"("clientId", "status");

-- CreateIndex
CREATE INDEX "ProgramAssignment_coachId_clientId_createdAt_idx" ON "ProgramAssignment"("coachId", "clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_coachId_idempotencyKey_key" ON "ProgramAssignment"("coachId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledWorkout_sessionId_key" ON "ScheduledWorkout"("sessionId");

-- CreateIndex
CREATE INDEX "ScheduledWorkout_planDayId_scheduledFor_status_idx" ON "ScheduledWorkout"("planDayId", "scheduledFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledWorkout_assignmentId_planDayId_scheduledFor_key" ON "ScheduledWorkout"("assignmentId", "planDayId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ProgramTemplate" ADD CONSTRAINT "ProgramTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledWorkout" ADD CONSTRAINT "ScheduledWorkout_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ProgramAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledWorkout" ADD CONSTRAINT "ScheduledWorkout_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledWorkout" ADD CONSTRAINT "ScheduledWorkout_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
