-- Migration: 023_add_app_settings_tables.sql
-- Description: Adds tables for Dashboard and System settings persistence.

CREATE TABLE IF NOT EXISTS dashboard_settings (
    id SERIAL PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{
        "autoRefresh": true,
        "refreshInterval": 30,
        "showResourceStats": true,
        "showValidationProgress": true,
        "showErrorSummary": true,
        "showPerformanceMetrics": false,
        "cardLayout": "grid",
        "theme": "system",
        "autoValidateEnabled": false
    }'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{
        "logLevel": "info",
        "enableAnalytics": false,
        "enableCrashReporting": true,
        "enableSSE": true,
        "dataRetentionDays": 30,
        "maxLogFileSize": 100,
        "enableAutoUpdates": true
    }'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings if tables are newly created and empty
INSERT INTO dashboard_settings (settings)
SELECT '{
    "autoRefresh": true,
    "refreshInterval": 30,
    "showResourceStats": true,
    "showValidationProgress": true,
    "showErrorSummary": true,
    "showPerformanceMetrics": false,
    "cardLayout": "grid",
    "theme": "system",
    "autoValidateEnabled": false
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM dashboard_settings);

INSERT INTO system_settings (settings)
SELECT '{
    "logLevel": "info",
    "enableAnalytics": false,
    "enableCrashReporting": true,
    "enableSSE": true,
    "dataRetentionDays": 30,
    "maxLogFileSize": 100,
    "enableAutoUpdates": true
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- Create function to update `updated_at` column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to update `updated_at` column automatically
DROP TRIGGER IF EXISTS update_dashboard_settings_updated_at ON dashboard_settings;
CREATE TRIGGER update_dashboard_settings_updated_at
BEFORE UPDATE ON dashboard_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
