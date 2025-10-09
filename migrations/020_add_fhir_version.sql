-- Migration: Add FHIR version tracking to tables
-- Purpose: Enable multi-version FHIR support (R4, R5, R6)
-- Date: 2025-01-09

-- Add fhir_version column to fhir_servers table
-- This stores the detected FHIR version for each connected server
ALTER TABLE fhir_servers 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10);

-- Add fhir_version column to validation_results table
-- This ensures validation results are version-specific
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10);

-- Add fhir_version column to edit_audit_trail table
-- This tracks which FHIR version was used during edits
ALTER TABLE edit_audit_trail 
ADD COLUMN IF NOT EXISTS fhir_version VARCHAR(10);

-- Create index for faster version-based queries
CREATE INDEX IF NOT EXISTS idx_fhir_servers_version 
ON fhir_servers(fhir_version);

CREATE INDEX IF NOT EXISTS idx_validation_results_version 
ON validation_results(fhir_version);

CREATE INDEX IF NOT EXISTS idx_edit_audit_trail_version 
ON edit_audit_trail(fhir_version);

-- Add comment for documentation
COMMENT ON COLUMN fhir_servers.fhir_version IS 'FHIR version (R4, R5, R6) detected from CapabilityStatement';
COMMENT ON COLUMN validation_results.fhir_version IS 'FHIR version used during validation';
COMMENT ON COLUMN edit_audit_trail.fhir_version IS 'FHIR version of edited resource';

