-- Add soft-delete metadata for documents while preserving existing files,
-- versions, approvals, favorites, and audit relationships.
ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Document_deletedAt_idx" ON "Document"("deletedAt");
CREATE INDEX "Document_deletedById_idx" ON "Document"("deletedById");

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
