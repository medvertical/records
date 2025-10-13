-- Migration: Add User Preferences Table
-- Description: Add user_preferences table for storing user-specific settings like quick access items
-- Date: 2025-01-XX
-- Version: 1.0

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    quick_access_items JSONB NOT NULL DEFAULT '["Patient", "Observation", "Encounter", "Condition"]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Insert default preferences for the default user
INSERT INTO user_preferences (user_id, quick_access_items) 
VALUES ('default', '["Patient", "Observation", "Encounter", "Condition"]')
ON CONFLICT (user_id) DO NOTHING;
