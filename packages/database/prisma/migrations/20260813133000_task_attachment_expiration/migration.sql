ALTER TABLE "TaskAttachment"
ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "TaskAttachment_expiresAt_idx" ON "TaskAttachment"("expiresAt");
