ALTER TABLE "Folder" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Folder" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Folder_deletedAt_idx" ON "Folder"("deletedAt");
CREATE INDEX "Folder_deletedById_idx" ON "Folder"("deletedById");

ALTER TABLE "Folder" ADD CONSTRAINT "Folder_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
