-- Migration: Add confidence scoring fields to validation_results table
-- This migration adds comprehensive confidence scoring capabilities to track
-- validation result reliability and trustworthiness.

ALTER TABLE validation_results
ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence_factors JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS confidence_issues JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS validation_certainty INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_confidence_score ON validation_results(confidence_score);
CREATE INDEX IF NOT EXISTS idx_validation_results_confidence_level ON validation_results(confidence_level);
CREATE INDEX IF NOT EXISTS idx_validation_results_validation_certainty ON validation_results(validation_certainty);

-- Add comments for documentation
COMMENT ON COLUMN validation_results.confidence_score IS 'Overall confidence score (0-100) indicating validation result reliability';
COMMENT ON COLUMN validation_results.confidence_factors IS 'Individual confidence factors affecting overall confidence score';
COMMENT ON COLUMN validation_results.confidence_level IS 'Confidence level category: very_low, low, medium, high, very_high';
COMMENT ON COLUMN validation_results.confidence_issues IS 'Issues that reduce confidence in validation results';
COMMENT ON COLUMN validation_results.validation_certainty IS 'Certainty level (0-100) of validation result accuracy';

-- Update existing records with default confidence values
UPDATE validation_results 
SET 
  confidence_score = CASE 
    WHEN validation_score >= 90 THEN 85
    WHEN validation_score >= 80 THEN 75
    WHEN validation_score >= 70 THEN 65
    WHEN validation_score >= 60 THEN 55
    ELSE 45
  END,
  confidence_level = CASE 
    WHEN validation_score >= 90 THEN 'high'
    WHEN validation_score >= 80 THEN 'medium'
    WHEN validation_score >= 70 THEN 'medium'
    WHEN validation_score >= 60 THEN 'low'
    ELSE 'very_low'
  END,
  validation_certainty = CASE 
    WHEN validation_score >= 90 THEN 90
    WHEN validation_score >= 80 THEN 80
    WHEN validation_score >= 70 THEN 70
    WHEN validation_score >= 60 THEN 60
    ELSE 50
  END,
  confidence_factors = jsonb_build_object(
    'aspectCompleteness', CASE WHEN aspect_breakdown IS NOT NULL THEN 80 ELSE 60 END,
    'dataSourceQuality', CASE WHEN validation_score >= 80 THEN 85 ELSE 70 END,
    'resultConsistency', 75,
    'ruleCoverage', CASE WHEN error_count + warning_count = 0 THEN 90 ELSE 70 END,
    'historicalAccuracy', 75,
    'engineReliability', 90,
    'resourceComplexity', 80,
    'externalDependencyReliability', 85
  )
WHERE confidence_score = 0;
