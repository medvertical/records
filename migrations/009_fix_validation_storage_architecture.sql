-- Migration: Fix Validation Storage Architecture
-- Description: Add FHIR identity fields and composite index to validation_results table
-- Date: 2025-09-26
-- Version: 009

-- Add new FHIR identity fields to validation_results table
ALTER TABLE validation_results 
ADD COLUMN server_id INTEGER REFERENCES fhir_servers(id),
ADD COLUMN fhir_resource_id TEXT NOT NULL DEFAULT '';

-- Create composite index for efficient FHIR identity lookups
CREATE INDEX idx_validation_results_fhir_identity 
ON validation_results (server_id, resource_type, fhir_resource_id);

-- Add index on individual fields for additional query optimization
CREATE INDEX idx_validation_results_server_id ON validation_results (server_id);
CREATE INDEX idx_validation_results_resource_type ON validation_results (resource_type);
CREATE INDEX idx_validation_results_fhir_resource_id ON validation_results (fhir_resource_id);

-- Add comments for documentation
COMMENT ON COLUMN validation_results.server_id IS 'FHIR server ID for stable resource identification';
COMMENT ON COLUMN validation_results.resource_type IS 'FHIR resource type (Patient, Observation, etc.)';
COMMENT ON COLUMN validation_results.fhir_resource_id IS 'FHIR resource ID for stable resource identification';
COMMENT ON INDEX idx_validation_results_fhir_identity IS 'Composite index for efficient FHIR identity-based lookups';

-- Note: resource_id field is kept for backward compatibility during transition
-- It will be removed in a future migration after all code is updated
