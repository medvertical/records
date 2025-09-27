-- Migration: Populate FHIR Identity Fields
-- Description: Populate server_id, resource_type, and fhir_resource_id fields from existing data
-- Date: 2025-09-26
-- Version: 010

-- Update validation_results with FHIR identity data from fhir_resources table
UPDATE validation_results 
SET 
  server_id = fr.server_id,
  resource_type = fr.resource_type,
  fhir_resource_id = fr.resource_id
FROM fhir_resources fr
WHERE validation_results.resource_id = fr.id
  AND validation_results.server_id IS NULL;

-- Log the number of records updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % validation results with FHIR identity data', updated_count;
END $$;

-- Verify the migration by checking for any remaining NULL values
SELECT 
    COUNT(*) as total_validation_results,
    COUNT(server_id) as with_server_id,
    COUNT(resource_type) as with_resource_type,
    COUNT(fhir_resource_id) as with_fhir_resource_id,
    COUNT(*) - COUNT(server_id) as missing_server_id,
    COUNT(*) - COUNT(resource_type) as missing_resource_type,
    COUNT(*) - COUNT(fhir_resource_id) as missing_fhir_resource_id
FROM validation_results;

-- Check for any validation results that couldn't be matched to fhir_resources
SELECT 
    vr.id as validation_result_id,
    vr.resource_id as old_resource_id,
    vr.server_id,
    vr.resource_type,
    vr.fhir_resource_id
FROM validation_results vr
WHERE vr.resource_id IS NOT NULL 
  AND vr.server_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM fhir_resources fr 
    WHERE fr.id = vr.resource_id
  );

-- Add constraints to ensure data integrity after population
ALTER TABLE validation_results 
ALTER COLUMN server_id DROP DEFAULT,
ALTER COLUMN resource_type DROP DEFAULT,
ALTER COLUMN fhir_resource_id DROP DEFAULT;

-- Add NOT NULL constraints for new fields (only if all records have been populated)
-- Note: Uncomment these lines only after verifying the migration was successful
-- ALTER TABLE validation_results ALTER COLUMN server_id SET NOT NULL;
-- ALTER TABLE validation_results ALTER COLUMN resource_type SET NOT NULL;
-- ALTER TABLE validation_results ALTER COLUMN fhir_resource_id SET NOT NULL;
