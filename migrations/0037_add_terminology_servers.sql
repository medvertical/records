-- Add terminology_servers column to validation_settings table
ALTER TABLE validation_settings 
ADD COLUMN terminology_servers jsonb DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN validation_settings.terminology_servers IS 'List of terminology servers for code validation';

