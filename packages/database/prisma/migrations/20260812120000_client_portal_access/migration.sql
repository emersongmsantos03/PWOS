ALTER TABLE "User" ADD COLUMN "clientId" UUID;

CREATE INDEX "User_organizationId_clientId_idx" ON "User"("organizationId", "clientId");

ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
