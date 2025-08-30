-- Migration: Rock Solid Validation Settings
-- Description: Refactor validation_settings table to use new rock-solid schema
-- Date: 2025-01-XX
-- Version: 1.0

-- Step 1: Create the new validation_settings table with rock-solid schema
CREATE TABLE IF NOT EXISTS validation_settings_new (
    id SERIAL PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 1,
    settings JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255)
);

-- Step 2: Create legacy table to preserve old data
CREATE TABLE IF NOT EXISTS legacy_validation_settings (
    id SERIAL PRIMARY KEY,
    enable_structural_validation BOOLEAN DEFAULT true,
    enable_profile_validation BOOLEAN DEFAULT true,
    enable_terminology_validation BOOLEAN DEFAULT true,
    enable_reference_validation BOOLEAN DEFAULT true,
    enable_business_rule_validation BOOLEAN DEFAULT true,
    enable_metadata_validation BOOLEAN DEFAULT true,
    strict_mode BOOLEAN DEFAULT false,
    validation_profiles JSONB DEFAULT '[]',
    terminology_servers JSONB DEFAULT '[]',
    profile_resolution_servers JSONB DEFAULT '[]',
    config JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Migrate existing data from old table to legacy table
INSERT INTO legacy_validation_settings (
    enable_structural_validation,
    enable_profile_validation,
    enable_terminology_validation,
    enable_reference_validation,
    enable_business_rule_validation,
    enable_metadata_validation,
    strict_mode,
    validation_profiles,
    terminology_servers,
    profile_resolution_servers,
    config,
    updated_at
)
SELECT 
    enable_structural_validation,
    enable_profile_validation,
    enable_terminology_validation,
    enable_reference_validation,
    enable_business_rule_validation,
    enable_metadata_validation,
    strict_mode,
    validation_profiles,
    terminology_servers,
    profile_resolution_servers,
    config,
    updated_at
FROM validation_settings
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'validation_settings');

-- Step 4: Create default settings in new format
INSERT INTO validation_settings_new (version, settings, is_active, created_by)
VALUES (
    1,
    '{
        "structural": {
            "enabled": true,
            "severity": "error",
            "timeoutMs": 30000,
            "failFast": false
        },
        "profile": {
            "enabled": true,
            "severity": "warning",
            "timeoutMs": 45000,
            "failFast": false
        },
        "terminology": {
            "enabled": true,
            "severity": "warning",
            "timeoutMs": 60000,
            "failFast": false
        },
        "reference": {
            "enabled": true,
            "severity": "error",
            "timeoutMs": 30000,
            "failFast": false
        },
        "businessRule": {
            "enabled": true,
            "severity": "warning",
            "timeoutMs": 30000,
            "failFast": false
        },
        "metadata": {
            "enabled": true,
            "severity": "information",
            "timeoutMs": 15000,
            "failFast": false
        },
        "strictMode": false,
        "defaultSeverity": "warning",
        "includeDebugInfo": false,
        "validateAgainstBaseSpec": true,
        "fhirVersion": "R4",
        "terminologyServers": [],
        "profileResolutionServers": [],
        "cacheSettings": {
            "enabled": true,
            "ttlMs": 300000,
            "maxSizeMB": 100,
            "cacheValidationResults": true,
            "cacheTerminologyExpansions": true,
            "cacheProfileResolutions": true
        },
        "timeoutSettings": {
            "defaultTimeoutMs": 30000,
            "structuralValidationTimeoutMs": 30000,
            "profileValidationTimeoutMs": 45000,
            "terminologyValidationTimeoutMs": 60000,
            "referenceValidationTimeoutMs": 30000,
            "businessRuleValidationTimeoutMs": 30000,
            "metadataValidationTimeoutMs": 15000
        },
        "maxConcurrentValidations": 10,
        "useParallelValidation": true,
        "customRules": [],
        "validateExternalReferences": false,
        "validateNonExistentReferences": true,
        "validateReferenceTypes": true
    }'::jsonb,
    true,
    'migration'
);

-- Step 5: Drop the old table and rename the new one
DROP TABLE IF EXISTS validation_settings;
ALTER TABLE validation_settings_new RENAME TO validation_settings;

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_validation_settings_active ON validation_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_validation_settings_version ON validation_settings(version);
CREATE INDEX IF NOT EXISTS idx_validation_settings_created_at ON validation_settings(created_at);
CREATE INDEX IF NOT EXISTS idx_validation_settings_updated_at ON validation_settings(updated_at);

-- Step 7: Create a view for backward compatibility (optional)
CREATE OR REPLACE VIEW validation_settings_legacy AS
SELECT 
    id,
    (settings->'structural'->>'enabled')::boolean as enable_structural_validation,
    (settings->'profile'->>'enabled')::boolean as enable_profile_validation,
    (settings->'terminology'->>'enabled')::boolean as enable_terminology_validation,
    (settings->'reference'->>'enabled')::boolean as enable_reference_validation,
    (settings->'businessRule'->>'enabled')::boolean as enable_business_rule_validation,
    (settings->'metadata'->>'enabled')::boolean as enable_metadata_validation,
    (settings->>'strictMode')::boolean as strict_mode,
    COALESCE(settings->'terminologyServers', '[]'::jsonb) as terminology_servers,
    COALESCE(settings->'profileResolutionServers', '[]'::jsonb) as profile_resolution_servers,
    COALESCE(settings->'customRules', '[]'::jsonb) as validation_profiles,
    '{}'::jsonb as config,
    updated_at
FROM validation_settings
WHERE is_active = true;

-- Step 8: Add comments for documentation
COMMENT ON TABLE validation_settings IS 'Rock-solid validation settings with versioning and audit trail';
COMMENT ON COLUMN validation_settings.version IS 'Version number for this settings configuration';
COMMENT ON COLUMN validation_settings.settings IS 'Complete validation settings in JSONB format';
COMMENT ON COLUMN validation_settings.is_active IS 'Whether this settings configuration is currently active';
COMMENT ON COLUMN validation_settings.created_by IS 'User who created this settings configuration';
COMMENT ON COLUMN validation_settings.updated_by IS 'User who last updated this settings configuration';

COMMENT ON TABLE legacy_validation_settings IS 'Legacy validation settings preserved for migration reference';
COMMENT ON VIEW validation_settings_legacy IS 'Backward compatibility view for legacy validation settings format';
