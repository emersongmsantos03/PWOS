ALTER TABLE "AuditLog" ADD COLUMN "actorName" TEXT NOT NULL DEFAULT 'Sistema';
ALTER TABLE "AuditLog" ADD COLUMN "path" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditLog" ADD COLUMN "method" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditLog" ADD COLUMN "status" INTEGER NOT NULL DEFAULT 200;
CREATE INDEX "AuditLog_organizationId_targetType_targetId_idx" ON "AuditLog"("organizationId", "targetType", "targetId");
CREATE INDEX "AuditLog_organizationId_actorUserId_createdAt_idx" ON "AuditLog"("organizationId", "actorUserId", "createdAt");
