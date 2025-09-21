-- Migration: Enhanced Validation Results Caching and Persistence
-- Date: January 2025
-- Purpose: Add fields to validation_results table for proper caching, versioning, and persistence

-- Add new columns to validation_results table
ALTER TABLE validation_results 
ADD COLUMN IF NOT EXISTS settings_hash TEXT,
ADD COLUMN IF NOT EXISTS settings_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS resource_hash TEXT,
ADD COLUMN IF NOT EXISTS validation_engine_version TEXT DEFAULT '1.0.0',
ADD COLUMN IF NOT EXISTS performance_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS aspect_breakdown JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS validation_duration_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_id ON validation_results(resource_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_validated_at ON validation_results(validated_at);
CREATE INDEX IF NOT EXISTS idx_validation_results_settings_hash ON validation_results(settings_hash);
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_hash ON validation_results(resource_hash);
CREATE INDEX IF NOT EXISTS idx_validation_results_created_at ON validation_results(created_at);

-- Add composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_settings ON validation_results(resource_id, settings_hash);

-- Update existing records to have created_at = validated_at
UPDATE validation_results 
SET created_at = validated_at 
WHERE created_at IS NULL;

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_validation_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_validation_results_updated_at
    BEFORE UPDATE ON validation_results
    FOR EACH ROW
    EXECUTE FUNCTION update_validation_results_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN validation_results.settings_hash IS 'Hash of validation settings used for this validation';
COMMENT ON COLUMN validation_results.settings_version IS 'Version number of validation settings';
COMMENT ON COLUMN validation_results.resource_hash IS 'Hash of resource content to detect changes';
COMMENT ON COLUMN validation_results.validation_engine_version IS 'Version of validation engine used';
COMMENT ON COLUMN validation_results.performance_metrics IS 'Performance timing data for each validation aspect';
COMMENT ON COLUMN validation_results.aspect_breakdown IS 'Detailed breakdown of validation results by aspect';
COMMENT ON COLUMN validation_results.validation_duration_ms IS 'Total validation time in milliseconds';
COMMENT ON COLUMN validation_results.created_at IS 'When this validation result was created';
COMMENT ON COLUMN validation_results.updated_at IS 'When this validation result was last updated';
