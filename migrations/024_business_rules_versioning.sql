-- Migration: Business Rules Versioning Enhancement
-- Task 9.8: Add versioning support to business rules

-- Add versioning columns to business_rules if they don't exist
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS previous_version_id TEXT;
ALTER TABLE business_rules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create rule_version_history table
CREATE TABLE IF NOT EXISTS rule_version_history (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    
    -- Snapshot of rule at this version
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    fhirpath_expression TEXT NOT NULL,
    resource_types JSONB NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled BOOLEAN NOT NULL,
    
    -- Change tracking
    change_description TEXT,
    changed_by TEXT,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Complete snapshot for rollback
    snapshot JSONB
);

-- Create indexes for version history
CREATE INDEX IF NOT EXISTS idx_rule_version_history_rule_id ON rule_version_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_version_history_version ON rule_version_history(version);
CREATE INDEX IF NOT EXISTS idx_rule_version_history_changed_at ON rule_version_history(changed_at);

-- Update existing business_rule_executions to use text IDs if needed
ALTER TABLE business_rule_executions ADD COLUMN IF NOT EXISTS rule_uuid TEXT;

-- Function to create version history entry on update
CREATE OR REPLACE FUNCTION create_rule_version_history()
RETURNS TRIGGER AS $$
DECLARE
    version_id TEXT;
BEGIN
    -- Generate unique version ID
    version_id := gen_random_uuid()::TEXT;
    
    -- Insert version history record
    INSERT INTO rule_version_history (
        id,
        rule_id,
        version,
        name,
        description,
        fhirpath_expression,
        resource_types,
        severity,
        category,
        enabled,
        change_description,
        changed_by,
        changed_at,
        snapshot
    ) VALUES (
        version_id,
        OLD.id,
        OLD.version,
        OLD.name,
        OLD.description,
        OLD.fhirpath_expression,
        OLD.resource_types,
        OLD.severity,
        OLD.category,
        OLD.enabled,
        'Version ' || OLD.version || ' snapshot',
        OLD.updated_by,
        OLD.updated_at,
        to_jsonb(OLD)
    );
    
    -- Update the new row's previous_version_id
    NEW.previous_version_id := version_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for version history
DROP TRIGGER IF EXISTS business_rules_version_trigger ON business_rules;
CREATE TRIGGER business_rules_version_trigger
    BEFORE UPDATE ON business_rules
    FOR EACH ROW
    WHEN (OLD.fhirpath_expression IS DISTINCT FROM NEW.fhirpath_expression 
          OR OLD.name IS DISTINCT FROM NEW.name
          OR OLD.description IS DISTINCT FROM NEW.description
          OR OLD.version IS DISTINCT FROM NEW.version)
    EXECUTE FUNCTION create_rule_version_history();

-- Add index for soft deletes
CREATE INDEX IF NOT EXISTS idx_business_rules_deleted_at ON business_rules(deleted_at);

-- Update existing rules to have UUIDs if using SERIAL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'business_rules' 
        AND column_name = 'id' 
        AND data_type = 'integer'
    ) THEN
        -- Migration logic would go here if needed
        RAISE NOTICE 'Business rules table uses integer IDs - consider migrating to UUIDs';
    END IF;
END $$;

COMMENT ON TABLE rule_version_history IS 'Complete version history of business rule changes for audit and rollback';
COMMENT ON COLUMN rule_version_history.snapshot IS 'Complete JSON snapshot of the rule at this version for rollback capability';
COMMENT ON COLUMN business_rules.version IS 'Semantic version number of the rule (e.g., 1.0.0, 1.1.0)';
COMMENT ON COLUMN business_rules.previous_version_id IS 'Reference to the previous version in rule_version_history table';
COMMENT ON COLUMN business_rules.deleted_at IS 'Soft delete timestamp - NULL means rule is active';


