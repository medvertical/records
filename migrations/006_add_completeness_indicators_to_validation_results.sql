-- Migration: Add completeness indicator fields to validation_results table
-- This migration adds comprehensive completeness tracking capabilities to monitor
-- validation coverage, missing areas, and gaps.

ALTER TABLE validation_results
ADD COLUMN IF NOT EXISTS completeness_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completeness_factors JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS coverage_metrics JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS missing_validation_areas JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS validation_gaps JSONB DEFAULT '[]'::jsonb;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_completeness_score ON validation_results(completeness_score);
CREATE INDEX IF NOT EXISTS idx_validation_results_missing_areas ON validation_results USING GIN(missing_validation_areas);
CREATE INDEX IF NOT EXISTS idx_validation_results_validation_gaps ON validation_results USING GIN(validation_gaps);

-- Add comments for documentation
COMMENT ON COLUMN validation_results.completeness_score IS 'Overall completeness score (0-100) indicating validation coverage';
COMMENT ON COLUMN validation_results.completeness_factors IS 'Individual completeness factors affecting overall completeness score';
COMMENT ON COLUMN validation_results.coverage_metrics IS 'Coverage metrics by aspect, field type, and resource section';
COMMENT ON COLUMN validation_results.missing_validation_areas IS 'Areas that were not validated or are missing';
COMMENT ON COLUMN validation_results.validation_gaps IS 'Specific validation gaps identified during validation';

-- Update existing records with default completeness values
UPDATE validation_results 
SET 
  completeness_score = CASE 
    WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 6 THEN 90
    WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 4 THEN 75
    WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 2 THEN 60
    ELSE 45
  END,
  completeness_factors = jsonb_build_object(
    'aspectCompleteness', CASE 
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 6 THEN 95
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 4 THEN 80
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 2 THEN 65
      ELSE 50
    END,
    'fieldCoverage', CASE WHEN validation_score >= 80 THEN 85 ELSE 70 END,
    'ruleCoverage', CASE WHEN error_count + warning_count = 0 THEN 90 ELSE 75 END,
    'profileCompliance', CASE WHEN validation_score >= 90 THEN 95 ELSE 80 END,
    'terminologyCoverage', CASE 
      WHEN aspect_breakdown ? 'terminology' THEN 85 
      ELSE 60 
    END,
    'referenceCoverage', CASE 
      WHEN aspect_breakdown ? 'reference' THEN 85 
      ELSE 60 
    END,
    'businessRuleCoverage', CASE 
      WHEN aspect_breakdown ? 'businessRule' THEN 85 
      ELSE 60 
    END,
    'metadataCoverage', CASE 
      WHEN aspect_breakdown ? 'metadata' THEN 85 
      ELSE 60 
    END
  ),
  coverage_metrics = jsonb_build_object(
    'overallCoverage', CASE 
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 6 THEN 90
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 4 THEN 75
      WHEN aspect_breakdown IS NOT NULL AND jsonb_array_length(aspect_breakdown::jsonb) >= 2 THEN 60
      ELSE 45
    END,
    'aspectCoverage', CASE 
      WHEN aspect_breakdown IS NOT NULL THEN aspect_breakdown
      ELSE '{}'::jsonb
    END,
    'fieldTypeCoverage', jsonb_build_object(
      'required', jsonb_build_object(
        'coverage', CASE WHEN validation_score >= 80 THEN 90 ELSE 75 END,
        'totalFields', 10,
        'validatedFields', CASE WHEN validation_score >= 80 THEN 9 ELSE 7 END,
        'requiredFields', 10,
        'optionalFields', 5
      ),
      'optional', jsonb_build_object(
        'coverage', CASE WHEN validation_score >= 70 THEN 80 ELSE 60 END,
        'totalFields', 5,
        'validatedFields', CASE WHEN validation_score >= 70 THEN 4 ELSE 3 END,
        'requiredFields', 0,
        'optionalFields', 5
      )
    ),
    'sectionCoverage', jsonb_build_object(
      'core', jsonb_build_object(
        'coverage', CASE WHEN validation_score >= 85 THEN 95 ELSE 80 END,
        'totalSections', 5,
        'validatedSections', CASE WHEN validation_score >= 85 THEN 5 ELSE 4 END,
        'missingSections', '[]'::jsonb
      ),
      'extensions', jsonb_build_object(
        'coverage', CASE WHEN validation_score >= 70 THEN 70 ELSE 50 END,
        'totalSections', 3,
        'validatedSections', CASE WHEN validation_score >= 70 THEN 2 ELSE 1 END,
        'missingSections', CASE WHEN validation_score >= 70 THEN '["custom-extension-1"]'::jsonb ELSE '["custom-extension-1", "custom-extension-2"]'::jsonb END
      )
    )
  ),
  missing_validation_areas = CASE 
    WHEN aspect_breakdown IS NULL OR jsonb_array_length(aspect_breakdown::jsonb) < 6 THEN 
      jsonb_build_array(
        jsonb_build_object(
          'type', 'aspect',
          'identifier', 'missing_aspects',
          'description', 'Some validation aspects are missing',
          'impact', 15,
          'severity', 'medium',
          'reason', 'not_enabled'
        )
      )
    ELSE '[]'::jsonb
  END,
  validation_gaps = CASE 
    WHEN error_count > 0 OR warning_count > 0 THEN
      jsonb_build_array(
        jsonb_build_object(
          'id', 'gap-validation-issues',
          'type', 'incomplete_validation',
          'description', 'Validation issues found that may indicate gaps',
          'path', jsonb_build_array('validation'),
          'severity', CASE WHEN error_count > 0 THEN 'high' ELSE 'medium' END,
          'completenessImpact', CASE WHEN error_count > 0 THEN 15 ELSE 10 END,
          'suggestedFix', 'Review and resolve validation issues',
          'autoResolvable', false,
          'relatedAspect', 'general'
        )
      )
    ELSE '[]'::jsonb
  END
WHERE completeness_score = 0;
