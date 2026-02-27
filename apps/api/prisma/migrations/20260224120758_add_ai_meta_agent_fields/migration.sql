-- AlterTable
ALTER TABLE "automation_blueprints" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiReasoning" TEXT,
ADD COLUMN     "autoExecute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85;

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN     "aiAnalysis" JSONB,
ADD COLUMN     "aiAnalyzedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "outcome_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "baselineValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outcome_metrics_tenantId_blueprintId_idx" ON "outcome_metrics"("tenantId", "blueprintId");

-- CreateIndex
CREATE INDEX "chat_messages_tenantId_conversationId_createdAt_idx" ON "chat_messages"("tenantId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "outcome_metrics" ADD CONSTRAINT "outcome_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_metrics" ADD CONSTRAINT "outcome_metrics_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "automation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
