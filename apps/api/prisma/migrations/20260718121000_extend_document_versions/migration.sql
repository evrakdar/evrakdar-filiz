-- Extend DocumentVersion so version file metadata and OCR snapshots are stored
-- in the normalized version table instead of only the active Document JSON tags.

ALTER TABLE "DocumentVersion"
ADD COLUMN "originalFileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "ocrStatus" TEXT,
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "ocrError" TEXT,
ADD COLUMN "ocrSkipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ocrUpdatedAt" TIMESTAMP(3);

UPDATE "DocumentVersion" AS version
SET
  "originalFileName" = document."originalFileName",
  "mimeType" = document."mimeType",
  "ocrStatus" = document."tags"->>'ocrStatus',
  "extractedText" = document."tags"->>'extractedText',
  "ocrError" = document."tags"->>'ocrError',
  "ocrSkipped" = COALESCE((document."tags"->>'ocrSkipped')::boolean, false),
  "ocrUpdatedAt" = CASE
    WHEN document."tags"->>'ocrUpdatedAt' IS NULL THEN NULL
    ELSE (document."tags"->>'ocrUpdatedAt')::timestamp
  END
FROM "Document" AS document
WHERE version."documentId" = document."id";

CREATE INDEX "DocumentVersion_ocrStatus_idx" ON "DocumentVersion"("ocrStatus");
