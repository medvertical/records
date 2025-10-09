-- Migration: Add Edit Audit Trail
-- Creates table for tracking resource edit history
-- Forward migration (UP)

-- Create edit_audit_trail table
CREATE TABLE IF NOT EXISTS "edit_audit_trail" (
  "id" SERIAL PRIMARY KEY,
  "server_id" INTEGER NOT NULL REFERENCES "fhir_servers"("id") ON DELETE CASCADE,
  "resource_type" TEXT NOT NULL,
  "fhir_id" TEXT NOT NULL,
  "before_hash" VARCHAR(64) NOT NULL,
  "after_hash" VARCHAR(64) NOT NULL,
  "edited_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "edited_by" TEXT DEFAULT 'system',
  "operation" TEXT NOT NULL, -- 'single_edit' | 'batch_edit'
  "result" TEXT NOT NULL, -- 'success' | 'failed'
  "error_message" TEXT,
  "version_before" TEXT,
  "version_after" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for edit_audit_trail
CREATE INDEX IF NOT EXISTS "edit_audit_trail_resource_idx" 
  ON "edit_audit_trail" ("server_id", "resource_type", "fhir_id");

CREATE INDEX IF NOT EXISTS "edit_audit_trail_edited_at_idx" 
  ON "edit_audit_trail" ("edited_at" DESC);

CREATE INDEX IF NOT EXISTS "edit_audit_trail_edited_by_idx" 
  ON "edit_audit_trail" ("edited_by");

CREATE INDEX IF NOT EXISTS "edit_audit_trail_result_idx" 
  ON "edit_audit_trail" ("result");

-- Add comment to table
COMMENT ON TABLE "edit_audit_trail" IS 'Audit trail for resource edits (single and batch)';
COMMENT ON COLUMN "edit_audit_trail"."before_hash" IS 'SHA-256 hash of resource before edit';
COMMENT ON COLUMN "edit_audit_trail"."after_hash" IS 'SHA-256 hash of resource after edit';
COMMENT ON COLUMN "edit_audit_trail"."operation" IS 'Type of edit operation: single_edit or batch_edit';
COMMENT ON COLUMN "edit_audit_trail"."result" IS 'Edit result: success or failed';

