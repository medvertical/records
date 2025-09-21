-- Migration: Add retry tracking fields to validation_results table
-- Description: Adds fields to track retry attempts and results for validation failures

-- Add retry tracking columns to validation_results table
ALTER TABLE validation_results 
ADD COLUMN retry_attempt_count INTEGER DEFAULT 0,
ADD COLUMN max_retry_attempts INTEGER DEFAULT 1,
ADD COLUMN is_retry BOOLEAN DEFAULT FALSE,
ADD COLUMN retry_info JSONB DEFAULT '{}',
ADD COLUMN can_retry BOOLEAN DEFAULT TRUE,
ADD COLUMN retry_reason TEXT,
ADD COLUMN total_retry_duration_ms INTEGER DEFAULT 0;

-- Create index on retry_attempt_count for performance
CREATE INDEX IF NOT EXISTS idx_validation_results_retry_attempt_count 
ON validation_results(retry_attempt_count);

-- Create index on is_retry for filtering retried validations
CREATE INDEX IF NOT EXISTS idx_validation_results_is_retry 
ON validation_results(is_retry);

-- Create index on can_retry for finding validations that can be retried
CREATE INDEX IF NOT EXISTS idx_validation_results_can_retry 
ON validation_results(can_retry);

-- Add comments for documentation
COMMENT ON COLUMN validation_results.retry_attempt_count IS 'Number of retry attempts made for this validation';
COMMENT ON COLUMN validation_results.max_retry_attempts IS 'Maximum number of retry attempts allowed';
COMMENT ON COLUMN validation_results.is_retry IS 'Whether this validation was a retry attempt';
COMMENT ON COLUMN validation_results.retry_info IS 'Detailed retry information including previous attempts';
COMMENT ON COLUMN validation_results.can_retry IS 'Whether this validation can still be retried';
COMMENT ON COLUMN validation_results.retry_reason IS 'Reason for retry if applicable';
COMMENT ON COLUMN validation_results.total_retry_duration_ms IS 'Total duration of all retry attempts in milliseconds';
