-- Migration: Add FHIR version to per-aspect validation tables
-- Purpose: Enable version-specific filtering and display in per-aspect validation
-- Task: 2.11 - Store fhirVersion in validation_results table for all validation records
-- Date: 2025-10-09

-- Add fhir_version column to validation_results_per_aspect table
-- This stores the FHIR version (R4, R5, R6) for each validation result
ALTER TABLE validation_results_per_aspect 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10) DEFAULT 'R4';

-- Add fhir_version column to validation_messages table
-- This enables version-specific message filtering
ALTER TABLE validation_messages 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10) DEFAULT 'R4';

-- Add fhir_version column to validation_jobs table if it exists
-- This tracks the FHIR version for batch validation jobs
ALTER TABLE validation_jobs 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10) DEFAULT 'R4';

-- Create composite index for version + aspect queries
-- Enables fast filtering by version and aspect
CREATE INDEX IF NOT EXISTS idx_validation_results_per_aspect_version_aspect 
ON validation_results_per_aspect(fhir_version, aspect);

-- Create index for version-based message queries
CREATE INDEX IF NOT EXISTS idx_validation_messages_version 
ON validation_messages(fhir_version);

-- Create index for version-based job queries
CREATE INDEX IF NOT EXISTS idx_validation_jobs_version 
ON validation_jobs(fhir_version);

-- Add composite index for server + version queries
-- Enables fast retrieval of results for a specific server and version
CREATE INDEX IF NOT EXISTS idx_validation_results_per_aspect_server_version 
ON validation_results_per_aspect(server_id, fhir_version);

-- Add comments for documentation
COMMENT ON COLUMN validation_results_per_aspect.fhir_version IS 'FHIR version (R4, R5, R6) used during validation';
COMMENT ON COLUMN validation_messages.fhir_version IS 'FHIR version for version-specific message filtering';
COMMENT ON COLUMN validation_jobs.fhir_version IS 'FHIR version context for batch validation job';

