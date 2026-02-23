-- CreateEnum
CREATE TYPE "BlueprintStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'SCHEDULED', 'EVENT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'WAITING_HITL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Provider" ADD VALUE 'NOTION';
ALTER TYPE "Provider" ADD VALUE 'LINEAR';
ALTER TYPE "Provider" ADD VALUE 'GITHUB';
ALTER TYPE "Provider" ADD VALUE 'JIRA';
ALTER TYPE "Provider" ADD VALUE 'GCAL';

-- CreateTable
CREATE TABLE "automation_blueprints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workflowId" TEXT,
    "status" "BlueprintStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "TriggerType" NOT NULL DEFAULT 'MANUAL',
    "triggerConfig" JSONB,
    "steps" JSONB NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "triggeredBy" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "stepResults" JSONB,
    "logs" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_blueprints_tenantId_status_idx" ON "automation_blueprints"("tenantId", "status");

-- CreateIndex
CREATE INDEX "automation_runs_tenantId_status_createdAt_idx" ON "automation_runs"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "automation_runs_tenantId_blueprintId_idx" ON "automation_runs"("tenantId", "blueprintId");

-- AddForeignKey
ALTER TABLE "automation_blueprints" ADD CONSTRAINT "automation_blueprints_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "automation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
