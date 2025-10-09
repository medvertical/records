-- Migration 017: Finalize Validation Settings Simplification
-- This migration finalizes the validation settings simplification by:
-- 1. Dropping the old complex validation_settings table
-- 2. Renaming validation_settings_simplified to validation_settings
-- 3. Dropping the audit trail table
-- 4. Updating all references and constraints

-- ============================================================================
-- 1. Backup existing data (optional - for safety)
-- ============================================================================

-- Create backup table of old settings (optional)
CREATE TABLE validation_settings_backup AS 
SELECT * FROM validation_settings WHERE is_active = true;

-- ============================================================================
-- 2. Drop old audit trail table (no longer needed)
-- ============================================================================

DROP TABLE IF EXISTS validation_settings_audit_trail CASCADE;

-- ============================================================================
-- 3. Drop old validation_settings table
-- ============================================================================

-- First, drop any foreign key constraints that reference the old table
ALTER TABLE validation_results DROP CONSTRAINT IF EXISTS validation_results_validation_settings_id_fkey;

-- Drop the old table
DROP TABLE IF EXISTS validation_settings CASCADE;

-- ============================================================================
-- 4. Rename simplified table to main table
-- ============================================================================

-- Rename the simplified table to the main table name
ALTER TABLE validation_settings_simplified RENAME TO validation_settings;

-- ============================================================================
-- 5. Recreate foreign key constraints
-- ============================================================================

-- Add back the foreign key constraint for validation_results
ALTER TABLE validation_results 
ADD CONSTRAINT validation_results_validation_settings_id_fkey 
FOREIGN KEY (validation_settings_id) REFERENCES validation_settings(id) ON DELETE SET NULL;

-- ============================================================================
-- 6. Update indexes and constraints
-- ============================================================================

-- Rename indexes to match new table name
ALTER INDEX idx_validation_settings_simplified_server_id RENAME TO idx_validation_settings_server_id;
ALTER INDEX idx_validation_settings_simplified_active RENAME TO idx_validation_settings_active;
ALTER INDEX idx_validation_settings_simplified_updated_at RENAME TO idx_validation_settings_updated_at;

-- Rename constraints to match new table name
ALTER TABLE validation_settings 
RENAME CONSTRAINT chk_performance_max_concurrent TO chk_validation_settings_performance_max_concurrent;

ALTER TABLE validation_settings 
RENAME CONSTRAINT chk_performance_batch_size TO chk_validation_settings_performance_batch_size;

ALTER TABLE validation_settings 
RENAME CONSTRAINT chk_aspects_structure TO chk_validation_settings_aspects_structure;

-- ============================================================================
-- 7. Update trigger function and trigger
-- ============================================================================

-- Rename the trigger function
ALTER FUNCTION update_validation_settings_simplified_updated_at() 
RENAME TO update_validation_settings_updated_at;

-- Drop and recreate trigger with new name
DROP TRIGGER IF EXISTS trigger_validation_settings_simplified_updated_at ON validation_settings;

CREATE TRIGGER trigger_validation_settings_updated_at
  BEFORE UPDATE ON validation_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_validation_settings_updated_at();

-- ============================================================================
-- 8. Update table comments
-- ============================================================================

COMMENT ON TABLE validation_settings IS 'Validation settings focusing on essential functionality: 6 validation aspects, performance settings, and resource type filtering';
COMMENT ON COLUMN validation_settings.aspects IS '6 validation aspects: structural, profile, terminology, reference, businessRules, metadata';
COMMENT ON COLUMN validation_settings.performance IS 'Performance settings: maxConcurrent (1-20), batchSize (10-100)';
COMMENT ON COLUMN validation_settings.resource_types IS 'Resource type filtering: enabled, includedTypes, excludedTypes';

-- ============================================================================
-- 9. Clean up legacy tables
-- ============================================================================

-- Drop legacy validation settings table if it exists
DROP TABLE IF EXISTS legacy_validation_settings CASCADE;

-- ============================================================================
-- 10. Migration complete
-- ============================================================================

-- The validation_settings table now contains the simplified schema
-- All old complex features (audit trails, versioning, etc.) have been removed
-- The table focuses on the 6 essential validation aspects plus performance and resource type filtering

