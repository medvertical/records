-- Migration: Per-Aspect Validation Storage
-- Rollback migration (DOWN)
-- Drops per-aspect validation tables

-- Drop tables in reverse order (respecting foreign key dependencies)
DROP TABLE IF EXISTS "validation_message_groups";
DROP TABLE IF EXISTS "validation_messages";
DROP TABLE IF EXISTS "validation_results_per_aspect";

-- Note: This rollback does NOT drop the legacy validation_results table
-- Legacy data is preserved for safety
