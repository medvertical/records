-- Migration: Update Validation Schema for Consolidated Service
-- Date: January 2025
-- Purpose: Update validation_results table to better support consolidated validation service
--          and simplified validation settings

-- Add new columns to support consolidated validation service
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS validation_request_id TEXT,
ADD COLUMN IF NOT EXISTS validation_batch_id TEXT,
ADD COLUMN IF NOT EXISTS validation_priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'completed', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
ADD COLUMN IF NOT EXISTS validation_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS validation_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS validation_cancelled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS validation_error_message TEXT,
ADD COLUMN IF NOT EXISTS validation_error_details JSONB DEFAULT '{}';

-- Add columns for detailed aspect results
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS structural_validation_result JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS profile_validation_result JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS terminology_validation_result JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reference_validation_result JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS business_rule_validation_result JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata_validation_result JSONB DEFAULT '{}';

-- Add columns for validation settings reference
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS validation_settings_id INTEGER REFERENCES validation_settings(id),
ADD COLUMN IF NOT EXISTS validation_settings_snapshot JSONB DEFAULT '{}';

-- Add columns for resource metadata
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS resource_type TEXT,
ADD COLUMN IF NOT EXISTS resource_version TEXT,
ADD COLUMN IF NOT EXISTS resource_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS resource_complexity_score INTEGER DEFAULT 0;

-- Add columns for validation context
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS validation_context JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS validation_environment TEXT DEFAULT 'production', -- 'development', 'testing', 'production'
ADD COLUMN IF NOT EXISTS validation_source TEXT DEFAULT 'api', -- 'api', 'batch', 'scheduled', 'manual'

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_validation_results_request_id ON validation_results(validation_request_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_batch_id ON validation_results(validation_batch_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_priority ON validation_results(validation_priority);
CREATE INDEX IF NOT EXISTS idx_validation_results_status ON validation_results(validation_status);
CREATE INDEX IF NOT EXISTS idx_validation_results_started_at ON validation_results(validation_started_at);
CREATE INDEX IF NOT EXISTS idx_validation_results_completed_at ON validation_results(validation_completed_at);
CREATE INDEX IF NOT EXISTS idx_validation_results_settings_id ON validation_results(validation_settings_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_type ON validation_results(resource_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_environment ON validation_results(validation_environment);
CREATE INDEX IF NOT EXISTS idx_validation_results_source ON validation_results(validation_source);

-- Add composite indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_validation_results_batch_status ON validation_results(validation_batch_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_status ON validation_results(resource_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_validation_results_settings_status ON validation_results(validation_settings_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_validation_results_type_status ON validation_results(resource_type, validation_status);

-- Update existing records to have proper timestamps
UPDATE validation_results 
SET validation_started_at = validated_at,
    validation_completed_at = validated_at,
    validation_status = 'completed'
WHERE validation_started_at IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN validation_results.validation_request_id IS 'Unique identifier for the validation request';
COMMENT ON COLUMN validation_results.validation_batch_id IS 'Identifier for batch validation operations';
COMMENT ON COLUMN validation_results.validation_priority IS 'Priority level of the validation request';
COMMENT ON COLUMN validation_results.validation_status IS 'Current status of the validation process';
COMMENT ON COLUMN validation_results.validation_started_at IS 'When validation started processing';
COMMENT ON COLUMN validation_results.validation_completed_at IS 'When validation completed processing';
COMMENT ON COLUMN validation_results.validation_cancelled_at IS 'When validation was cancelled';
COMMENT ON COLUMN validation_results.validation_error_message IS 'Error message if validation failed';
COMMENT ON COLUMN validation_results.validation_error_details IS 'Detailed error information if validation failed';
COMMENT ON COLUMN validation_results.structural_validation_result IS 'Detailed results from structural validation';
COMMENT ON COLUMN validation_results.profile_validation_result IS 'Detailed results from profile validation';
COMMENT ON COLUMN validation_results.terminology_validation_result IS 'Detailed results from terminology validation';
COMMENT ON COLUMN validation_results.reference_validation_result IS 'Detailed results from reference validation';
COMMENT ON COLUMN validation_results.business_rule_validation_result IS 'Detailed results from business rule validation';
COMMENT ON COLUMN validation_results.metadata_validation_result IS 'Detailed results from metadata validation';
COMMENT ON COLUMN validation_results.validation_settings_id IS 'Reference to validation settings used';
COMMENT ON COLUMN validation_results.validation_settings_snapshot IS 'Snapshot of validation settings at time of validation';
COMMENT ON COLUMN validation_results.resource_type IS 'Type of FHIR resource validated';
COMMENT ON COLUMN validation_results.resource_version IS 'Version of the FHIR resource';
COMMENT ON COLUMN validation_results.resource_size_bytes IS 'Size of the resource in bytes';
COMMENT ON COLUMN validation_results.resource_complexity_score IS 'Complexity score of the resource (0-100)';
COMMENT ON COLUMN validation_results.validation_context IS 'Additional context for the validation';
COMMENT ON COLUMN validation_results.validation_environment IS 'Environment where validation was performed';
COMMENT ON COLUMN validation_results.validation_source IS 'Source that initiated the validation';

-- Create a view for validation results summary
CREATE OR REPLACE VIEW validation_results_summary AS
SELECT 
    vr.id,
    vr.resource_id,
    vr.resource_type,
    vr.is_valid,
    vr.error_count,
    vr.warning_count,
    vr.validation_score,
    vr.confidence_score,
    vr.completeness_score,
    vr.validation_duration_ms,
    vr.validation_status,
    vr.validation_priority,
    vr.validated_at,
    vr.created_at,
    fr.resource_id as fhir_resource_id,
    fr.server_id,
    fs.name as server_name,
    fs.url as server_url
FROM validation_results vr
LEFT JOIN fhir_resources fr ON vr.resource_id = fr.id
LEFT JOIN fhir_servers fs ON fr.server_id = fs.id;

-- Create a view for validation performance metrics
CREATE OR REPLACE VIEW validation_performance_metrics AS
SELECT 
    vr.resource_type,
    vr.validation_status,
    COUNT(*) as total_validations,
    AVG(vr.validation_duration_ms) as avg_duration_ms,
    MIN(vr.validation_duration_ms) as min_duration_ms,
    MAX(vr.validation_duration_ms) as max_duration_ms,
    AVG(vr.validation_score) as avg_validation_score,
    AVG(vr.confidence_score) as avg_confidence_score,
    AVG(vr.completeness_score) as avg_completeness_score,
    COUNT(CASE WHEN vr.is_valid = true THEN 1 END) as valid_count,
    COUNT(CASE WHEN vr.is_valid = false THEN 1 END) as invalid_count,
    COUNT(CASE WHEN vr.error_count > 0 THEN 1 END) as error_count,
    COUNT(CASE WHEN vr.warning_count > 0 THEN 1 END) as warning_count
FROM validation_results vr
WHERE vr.validated_at >= NOW() - INTERVAL '30 days'
GROUP BY vr.resource_type, vr.validation_status;

-- Create a view for validation aspect breakdown
CREATE OR REPLACE VIEW validation_aspect_breakdown AS
SELECT 
    vr.resource_type,
    vr.validation_status,
    COUNT(*) as total_validations,
    COUNT(CASE WHEN (vr.structural_validation_result->>'isValid')::boolean = true THEN 1 END) as structural_valid_count,
    COUNT(CASE WHEN (vr.profile_validation_result->>'isValid')::boolean = true THEN 1 END) as profile_valid_count,
    COUNT(CASE WHEN (vr.terminology_validation_result->>'isValid')::boolean = true THEN 1 END) as terminology_valid_count,
    COUNT(CASE WHEN (vr.reference_validation_result->>'isValid')::boolean = true THEN 1 END) as reference_valid_count,
    COUNT(CASE WHEN (vr.business_rule_validation_result->>'isValid')::boolean = true THEN 1 END) as business_rule_valid_count,
    COUNT(CASE WHEN (vr.metadata_validation_result->>'isValid')::boolean = true THEN 1 END) as metadata_valid_count,
    AVG((vr.structural_validation_result->>'durationMs')::integer) as avg_structural_duration_ms,
    AVG((vr.profile_validation_result->>'durationMs')::integer) as avg_profile_duration_ms,
    AVG((vr.terminology_validation_result->>'durationMs')::integer) as avg_terminology_duration_ms,
    AVG((vr.reference_validation_result->>'durationMs')::integer) as avg_reference_duration_ms,
    AVG((vr.business_rule_validation_result->>'durationMs')::integer) as avg_business_rule_duration_ms,
    AVG((vr.metadata_validation_result->>'durationMs')::integer) as avg_metadata_duration_ms
FROM validation_results vr
WHERE vr.validated_at >= NOW() - INTERVAL '30 days'
GROUP BY vr.resource_type, vr.validation_status;
