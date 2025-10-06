-- Migration: Add validation progress persistence
-- Description: Add table to persist validation progress across server restarts

-- Create validation_progress_state table
CREATE TABLE IF NOT EXISTS validation_progress_state (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    server_id INTEGER NOT NULL,
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    
    -- Foreign key constraint
    CONSTRAINT fk_validation_progress_server 
        FOREIGN KEY (server_id) 
        REFERENCES fhir_servers(id) 
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_validation_progress_job_id ON validation_progress_state(job_id);
CREATE INDEX IF NOT EXISTS idx_validation_progress_server_id ON validation_progress_state(server_id);
CREATE INDEX IF NOT EXISTS idx_validation_progress_expires_at ON validation_progress_state(expires_at);
CREATE INDEX IF NOT EXISTS idx_validation_progress_updated_at ON validation_progress_state(updated_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_validation_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_validation_progress_updated_at
    BEFORE UPDATE ON validation_progress_state
    FOR EACH ROW
    EXECUTE FUNCTION update_validation_progress_updated_at();

-- Add comments
COMMENT ON TABLE validation_progress_state IS 'Stores validation progress state for persistence across server restarts';
COMMENT ON COLUMN validation_progress_state.job_id IS 'Unique job identifier for the validation run';
COMMENT ON COLUMN validation_progress_state.server_id IS 'ID of the FHIR server this validation is for';
COMMENT ON COLUMN validation_progress_state.state_data IS 'JSON data containing the complete validation state';
COMMENT ON COLUMN validation_progress_state.expires_at IS 'When this state record expires (default 24 hours)';

