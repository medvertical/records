-- Migration: Enhanced Validation Settings with Audit Trail and Versioning
-- Description: Add audit trail tables and enhance validation settings schema for comprehensive versioning
-- Date: 2025-01-XX
-- Version: 2.0
-- Dependencies: 001_rock_solid_validation_settings.sql

-- ============================================================================
-- AUDIT TRAIL TABLES
-- ============================================================================

-- Create audit trail table for tracking all settings changes
CREATE TABLE IF NOT EXISTS validation_settings_audit_trail (
    id SERIAL PRIMARY KEY,
    settings_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'activated', 'deactivated', 'deleted', 'migrated', 'rolled_back')),
    performed_by VARCHAR(255),
    performed_at TIMESTAMP DEFAULT NOW(),
    change_reason TEXT,
    changes JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Foreign key constraint
    CONSTRAINT fk_audit_trail_settings_id 
        FOREIGN KEY (settings_id) 
        REFERENCES validation_settings(id) 
        ON DELETE CASCADE
);

-- Create version tags table for release management
CREATE TABLE IF NOT EXISTS validation_settings_version_tags (
    id SERIAL PRIMARY KEY,
    settings_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    tag VARCHAR(100) NOT NULL,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_version_tags_settings_id 
        FOREIGN KEY (settings_id) 
        REFERENCES validation_settings(id) 
        ON DELETE CASCADE,
    
    -- Unique constraint for tag per version
    CONSTRAINT uk_version_tags_unique 
        UNIQUE (settings_id, version, tag)
);

-- Create migration history table for tracking schema changes
CREATE TABLE IF NOT EXISTS validation_settings_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT NOW(),
    applied_by VARCHAR(255),
    rollback_sql TEXT,
    status VARCHAR(20) DEFAULT 'applied' CHECK (status IN ('applied', 'rolled_back', 'failed')),
    execution_time_ms INTEGER,
    error_message TEXT
);

-- ============================================================================
-- ENHANCED VALIDATION SETTINGS SCHEMA
-- ============================================================================

-- Add new columns to validation_settings table if they don't exist
DO $$ 
BEGIN
    -- Add change tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'change_reason') THEN
        ALTER TABLE validation_settings ADD COLUMN change_reason TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'change_type') THEN
        ALTER TABLE validation_settings ADD COLUMN change_type VARCHAR(50) 
            CHECK (change_type IN ('created', 'updated', 'activated', 'deactivated', 'migrated', 'rolled_back'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'tags') THEN
        ALTER TABLE validation_settings ADD COLUMN tags TEXT[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'metadata') THEN
        ALTER TABLE validation_settings ADD COLUMN metadata JSONB;
    END IF;
    
    -- Add performance tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'last_accessed_at') THEN
        ALTER TABLE validation_settings ADD COLUMN last_accessed_at TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'access_count') THEN
        ALTER TABLE validation_settings ADD COLUMN access_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add validation status columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'is_valid') THEN
        ALTER TABLE validation_settings ADD COLUMN is_valid BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'validation_errors') THEN
        ALTER TABLE validation_settings ADD COLUMN validation_errors JSONB;
    END IF;
    
    -- Add backup and restore tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'backup_id') THEN
        ALTER TABLE validation_settings ADD COLUMN backup_id VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'validation_settings' AND column_name = 'restored_from_backup_id') THEN
        ALTER TABLE validation_settings ADD COLUMN restored_from_backup_id VARCHAR(255);
    END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_audit_trail_settings_id ON validation_settings_audit_trail(settings_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_version ON validation_settings_audit_trail(version);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action ON validation_settings_audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_performed_by ON validation_settings_audit_trail(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_trail_performed_at ON validation_settings_audit_trail(performed_at);
CREATE INDEX IF NOT EXISTS idx_audit_trail_composite ON validation_settings_audit_trail(settings_id, version, action);

-- Version tags indexes
CREATE INDEX IF NOT EXISTS idx_version_tags_settings_id ON validation_settings_version_tags(settings_id);
CREATE INDEX IF NOT EXISTS idx_version_tags_version ON validation_settings_version_tags(version);
CREATE INDEX IF NOT EXISTS idx_version_tags_tag ON validation_settings_version_tags(tag);
CREATE INDEX IF NOT EXISTS idx_version_tags_composite ON validation_settings_version_tags(settings_id, version);

-- Enhanced validation settings indexes
CREATE INDEX IF NOT EXISTS idx_validation_settings_tags ON validation_settings USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_validation_settings_metadata ON validation_settings USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_validation_settings_last_accessed ON validation_settings(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_validation_settings_access_count ON validation_settings(access_count);
CREATE INDEX IF NOT EXISTS idx_validation_settings_is_valid ON validation_settings(is_valid);
CREATE INDEX IF NOT EXISTS idx_validation_settings_backup_id ON validation_settings(backup_id);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC AUDIT TRAIL
-- ============================================================================

-- Function to create audit trail entry
CREATE OR REPLACE FUNCTION create_validation_settings_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Determine the action type
    DECLARE
        action_type VARCHAR(50);
        change_data JSONB;
    BEGIN
        IF TG_OP = 'INSERT' THEN
            action_type := 'created';
            change_data := to_jsonb(NEW);
        ELSIF TG_OP = 'UPDATE' THEN
            action_type := 'updated';
            change_data := jsonb_build_object(
                'old', to_jsonb(OLD),
                'new', to_jsonb(NEW),
                'changes', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(to_jsonb(NEW))
                    WHERE to_jsonb(NEW) ->> key != to_jsonb(OLD) ->> key
                )
            );
        ELSIF TG_OP = 'DELETE' THEN
            action_type := 'deleted';
            change_data := to_jsonb(OLD);
        END IF;
        
        -- Insert audit trail entry
        INSERT INTO validation_settings_audit_trail (
            settings_id,
            version,
            action,
            performed_by,
            change_reason,
            changes,
            metadata
        ) VALUES (
            COALESCE(NEW.id, OLD.id),
            COALESCE(NEW.version, OLD.version),
            action_type,
            COALESCE(NEW.updated_by, OLD.updated_by),
            COALESCE(NEW.change_reason, OLD.change_reason),
            change_data,
            COALESCE(NEW.metadata, OLD.metadata)
        );
        
        RETURN COALESCE(NEW, OLD);
    END;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit trail
DROP TRIGGER IF EXISTS trigger_validation_settings_audit ON validation_settings;
CREATE TRIGGER trigger_validation_settings_audit
    AFTER INSERT OR UPDATE OR DELETE ON validation_settings
    FOR EACH ROW EXECUTE FUNCTION create_validation_settings_audit_entry();

-- ============================================================================
-- FUNCTIONS FOR DATA INTEGRITY VERIFICATION
-- ============================================================================

-- Function to verify settings data integrity
CREATE OR REPLACE FUNCTION verify_validation_settings_integrity()
RETURNS TABLE (
    settings_id INTEGER,
    version INTEGER,
    integrity_issues TEXT[],
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vs.id,
        vs.version,
        ARRAY_AGG(
            CASE 
                WHEN vs.settings IS NULL THEN 'Settings JSON is NULL'
                WHEN vs.settings = '{}'::jsonb THEN 'Settings JSON is empty'
                WHEN NOT (vs.settings ? 'validationAspects') THEN 'Missing validationAspects'
                WHEN NOT (vs.settings ? 'strictMode') THEN 'Missing strictMode'
                WHEN NOT (vs.settings ? 'fhirVersion') THEN 'Missing fhirVersion'
                WHEN vs.version < 1 THEN 'Invalid version number'
                WHEN vs.created_at > vs.updated_at THEN 'Created date is after updated date'
                WHEN vs.is_active AND vs.is_valid = false THEN 'Active settings marked as invalid'
                ELSE NULL
            END
        ) FILTER (WHERE 
            vs.settings IS NULL OR 
            vs.settings = '{}'::jsonb OR 
            NOT (vs.settings ? 'validationAspects') OR 
            NOT (vs.settings ? 'strictMode') OR 
            NOT (vs.settings ? 'fhirVersion') OR 
            vs.version < 1 OR 
            vs.created_at > vs.updated_at OR 
            (vs.is_active AND vs.is_valid = false)
        ) as integrity_issues,
        CASE 
            WHEN vs.settings IS NULL OR 
                 vs.settings = '{}'::jsonb OR 
                 NOT (vs.settings ? 'validationAspects') OR 
                 NOT (vs.settings ? 'strictMode') OR 
                 NOT (vs.settings ? 'fhirVersion') OR 
                 vs.version < 1 OR 
                 vs.created_at > vs.updated_at OR 
                 (vs.is_active AND vs.is_valid = false)
            THEN false
            ELSE true
        END as is_valid
    FROM validation_settings vs
    GROUP BY vs.id, vs.version, vs.settings, vs.strict_mode, vs.fhir_version, vs.created_at, vs.updated_at, vs.is_active, vs.is_valid;
END;
$$ LANGUAGE plpgsql;

-- Function to get settings statistics
CREATE OR REPLACE FUNCTION get_validation_settings_statistics()
RETURNS TABLE (
    total_settings INTEGER,
    active_settings INTEGER,
    total_versions INTEGER,
    average_versions_per_settings NUMERIC,
    last_updated TIMESTAMP,
    integrity_issues_count INTEGER,
    audit_trail_entries INTEGER,
    version_tags_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM validation_settings)::INTEGER as total_settings,
        (SELECT COUNT(*) FROM validation_settings WHERE is_active = true)::INTEGER as active_settings,
        (SELECT COUNT(*) FROM validation_settings)::INTEGER as total_versions,
        (SELECT AVG(version_count) FROM (
            SELECT COUNT(*) as version_count 
            FROM validation_settings 
            GROUP BY id
        ) subq)::NUMERIC as average_versions_per_settings,
        (SELECT MAX(updated_at) FROM validation_settings) as last_updated,
        (SELECT COUNT(*) FROM verify_validation_settings_integrity() WHERE is_valid = false)::INTEGER as integrity_issues_count,
        (SELECT COUNT(*) FROM validation_settings_audit_trail)::INTEGER as audit_trail_entries,
        (SELECT COUNT(*) FROM validation_settings_version_tags)::INTEGER as version_tags_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION STATUS TRACKING
-- ============================================================================

-- Insert this migration into the migrations table
INSERT INTO validation_settings_migrations (
    migration_name,
    version,
    description,
    applied_by,
    status
) VALUES (
    '002_enhanced_validation_settings_audit_trail',
    '2.0',
    'Add audit trail tables and enhance validation settings schema for comprehensive versioning',
    'system',
    'applied'
) ON CONFLICT (migration_name) DO NOTHING;

-- ============================================================================
-- DATA INTEGRITY VERIFICATION
-- ============================================================================

-- Verify existing data integrity
DO $$
DECLARE
    integrity_issues INTEGER;
BEGIN
    SELECT COUNT(*) INTO integrity_issues 
    FROM verify_validation_settings_integrity() 
    WHERE is_valid = false;
    
    IF integrity_issues > 0 THEN
        RAISE WARNING 'Found % integrity issues in validation settings. Run verify_validation_settings_integrity() for details.', integrity_issues;
    ELSE
        RAISE NOTICE 'All validation settings passed integrity verification.';
    END IF;
END $$;

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

-- Add comments for new tables
COMMENT ON TABLE validation_settings_audit_trail IS 'Comprehensive audit trail for all validation settings changes';
COMMENT ON TABLE validation_settings_version_tags IS 'Version tags for release management and version identification';
COMMENT ON TABLE validation_settings_migrations IS 'Migration history and status tracking';

-- Add comments for new columns
COMMENT ON COLUMN validation_settings.change_reason IS 'Reason for the settings change';
COMMENT ON COLUMN validation_settings.change_type IS 'Type of change made to settings';
COMMENT ON COLUMN validation_settings.tags IS 'Tags associated with this version';
COMMENT ON COLUMN validation_settings.metadata IS 'Additional metadata for this version';
COMMENT ON COLUMN validation_settings.last_accessed_at IS 'Last time these settings were accessed';
COMMENT ON COLUMN validation_settings.access_count IS 'Number of times these settings have been accessed';
COMMENT ON COLUMN validation_settings.is_valid IS 'Whether these settings passed validation';
COMMENT ON COLUMN validation_settings.validation_errors IS 'Validation errors if any';
COMMENT ON COLUMN validation_settings.backup_id IS 'Backup identifier if this is from a backup';
COMMENT ON COLUMN validation_settings.restored_from_backup_id IS 'Backup ID this was restored from';

-- Add comments for functions
COMMENT ON FUNCTION verify_validation_settings_integrity() IS 'Verifies data integrity of validation settings';
COMMENT ON FUNCTION get_validation_settings_statistics() IS 'Returns comprehensive statistics about validation settings';

-- ============================================================================
-- ROLLBACK SCRIPT (for reference)
-- ============================================================================

/*
-- ROLLBACK SCRIPT FOR 002_enhanced_validation_settings_audit_trail
-- WARNING: This will remove all audit trail data and new columns

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_validation_settings_audit ON validation_settings;

-- Drop functions
DROP FUNCTION IF EXISTS create_validation_settings_audit_entry();
DROP FUNCTION IF EXISTS verify_validation_settings_integrity();
DROP FUNCTION IF EXISTS get_validation_settings_statistics();

-- Drop indexes
DROP INDEX IF EXISTS idx_audit_trail_settings_id;
DROP INDEX IF EXISTS idx_audit_trail_version;
DROP INDEX IF EXISTS idx_audit_trail_action;
DROP INDEX IF EXISTS idx_audit_trail_performed_by;
DROP INDEX IF EXISTS idx_audit_trail_performed_at;
DROP INDEX IF EXISTS idx_audit_trail_composite;
DROP INDEX IF EXISTS idx_version_tags_settings_id;
DROP INDEX IF EXISTS idx_version_tags_version;
DROP INDEX IF EXISTS idx_version_tags_tag;
DROP INDEX IF EXISTS idx_version_tags_composite;
DROP INDEX IF EXISTS idx_validation_settings_tags;
DROP INDEX IF EXISTS idx_validation_settings_metadata;
DROP INDEX IF EXISTS idx_validation_settings_last_accessed;
DROP INDEX IF EXISTS idx_validation_settings_access_count;
DROP INDEX IF EXISTS idx_validation_settings_is_valid;
DROP INDEX IF EXISTS idx_validation_settings_backup_id;

-- Drop tables
DROP TABLE IF EXISTS validation_settings_audit_trail;
DROP TABLE IF EXISTS validation_settings_version_tags;
DROP TABLE IF EXISTS validation_settings_migrations;

-- Remove new columns (this will lose data!)
ALTER TABLE validation_settings DROP COLUMN IF EXISTS change_reason;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS change_type;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS tags;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS metadata;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS last_accessed_at;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS access_count;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS is_valid;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS validation_errors;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS backup_id;
ALTER TABLE validation_settings DROP COLUMN IF EXISTS restored_from_backup_id;

-- Update migration status
UPDATE validation_settings_migrations 
SET status = 'rolled_back', applied_at = NOW() 
WHERE migration_name = '002_enhanced_validation_settings_audit_trail';
*/
