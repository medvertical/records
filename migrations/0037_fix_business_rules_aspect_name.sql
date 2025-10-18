-- Migration: Fix businessRules aspect name to businessRule
-- Date: 2025-01-20
-- Description: Updates aspect column from 'businessRules' (plural) to 'businessRule' (singular)
--             to match the canonical schema definition and prevent UI duplication.

-- Update validation_results_per_aspect table
UPDATE validation_results_per_aspect
SET aspect = 'businessRule'
WHERE aspect = 'businessRules';

-- Update validation_messages table
UPDATE validation_messages
SET aspect = 'businessRule'
WHERE aspect = 'businessRules';

-- Update validation_message_groups table
UPDATE validation_message_groups
SET aspect = 'businessRule'
WHERE aspect = 'businessRules';

-- Add comment to track this migration
COMMENT ON COLUMN validation_results_per_aspect.aspect IS 'Validation aspect: structural | profile | terminology | reference | businessRule | metadata (singular form)';
COMMENT ON COLUMN validation_messages.aspect IS 'Validation aspect: structural | profile | terminology | reference | businessRule | metadata (singular form)';
COMMENT ON COLUMN validation_message_groups.aspect IS 'Validation aspect: structural | profile | terminology | reference | businessRule | metadata (singular form)';

