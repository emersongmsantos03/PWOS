ALTER TABLE "Proposal"
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "services" JSONB,
ADD COLUMN "customerData" JSONB,
ADD COLUMN "signatureData" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Proposal_publicToken_key" ON "Proposal"("publicToken");
