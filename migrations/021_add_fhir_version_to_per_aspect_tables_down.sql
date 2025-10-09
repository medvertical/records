-- Rollback Migration: Remove FHIR version from per-aspect validation tables
-- Purpose: Rollback migration 021_add_fhir_version_to_per_aspect_tables.sql
-- Task: 2.11 - Store fhirVersion in validation_results table for all validation records
-- Date: 2025-10-09

-- Drop indexes first
DROP INDEX IF EXISTS idx_validation_results_per_aspect_server_version;
DROP INDEX IF EXISTS idx_validation_jobs_version;
DROP INDEX IF EXISTS idx_validation_messages_version;
DROP INDEX IF EXISTS idx_validation_results_per_aspect_version_aspect;

-- Remove comments
COMMENT ON COLUMN validation_results_per_aspect.fhir_version IS NULL;
COMMENT ON COLUMN validation_messages.fhir_version IS NULL;
COMMENT ON COLUMN validation_jobs.fhir_version IS NULL;

-- Remove fhir_version columns
ALTER TABLE validation_results_per_aspect 
DROP COLUMN IF EXISTS fhir_version;

ALTER TABLE validation_messages 
DROP COLUMN IF EXISTS fhir_version;

ALTER TABLE validation_jobs 
DROP COLUMN IF EXISTS fhir_version;

