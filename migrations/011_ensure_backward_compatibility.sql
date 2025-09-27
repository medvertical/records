-- Migration: Ensure Backward Compatibility
-- Description: Ensure resource_id field remains available during transition to FHIR identity-based storage
-- Date: 2025-09-26
-- Version: 011

-- Ensure resource_id field remains nullable for backward compatibility
-- (This should already be the case, but let's verify and document it)
ALTER TABLE validation_results 
ALTER COLUMN resource_id DROP NOT NULL;

-- Add comment to document backward compatibility strategy
COMMENT ON COLUMN validation_results.resource_id IS 'Database ID reference to fhir_resources table. Kept for backward compatibility during transition to FHIR identity-based storage. Will be removed in future migration after all code paths are updated.';

-- Create a function to help with dual-mode lookups during transition
CREATE OR REPLACE FUNCTION get_validation_results_dual_mode(
    p_server_id INTEGER,
    p_resource_type TEXT,
    p_fhir_resource_id TEXT,
    p_resource_id INTEGER DEFAULT NULL
) RETURNS TABLE (
    id INTEGER,
    resource_id INTEGER,
    server_id INTEGER,
    resource_type TEXT,
    fhir_resource_id TEXT,
    is_valid BOOLEAN,
    validation_score INTEGER,
    validated_at TIMESTAMP
) AS $$
BEGIN
    -- First try to find by FHIR identity (new method)
    IF p_server_id IS NOT NULL AND p_resource_type IS NOT NULL AND p_fhir_resource_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            vr.id,
            vr.resource_id,
            vr.server_id,
            vr.resource_type,
            vr.fhir_resource_id,
            vr.is_valid,
            vr.validation_score,
            vr.validated_at
        FROM validation_results vr
        WHERE vr.server_id = p_server_id 
          AND vr.resource_type = p_resource_type 
          AND vr.fhir_resource_id = p_fhir_resource_id
        ORDER BY vr.validated_at DESC
        LIMIT 1;
        
        -- If found by FHIR identity, return the result
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- Fallback to database ID lookup (old method) for backward compatibility
    IF p_resource_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            vr.id,
            vr.resource_id,
            vr.server_id,
            vr.resource_type,
            vr.fhir_resource_id,
            vr.is_valid,
            vr.validation_score,
            vr.validated_at
        FROM validation_results vr
        WHERE vr.resource_id = p_resource_id
        ORDER BY vr.validated_at DESC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION get_validation_results_dual_mode IS 'Dual-mode lookup function for validation results. Tries FHIR identity first, falls back to database ID for backward compatibility during transition period.';

-- Create a view for easy access to validation results with both lookup methods
CREATE OR REPLACE VIEW validation_results_with_lookup_info AS
SELECT 
    vr.id,
    vr.resource_id,
    vr.server_id,
    vr.resource_type,
    vr.fhir_resource_id,
    vr.is_valid,
    vr.validation_score,
    vr.validated_at,
    -- Add lookup method indicators
    CASE 
        WHEN vr.server_id IS NOT NULL AND vr.resource_type IS NOT NULL AND vr.fhir_resource_id IS NOT NULL 
        THEN 'fhir_identity'
        WHEN vr.resource_id IS NOT NULL 
        THEN 'database_id'
        ELSE 'unknown'
    END as lookup_method,
    -- Add composite key for FHIR identity
    CONCAT(vr.server_id, ':', vr.resource_type, ':', vr.fhir_resource_id) as fhir_identity_key
FROM validation_results vr;

-- Add comment to the view
COMMENT ON VIEW validation_results_with_lookup_info IS 'View providing validation results with lookup method information and FHIR identity keys for transition period.';

-- Verify the setup
SELECT 
    'Backward compatibility setup complete' as status,
    COUNT(*) as total_validation_results,
    COUNT(CASE WHEN server_id IS NOT NULL AND resource_type IS NOT NULL AND fhir_resource_id IS NOT NULL THEN 1 END) as with_fhir_identity,
    COUNT(CASE WHEN resource_id IS NOT NULL THEN 1 END) as with_database_id,
    COUNT(CASE WHEN server_id IS NOT NULL AND resource_id IS NOT NULL THEN 1 END) as with_both_methods
FROM validation_results;
