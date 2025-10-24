-- Migration: Remove data field from fhir_resources table
-- Purpose: Resources should only be stored in FHIR servers, not in our validation database
-- We keep only metadata (resourceType, resourceId, versionId, resourceHash) for validation tracking

-- Drop the data column which stores the full FHIR resource
ALTER TABLE "fhir_resources" DROP COLUMN IF EXISTS "data";

-- Note: This migration is irreversible. If rollback is needed, the data column can be re-added
-- but the actual resource data will have been lost. Resources should always be fetched from
-- the FHIR server.

