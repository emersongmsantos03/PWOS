CREATE TABLE "FinancialSupplier" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialSupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialCostCenter" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialCostCenter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAudit" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "entryId" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "actorUserId" UUID,
  "actorName" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialSupplier_organizationId_active_idx" ON "FinancialSupplier"("organizationId", "active");
CREATE INDEX "FinancialSupplier_organizationId_document_idx" ON "FinancialSupplier"("organizationId", "document");
CREATE UNIQUE INDEX "FinancialCostCenter_organizationId_name_key" ON "FinancialCostCenter"("organizationId", "name");
CREATE INDEX "FinancialAudit_organizationId_createdAt_idx" ON "FinancialAudit"("organizationId", "createdAt");
CREATE INDEX "FinancialAudit_entryId_idx" ON "FinancialAudit"("entryId");

ALTER TABLE "FinancialSupplier" ADD CONSTRAINT "FinancialSupplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialCostCenter" ADD CONSTRAINT "FinancialCostCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialAudit" ADD CONSTRAINT "FinancialAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
