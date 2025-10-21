-- Migration: Add server capabilities table
-- This table stores detected FHIR search modifier capabilities for each server

CREATE TABLE IF NOT EXISTS server_capabilities (
  id SERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES fhir_servers(id) ON DELETE CASCADE,
  capabilities JSONB NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  fhir_version VARCHAR(20),
  UNIQUE(server_id)
);

-- Index for faster lookups by server
CREATE INDEX IF NOT EXISTS idx_server_capabilities_server_id ON server_capabilities(server_id);

-- Index for capabilities JSONB queries
CREATE INDEX IF NOT EXISTS idx_server_capabilities_data ON server_capabilities USING GIN(capabilities);

-- Comment
COMMENT ON TABLE server_capabilities IS 'Stores detected FHIR search modifier capabilities for each server';
COMMENT ON COLUMN server_capabilities.server_id IS 'Reference to the FHIR server';
COMMENT ON COLUMN server_capabilities.capabilities IS 'JSON object containing supported search modifiers';
COMMENT ON COLUMN server_capabilities.detected_at IS 'When capabilities were detected';
COMMENT ON COLUMN server_capabilities.fhir_version IS 'FHIR version detected from server';

