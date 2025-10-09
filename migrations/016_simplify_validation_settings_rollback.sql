-- Rollback Migration 016: Simplify Validation Settings Schema
-- This script rolls back the simplified validation settings migration
-- WARNING: This will drop the simplified table and all data in it!

-- ============================================================================
-- 1. Drop the simplified validation settings table
-- ============================================================================

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_validation_settings_simplified_updated_at ON validation_settings_simplified;

-- Drop function
DROP FUNCTION IF EXISTS update_validation_settings_simplified_updated_at();

-- Drop table (this will also drop all indexes and constraints)
DROP TABLE IF EXISTS validation_settings_simplified;

-- ============================================================================
-- 2. Rollback complete
-- ============================================================================

-- Note: The original validation_settings and validation_settings_audit_trail tables
-- should still exist and contain the original data

