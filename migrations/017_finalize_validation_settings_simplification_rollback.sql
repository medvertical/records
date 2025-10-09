-- Rollback Migration 017: Finalize Validation Settings Simplification
-- This script rolls back the finalization of validation settings simplification
-- WARNING: This will restore the old complex schema!

-- ============================================================================
-- 1. Restore old validation_settings table structure
-- ============================================================================

-- Drop the simplified table
DROP TABLE IF EXISTS validation_settings CASCADE;

-- Recreate the old complex validation_settings table
CREATE TABLE validation_settings (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES fhir_servers(id),
  version INTEGER NOT NULL DEFAULT 1,
  settings JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT
);

-- Recreate the audit trail table
CREATE TABLE validation_settings_audit_trail (
  id SERIAL PRIMARY KEY,
  settings_id INTEGER REFERENCES validation_settings(id),
  version INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'activated', 'deactivated', 'deleted', 'migrated', 'rolled_back'
  performed_by TEXT,
  performed_at TIMESTAMP DEFAULT NOW(),
  change_reason TEXT,
  changes JSONB NOT NULL, -- Detailed change information
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT
);

-- ============================================================================
-- 2. Restore data from backup if available
-- ============================================================================

-- If backup table exists, restore data
INSERT INTO validation_settings 
SELECT * FROM validation_settings_backup 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'validation_settings_backup');

-- ============================================================================
-- 3. Recreate indexes and constraints
-- ============================================================================

-- Create indexes for validation_settings
CREATE INDEX idx_validation_settings_server_id ON validation_settings(server_id);
CREATE INDEX idx_validation_settings_active ON validation_settings(is_active);
CREATE INDEX idx_validation_settings_updated_at ON validation_settings(updated_at);
CREATE INDEX idx_validation_settings_version ON validation_settings(version);

-- Create indexes for audit trail
CREATE INDEX idx_validation_settings_audit_trail_settings_id ON validation_settings_audit_trail(settings_id);
CREATE INDEX idx_validation_settings_audit_trail_action ON validation_settings_audit_trail(action);
CREATE INDEX idx_validation_settings_audit_trail_performed_at ON validation_settings_audit_trail(performed_at);

-- ============================================================================
-- 4. Recreate triggers
-- ============================================================================

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_validation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_validation_settings_updated_at
  BEFORE UPDATE ON validation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_settings_updated_at();

-- ============================================================================
-- 5. Restore foreign key constraints
-- ============================================================================

-- Add back the foreign key constraint for validation_results
ALTER TABLE validation_results 
ADD CONSTRAINT validation_results_validation_settings_id_fkey 
FOREIGN KEY (validation_settings_id) REFERENCES validation_settings(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. Add table comments
-- ============================================================================

COMMENT ON TABLE validation_settings IS 'Complex validation settings with versioning, audit trails, and advanced configurations';
COMMENT ON TABLE validation_settings_audit_trail IS 'Audit trail for validation settings changes';

-- ============================================================================
-- 7. Clean up backup table
-- ============================================================================

-- Drop backup table
DROP TABLE IF EXISTS validation_settings_backup;

-- ============================================================================
-- 8. Rollback complete
-- ============================================================================

-- The old complex validation_settings schema has been restored
-- All simplified features have been removed

