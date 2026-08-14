CREATE TYPE "CreativeTaskType" AS ENUM ('CONTENT','DESIGN','VIDEO','WEB','PAID_MEDIA','EMAIL','OTHER');
CREATE TYPE "CreativeTaskStatus" AS ENUM ('TODO','IN_PROGRESS','REVIEW','WAITING_APPROVAL','CHANGES_REQUESTED','APPROVED','SCHEDULED','PUBLISHED','DONE','CANCELLED');
CREATE TYPE "CreativeTaskPriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED','PENDING','APPROVED','CHANGES_REQUESTED');
CREATE TYPE "ApprovalType" AS ENUM ('INTERNAL','CLIENT');
CREATE TYPE "CommentVisibility" AS ENUM ('INTERNAL','CLIENT_VISIBLE');

ALTER TABLE "Task" ADD COLUMN "type" "CreativeTaskType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "subtypeId" UUID,
ADD COLUMN "requestedById" UUID,
ADD COLUMN "parentId" UUID,
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "plannedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Task" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "priority" TYPE "CreativeTaskPriority" USING (CASE WHEN "priority" IN ('LOW','MEDIUM','HIGH','URGENT') THEN "priority" ELSE 'MEDIUM' END)::"CreativeTaskPriority";
ALTER TABLE "Task" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "CreativeTaskStatus" USING (CASE WHEN "status"='BACKLOG' THEN 'TODO' WHEN "status"='WAITING_CLIENT' THEN 'WAITING_APPROVAL' WHEN "status" IN ('TODO','IN_PROGRESS','REVIEW','DONE','CANCELLED') THEN "status" ELSE 'TODO' END)::"CreativeTaskStatus";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';

CREATE TABLE "CreativeTaskSubtype" ("id" UUID NOT NULL,"organizationId" UUID NOT NULL,"type" "CreativeTaskType" NOT NULL,"key" TEXT NOT NULL,"name" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT true,"position" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "CreativeTaskSubtype_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskChecklistItem" ("id" UUID NOT NULL,"taskId" UUID NOT NULL,"title" TEXT NOT NULL,"completed" BOOLEAN NOT NULL DEFAULT false,"completedById" UUID,"completedAt" TIMESTAMP(3),"position" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskComment" ("id" UUID NOT NULL,"taskId" UUID NOT NULL,"userId" UUID NOT NULL,"content" TEXT NOT NULL,"visibility" "CommentVisibility" NOT NULL DEFAULT 'INTERNAL',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"deletedAt" TIMESTAMP(3),CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskAttachment" ("id" UUID NOT NULL,"taskId" UUID NOT NULL,"name" TEXT NOT NULL,"storageKey" TEXT,"url" TEXT,"contentType" TEXT,"sizeBytes" INTEGER,"uploadedById" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskApproval" ("id" UUID NOT NULL,"taskId" UUID NOT NULL,"type" "ApprovalType" NOT NULL,"status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',"requestedById" UUID NOT NULL,"requestedFromId" UUID,"comment" TEXT,"requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"respondedAt" TIMESTAMP(3),"approvedAt" TIMESTAMP(3),CONSTRAINT "TaskApproval_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskActivity" ("id" UUID NOT NULL,"taskId" UUID NOT NULL,"actorUserId" UUID NOT NULL,"action" TEXT NOT NULL,"metadata" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TaskContentDetail" ("taskId" UUID NOT NULL,"platform" TEXT,"format" TEXT,"caption" TEXT,"hashtags" TEXT,"cta" TEXT,"publishAt" TIMESTAMP(3),CONSTRAINT "TaskContentDetail_pkey" PRIMARY KEY ("taskId"));
CREATE TABLE "TaskWebDetail" ("taskId" UUID NOT NULL,"pageUrl" TEXT,"environment" TEXT,"requestedChange" TEXT,"referenceUrl" TEXT,CONSTRAINT "TaskWebDetail_pkey" PRIMARY KEY ("taskId"));

CREATE UNIQUE INDEX "CreativeTaskSubtype_organizationId_key_key" ON "CreativeTaskSubtype"("organizationId","key");
CREATE INDEX "CreativeTaskSubtype_organizationId_type_active_idx" ON "CreativeTaskSubtype"("organizationId","type","active");
CREATE UNIQUE INDEX "TaskChecklistItem_taskId_position_key" ON "TaskChecklistItem"("taskId","position");
CREATE INDEX "TaskChecklistItem_taskId_completed_idx" ON "TaskChecklistItem"("taskId","completed");
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId","createdAt");
CREATE INDEX "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment"("taskId","createdAt");
CREATE INDEX "TaskApproval_taskId_status_idx" ON "TaskApproval"("taskId","status");
CREATE INDEX "TaskApproval_requestedFromId_status_idx" ON "TaskApproval"("requestedFromId","status");
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId","createdAt");
CREATE INDEX "Task_organizationId_clientId_status_idx" ON "Task"("organizationId","clientId","status");
CREATE INDEX "Task_organizationId_type_status_idx" ON "Task"("organizationId","type","status");
CREATE INDEX "Task_organizationId_approvalStatus_idx" ON "Task"("organizationId","approvalStatus");
CREATE INDEX "Task_parentId_idx" ON "Task"("parentId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_subtypeId_fkey" FOREIGN KEY ("subtypeId") REFERENCES "CreativeTaskSubtype"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeTaskSubtype" ADD CONSTRAINT "CreativeTaskSubtype_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskChecklistItem" ADD CONSTRAINT "TaskChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskApproval" ADD CONSTRAINT "TaskApproval_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskApproval" ADD CONSTRAINT "TaskApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskApproval" ADD CONSTRAINT "TaskApproval_requestedFromId_fkey" FOREIGN KEY ("requestedFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaskContentDetail" ADD CONSTRAINT "TaskContentDetail_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskWebDetail" ADD CONSTRAINT "TaskWebDetail_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
