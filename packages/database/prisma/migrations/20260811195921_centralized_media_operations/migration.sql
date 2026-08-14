-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "document" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "owner" TEXT,
ADD COLUMN     "primaryContactEmail" TEXT,
ADD COLUMN     "primaryContactName" TEXT,
ADD COLUMN     "primaryContactPhone" TEXT,
ADD COLUMN     "segment" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "ExternalAdAccount" ADD COLUMN     "businessPortfolioId" TEXT,
ADD COLUMN     "businessPortfolioName" TEXT,
ADD COLUMN     "clientId" UUID,
ADD COLUMN     "identitySource" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "pageName" TEXT,
ADD COLUMN     "profilePictureUrl" TEXT,
ADD COLUMN     "responsibleId" UUID;

-- AlterTable
ALTER TABLE "ExternalCampaign" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "conversations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cpl" DECIMAL(18,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'BRL',
ADD COLUMN     "dailyBudget" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "frequency" DECIMAL(12,4) NOT NULL DEFAULT 0,
ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "leads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeBudget" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reach" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "spend" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarDataUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "roleLabel" TEXT;

-- CreateTable
CREATE TABLE "CampaignMetricSnapshot" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "since" DATE NOT NULL,
    "until" DATE NOT NULL,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "cpl" DECIMAL(18,2),
    "frequency" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'META_API',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAlert" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "externalKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "accountId" UUID,
    "campaignId" UUID,
    "clientId" UUID,
    "responsibleId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "MediaAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignMetricSnapshot_organizationId_until_idx" ON "CampaignMetricSnapshot"("organizationId", "until");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMetricSnapshot_campaignId_since_until_key" ON "CampaignMetricSnapshot"("campaignId", "since", "until");

-- CreateIndex
CREATE INDEX "MediaAlert_organizationId_responsibleId_active_idx" ON "MediaAlert"("organizationId", "responsibleId", "active");

-- CreateIndex
CREATE INDEX "MediaAlert_organizationId_severity_active_idx" ON "MediaAlert"("organizationId", "severity", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAlert_organizationId_externalKey_key" ON "MediaAlert"("organizationId", "externalKey");

-- CreateIndex
CREATE INDEX "ExternalAdAccount_organizationId_businessPortfolioId_idx" ON "ExternalAdAccount"("organizationId", "businessPortfolioId");

-- CreateIndex
CREATE INDEX "ExternalAdAccount_organizationId_clientId_idx" ON "ExternalAdAccount"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "ExternalAdAccount_organizationId_responsibleId_idx" ON "ExternalAdAccount"("organizationId", "responsibleId");

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAdAccount" ADD CONSTRAINT "ExternalAdAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAdAccount" ADD CONSTRAINT "ExternalAdAccount_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMetricSnapshot" ADD CONSTRAINT "CampaignMetricSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ExternalCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAlert" ADD CONSTRAINT "MediaAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAlert" ADD CONSTRAINT "MediaAlert_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ExternalCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAlert" ADD CONSTRAINT "MediaAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAlert" ADD CONSTRAINT "MediaAlert_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
