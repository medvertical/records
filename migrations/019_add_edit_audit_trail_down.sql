-- Migration: Rollback Edit Audit Trail
-- Removes edit_audit_trail table
-- Backward migration (DOWN)

-- Drop indexes first
DROP INDEX IF EXISTS "edit_audit_trail_result_idx";
DROP INDEX IF EXISTS "edit_audit_trail_edited_by_idx";
DROP INDEX IF EXISTS "edit_audit_trail_edited_at_idx";
DROP INDEX IF EXISTS "edit_audit_trail_resource_idx";

-- Drop table
DROP TABLE IF EXISTS "edit_audit_trail";

