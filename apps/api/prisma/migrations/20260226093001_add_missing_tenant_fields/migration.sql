/*
  Warnings:

  - Added the required column `updatedAt` to the `chat_messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `edges` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `outcome_metrics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `refresh_tokens` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `tenants` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('EPISODIC', 'SEMANTIC', 'WORKING');

-- CreateEnum
CREATE TYPE "ChainStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChainRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "automation_blueprints" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "manager" TEXT,
ADD COLUMN     "persona" TEXT;

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "edges" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "outcome_metrics" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "type" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_chains" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChainStatus" NOT NULL DEFAULT 'DRAFT',
    "nodes" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_chain_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "status" "ChainRunStatus" NOT NULL DEFAULT 'QUEUED',
    "nodeResults" JSONB,
    "inputContext" JSONB,
    "failedAtNode" INTEGER,
    "retryFromNode" INTEGER,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_chain_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_memories_tenantId_blueprintId_type_idx" ON "agent_memories"("tenantId", "blueprintId", "type");

-- CreateIndex
CREATE INDEX "agent_chains_tenantId_status_idx" ON "agent_chains"("tenantId", "status");

-- CreateIndex
CREATE INDEX "agent_chain_runs_tenantId_chainId_status_idx" ON "agent_chain_runs"("tenantId", "chainId", "status");

-- CreateIndex
CREATE INDEX "outcome_metrics_tenantId_runId_idx" ON "outcome_metrics"("tenantId", "runId");

-- CreateIndex
CREATE INDEX "workflows_tenantId_monthlyRuns_idx" ON "workflows"("tenantId", "monthlyRuns");

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "automation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_chains" ADD CONSTRAINT "agent_chains_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_chain_runs" ADD CONSTRAINT "agent_chain_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_chain_runs" ADD CONSTRAINT "agent_chain_runs_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "agent_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
