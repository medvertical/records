-- Migration: Add Terminology Servers Support
-- Date: 2025-10-15
-- Description: Add terminology_servers column to validation_settings table
--              to support multiple terminology servers with priority ordering

-- Add terminology_servers column
ALTER TABLE validation_settings 
ADD COLUMN IF NOT EXISTS terminology_servers JSONB DEFAULT '[]'::jsonb;

-- Add circuit_breaker_config column
ALTER TABLE validation_settings 
ADD COLUMN IF NOT EXISTS circuit_breaker_config JSONB DEFAULT '{
  "failureThreshold": 5,
  "resetTimeout": 1800000,
  "halfOpenTimeout": 300000
}'::jsonb;

-- Set default terminology servers for existing rows
-- Based on TERMINOLOGY_SERVER_TEST_RESULTS.md:
-- - tx.fhir.org/r5 primary (98/100 score)
-- - tx.fhir.org/r4 secondary (98/100 score)
-- - CSIRO R4 fallback (96/100 score)
-- - CSIRO R5 NOT included (broken, 61/100 score)
UPDATE validation_settings 
SET terminology_servers = '[
  {
    "id": "tx-fhir-org-r5",
    "name": "HL7 TX Server (R5)",
    "url": "https://tx.fhir.org/r5",
    "enabled": true,
    "fhirVersions": ["R5", "R6"],
    "status": "unknown",
    "failureCount": 0,
    "lastFailureTime": null,
    "circuitOpen": false,
    "responseTimeAvg": 0,
    "testScore": 98
  },
  {
    "id": "tx-fhir-org-r4",
    "name": "HL7 TX Server (R4)",
    "url": "https://tx.fhir.org/r4",
    "enabled": true,
    "fhirVersions": ["R4"],
    "status": "unknown",
    "failureCount": 0,
    "lastFailureTime": null,
    "circuitOpen": false,
    "responseTimeAvg": 0,
    "testScore": 98
  },
  {
    "id": "csiro-ontoserver-r4",
    "name": "CSIRO Ontoserver (R4)",
    "url": "https://r4.ontoserver.csiro.au/fhir",
    "enabled": true,
    "fhirVersions": ["R4"],
    "status": "unknown",
    "failureCount": 0,
    "lastFailureTime": null,
    "circuitOpen": false,
    "responseTimeAvg": 0,
    "testScore": 96
  }
]'::jsonb
WHERE terminology_servers = '[]'::jsonb OR terminology_servers IS NULL;

-- Add comment
COMMENT ON COLUMN validation_settings.terminology_servers IS 
  'Ordered list of terminology servers for sequential fallback validation. Order determines priority.';

COMMENT ON COLUMN validation_settings.circuit_breaker_config IS 
  'Circuit breaker configuration for terminology server failure handling';

