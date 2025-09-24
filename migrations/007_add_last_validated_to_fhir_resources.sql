-- Add lastValidated column to fhir_resources table
ALTER TABLE fhir_resources ADD COLUMN last_validated TIMESTAMP;

