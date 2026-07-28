CREATE TYPE "FinancialEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');
CREATE TYPE "FinancialAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'CARD');

CREATE TABLE "FinancialAccount" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "institution" TEXT,
  "type" "FinancialAccountType" NOT NULL DEFAULT 'CHECKING',
  "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialCategory" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialEntryType" NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#3b82f6',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialEntry" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "type" "FinancialEntryType" NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "status" "FinancialEntryStatus" NOT NULL DEFAULT 'OPEN',
  "categoryId" UUID,
  "accountId" UUID,
  "clientId" UUID,
  "supplier" TEXT,
  "costCenter" TEXT,
  "documentNumber" TEXT,
  "paymentMethod" TEXT,
  "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  "notes" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialAccount_organizationId_active_idx" ON "FinancialAccount"("organizationId", "active");
CREATE UNIQUE INDEX "FinancialCategory_organizationId_name_type_key" ON "FinancialCategory"("organizationId", "name", "type");
CREATE INDEX "FinancialEntry_organizationId_dueDate_status_idx" ON "FinancialEntry"("organizationId", "dueDate", "status");
CREATE INDEX "FinancialEntry_clientId_idx" ON "FinancialEntry"("clientId");
CREATE INDEX "FinancialEntry_accountId_idx" ON "FinancialEntry"("accountId");
CREATE INDEX "FinancialEntry_categoryId_idx" ON "FinancialEntry"("categoryId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
