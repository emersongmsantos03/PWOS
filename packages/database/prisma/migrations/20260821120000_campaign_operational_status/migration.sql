ALTER TABLE "ExternalCampaign"
ADD COLUMN "auctionPosition" TEXT,
ADD COLUMN "optimizationStatus" TEXT,
ADD COLUMN "landingPageStatus" TEXT,
ADD COLUMN "landingPageUrl" TEXT,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedBy" UUID;
