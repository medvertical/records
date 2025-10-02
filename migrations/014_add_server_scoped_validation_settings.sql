-- Migration: Add server-scoped validation settings
-- This migration adds server_id field to validation_settings table to make engine controls server-scoped

-- Add server_id column to validation_settings table
ALTER TABLE validation_settings 
ADD COLUMN server_id INTEGER REFERENCES fhir_servers(id);

-- Create index for server_id lookups
CREATE INDEX idx_validation_settings_server_id ON validation_settings(server_id);

-- Create composite index for active settings per server
CREATE INDEX idx_validation_settings_server_active ON validation_settings(server_id, is_active) WHERE is_active = true;

-- Update existing records to have server_id = NULL (global settings)
-- This maintains backward compatibility
UPDATE validation_settings SET server_id = NULL WHERE server_id IS NULL;

-- Add comment explaining the change
COMMENT ON COLUMN validation_settings.server_id IS 'Server ID for server-scoped validation settings. NULL means global settings.';
