-- Clear Validation Data Script
-- Run this to clear all per-aspect validation data and start fresh
-- This is recommended after fixing validation persistence issues

-- Start transaction for safety
BEGIN;

-- Show counts before deletion
SELECT 
  'validation_results_per_aspect' as table_name, 
  COUNT(*) as record_count 
FROM validation_results_per_aspect
UNION ALL
SELECT 
  'validation_messages' as table_name, 
  COUNT(*) as record_count 
FROM validation_messages
UNION ALL
SELECT 
  'validation_message_groups' as table_name, 
  COUNT(*) as record_count 
FROM validation_message_groups;

-- Delete all validation data (cascades handled by foreign keys)
DELETE FROM validation_results_per_aspect;
DELETE FROM validation_messages;
DELETE FROM validation_message_groups;

-- Show confirmation
SELECT 
  'Deleted' as status,
  'validation_results_per_aspect' as table_name, 
  COUNT(*) as remaining_records 
FROM validation_results_per_aspect
UNION ALL
SELECT 
  'Deleted' as status,
  'validation_messages' as table_name, 
  COUNT(*) as remaining_records 
FROM validation_messages
UNION ALL
SELECT 
  'Deleted' as status,
  'validation_message_groups' as table_name, 
  COUNT(*) as remaining_records 
FROM validation_message_groups;

-- Commit the transaction
COMMIT;

-- Display success message
SELECT 'Validation data cleared successfully. Resources will be revalidated on next load.' as message;

