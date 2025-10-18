-- Migration: Add auto-revalidation settings to validation_settings table
-- Description: Adds columns for auto-revalidation on version change and list view polling configuration

-- Add auto-revalidation settings columns
ALTER TABLE validation_settings 
ADD COLUMN IF NOT EXISTS auto_revalidate_after_edit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_revalidate_on_version_change BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS list_view_polling_interval INTEGER DEFAULT 30000;

-- Update existing records to have the new default values
UPDATE validation_settings 
SET 
  auto_revalidate_after_edit = COALESCE(auto_revalidate_after_edit, false),
  auto_revalidate_on_version_change = COALESCE(auto_revalidate_on_version_change, true),
  list_view_polling_interval = COALESCE(list_view_polling_interval, 30000)
WHERE auto_revalidate_on_version_change IS NULL 
   OR list_view_polling_interval IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN validation_settings.auto_revalidate_after_edit IS 'Automatically revalidate resources after they are edited';
COMMENT ON COLUMN validation_settings.auto_revalidate_on_version_change IS 'Automatically revalidate resources when versionId changes in list view (default: true)';
COMMENT ON COLUMN validation_settings.list_view_polling_interval IS 'Polling interval for list view in milliseconds (default: 30000, range: 10000-300000)';

