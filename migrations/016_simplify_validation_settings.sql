-- Migration 016: Simplify Validation Settings Schema
-- This migration simplifies the validation settings to focus on essential functionality only
-- Removes complex features like audit trails, versioning, and advanced configurations

-- ============================================================================
-- 1. Create new simplified validation_settings table
-- ============================================================================

CREATE TABLE validation_settings_simplified (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES fhir_servers(id) ON DELETE CASCADE,
  
  -- Simplified settings structure
  aspects JSONB NOT NULL DEFAULT '{
    "structural": {"enabled": true, "severity": "error"},
    "profile": {"enabled": true, "severity": "warning"},
    "terminology": {"enabled": true, "severity": "warning"},
    "reference": {"enabled": true, "severity": "error"},
    "businessRules": {"enabled": true, "severity": "error"},
    "metadata": {"enabled": true, "severity": "error"}
  }',
  
  performance JSONB NOT NULL DEFAULT '{
    "maxConcurrent": 5,
    "batchSize": 50
  }',
  
  resource_types JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "includedTypes": [],
    "excludedTypes": []
  }',
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- ============================================================================
-- 2. Migrate existing data from complex to simplified schema
-- ============================================================================

INSERT INTO validation_settings_simplified (
  server_id,
  aspects,
  performance,
  resource_types,
  is_active,
  created_at,
  updated_at,
  created_by,
  updated_by
)
SELECT 
  server_id,
  -- Extract and simplify aspects from complex settings
  COALESCE(
    jsonb_build_object(
      'structural', COALESCE(
        (settings->'aspects'->'structural'),
        '{"enabled": true, "severity": "error"}'::jsonb
      ),
      'profile', COALESCE(
        (settings->'aspects'->'profile'),
        '{"enabled": true, "severity": "warning"}'::jsonb
      ),
      'terminology', COALESCE(
        (settings->'aspects'->'terminology'),
        '{"enabled": true, "severity": "warning"}'::jsonb
      ),
      'reference', COALESCE(
        (settings->'aspects'->'reference'),
        '{"enabled": true, "severity": "error"}'::jsonb
      ),
      'businessRules', COALESCE(
        (settings->'aspects'->'businessRule'),
        (settings->'aspects'->'businessRules'),
        '{"enabled": true, "severity": "error"}'::jsonb
      ),
      'metadata', COALESCE(
        (settings->'aspects'->'metadata'),
        '{"enabled": true, "severity": "error"}'::jsonb
      )
    ),
    '{
      "structural": {"enabled": true, "severity": "error"},
      "profile": {"enabled": true, "severity": "warning"},
      "terminology": {"enabled": true, "severity": "warning"},
      "reference": {"enabled": true, "severity": "error"},
      "businessRules": {"enabled": true, "severity": "error"},
      "metadata": {"enabled": true, "severity": "error"}
    }'::jsonb
  ) as aspects,
  
  -- Extract and simplify performance settings
  COALESCE(
    jsonb_build_object(
      'maxConcurrent', COALESCE(
        (settings->'performance'->'maxConcurrent')::integer,
        (settings->'performance'->'maxConcurrentValidations')::integer,
        5
      ),
      'batchSize', COALESCE(
        (settings->'performance'->'batchSize')::integer,
        (settings->'performance'->'batchProcessing'->'batchSize')::integer,
        50
      )
    ),
    '{"maxConcurrent": 5, "batchSize": 50}'::jsonb
  ) as performance,
  
  -- Extract and simplify resource type settings
  COALESCE(
    jsonb_build_object(
      'enabled', COALESCE(
        (settings->'resourceTypes'->'enabled')::boolean,
        (settings->'resourceTypeFilter'->'enabled')::boolean,
        true
      ),
      'includedTypes', COALESCE(
        (settings->'resourceTypes'->'includedTypes'),
        (settings->'resourceTypeFilter'->'includedTypes'),
        '[]'::jsonb
      ),
      'excludedTypes', COALESCE(
        (settings->'resourceTypes'->'excludedTypes'),
        (settings->'resourceTypeFilter'->'excludedTypes'),
        '[]'::jsonb
      )
    ),
    '{"enabled": true, "includedTypes": [], "excludedTypes": []}'::jsonb
  ) as resource_types,
  
  is_active,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM validation_settings
WHERE is_active = true;

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

CREATE INDEX idx_validation_settings_simplified_server_id ON validation_settings_simplified(server_id);
CREATE INDEX idx_validation_settings_simplified_active ON validation_settings_simplified(is_active);
CREATE INDEX idx_validation_settings_simplified_updated_at ON validation_settings_simplified(updated_at);

-- ============================================================================
-- 4. Add constraints for data integrity
-- ============================================================================

-- Ensure maxConcurrent is within valid range (1-20)
ALTER TABLE validation_settings_simplified 
ADD CONSTRAINT chk_performance_max_concurrent 
CHECK ((performance->>'maxConcurrent')::integer BETWEEN 1 AND 20);

-- Ensure batchSize is within valid range (10-100)
ALTER TABLE validation_settings_simplified 
ADD CONSTRAINT chk_performance_batch_size 
CHECK ((performance->>'batchSize')::integer BETWEEN 10 AND 100);

-- Ensure aspects have required structure
ALTER TABLE validation_settings_simplified 
ADD CONSTRAINT chk_aspects_structure 
CHECK (
  aspects ? 'structural' AND 
  aspects ? 'profile' AND 
  aspects ? 'terminology' AND 
  aspects ? 'reference' AND 
  aspects ? 'businessRules' AND 
  aspects ? 'metadata'
);

-- ============================================================================
-- 5. Create trigger for updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_validation_settings_simplified_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validation_settings_simplified_updated_at
  BEFORE UPDATE ON validation_settings_simplified
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_settings_simplified_updated_at();

-- ============================================================================
-- 6. Add comments for documentation
-- ============================================================================

COMMENT ON TABLE validation_settings_simplified IS 'Simplified validation settings focusing on essential functionality: 6 validation aspects, performance settings, and resource type filtering';
COMMENT ON COLUMN validation_settings_simplified.aspects IS '6 validation aspects: structural, profile, terminology, reference, businessRules, metadata';
COMMENT ON COLUMN validation_settings_simplified.performance IS 'Performance settings: maxConcurrent (1-20), batchSize (10-100)';
COMMENT ON COLUMN validation_settings_simplified.resource_types IS 'Resource type filtering: enabled, includedTypes, excludedTypes';

-- ============================================================================
-- 7. Migration complete - old tables will be dropped in next migration
-- ============================================================================

-- Note: The old validation_settings and validation_settings_audit_trail tables
-- will be dropped in a subsequent migration after confirming the new schema works correctly

