-- Migration: Rollback FHIR Identity Migration
-- Description: Rollback script to revert FHIR identity-based storage changes and restore original database ID-based approach
-- Date: 2025-09-26
-- Version: 012
-- WARNING: This script will remove FHIR identity fields and restore the original validation storage architecture

-- Step 1: Verify current state before rollback
DO $$
DECLARE
    fhir_identity_count INT;
    total_validation_results INT;
BEGIN
    -- Count validation results with FHIR identity
    SELECT COUNT(*) INTO fhir_identity_count
    FROM validation_results 
    WHERE server_id IS NOT NULL AND resource_type IS NOT NULL AND fhir_resource_id IS NOT NULL;
    
    -- Count total validation results
    SELECT COUNT(*) INTO total_validation_results
    FROM validation_results;
    
    RAISE NOTICE 'Rollback verification: % validation results with FHIR identity out of % total', 
        fhir_identity_count, total_validation_results;
    
    -- Warn if there are validation results that would lose FHIR identity data
    IF fhir_identity_count > 0 THEN
        RAISE WARNING 'Rollback will remove FHIR identity data from % validation results. Ensure this is intentional.', fhir_identity_count;
    END IF;
END $$;

-- Step 2: Drop helper functions and views created during migration
DROP FUNCTION IF EXISTS get_validation_results_dual_mode(INTEGER, TEXT, TEXT, INTEGER);
DROP VIEW IF EXISTS validation_results_with_lookup_info;

-- Step 3: Drop indexes created for FHIR identity
DROP INDEX IF EXISTS idx_validation_results_fhir_identity;
DROP INDEX IF EXISTS idx_validation_results_server_id;
DROP INDEX IF EXISTS idx_validation_results_fhir_resource_id;

-- Step 4: Remove FHIR identity columns from validation_results table
-- Note: This will permanently remove the FHIR identity data
ALTER TABLE validation_results 
DROP COLUMN IF EXISTS server_id,
DROP COLUMN IF EXISTS fhir_resource_id;

-- Note: resource_type column is kept as it was part of the original schema
-- If it was added during migration, uncomment the line below:
-- ALTER TABLE validation_results DROP COLUMN IF EXISTS resource_type;

-- Step 5: Restore original constraints and indexes
-- Ensure resource_id is not null (original constraint)
ALTER TABLE validation_results 
ALTER COLUMN resource_id SET NOT NULL;

-- Recreate original indexes if they were dropped
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_id ON validation_results (resource_id);

-- Step 6: Verify rollback completion
DO $$
DECLARE
    remaining_fhir_fields INT;
    total_validation_results INT;
    resource_id_nulls INT;
BEGIN
    -- Check if any FHIR identity fields remain
    SELECT COUNT(*) INTO remaining_fhir_fields
    FROM information_schema.columns 
    WHERE table_name = 'validation_results' 
    AND column_name IN ('server_id', 'fhir_resource_id');
    
    -- Count total validation results
    SELECT COUNT(*) INTO total_validation_results
    FROM validation_results;
    
    -- Count validation results with null resource_id
    SELECT COUNT(*) INTO resource_id_nulls
    FROM validation_results
    WHERE resource_id IS NULL;
    
    RAISE NOTICE 'Rollback completed:';
    RAISE NOTICE '- FHIR identity fields remaining: %', remaining_fhir_fields;
    RAISE NOTICE '- Total validation results: %', total_validation_results;
    RAISE NOTICE '- Validation results with null resource_id: %', resource_id_nulls;
    
    IF remaining_fhir_fields = 0 THEN
        RAISE NOTICE 'SUCCESS: FHIR identity fields have been removed';
    ELSE
        RAISE WARNING 'WARNING: Some FHIR identity fields may still exist';
    END IF;
    
    IF resource_id_nulls = 0 THEN
        RAISE NOTICE 'SUCCESS: All validation results have valid resource_id';
    ELSE
        RAISE WARNING 'WARNING: % validation results have null resource_id', resource_id_nulls;
    END IF;
END $$;

-- Step 7: Clean up any orphaned validation results
-- Remove validation results that reference non-existent fhir_resources
DELETE FROM validation_results vr
WHERE NOT EXISTS (
    SELECT 1 FROM fhir_resources fr 
    WHERE fr.id = vr.resource_id
);

-- Log the number of cleaned up orphaned records
DO $$
DECLARE
    cleaned_count INT;
BEGIN
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RAISE NOTICE 'Cleaned up % orphaned validation results', cleaned_count;
END $$;

-- Step 8: Final verification
SELECT 
    'Rollback verification complete' as status,
    COUNT(*) as total_validation_results,
    COUNT(CASE WHEN resource_id IS NOT NULL THEN 1 END) as with_resource_id,
    COUNT(CASE WHEN resource_id IS NULL THEN 1 END) as without_resource_id
FROM validation_results;

-- Step 9: Display final schema state
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'validation_results' 
ORDER BY ordinal_position;
