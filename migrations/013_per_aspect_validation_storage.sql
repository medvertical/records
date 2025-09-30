-- Migration: Per-Aspect Validation Storage
-- Creates new tables for per-aspect validation results, normalized messages, and message groups
-- Forward migration (UP)

-- Create validation_results_per_aspect table
CREATE TABLE IF NOT EXISTS "validation_results_per_aspect" (
  "id" SERIAL PRIMARY KEY,
  "server_id" INTEGER NOT NULL REFERENCES "fhir_servers"("id"),
  "resource_type" TEXT NOT NULL,
  "fhir_id" TEXT NOT NULL,
  "aspect" VARCHAR(50) NOT NULL,
  "is_valid" BOOLEAN NOT NULL,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "information_count" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "settings_snapshot_hash" VARCHAR(64) NOT NULL,
  "validated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "duration_ms" INTEGER DEFAULT 0,
  "validation_engine_version" VARCHAR(20) DEFAULT '1.0.0',
  "detailed_result" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for validation_results_per_aspect
CREATE INDEX IF NOT EXISTS "validation_results_resource_aspect_idx" 
  ON "validation_results_per_aspect" ("server_id", "resource_type", "fhir_id", "aspect");

CREATE INDEX IF NOT EXISTS "validation_results_aspect_severity_idx" 
  ON "validation_results_per_aspect" ("server_id", "aspect", "error_count", "warning_count");

CREATE INDEX IF NOT EXISTS "validation_results_validated_at_idx" 
  ON "validation_results_per_aspect" ("validated_at");

CREATE UNIQUE INDEX IF NOT EXISTS "validation_results_unique_resource_aspect" 
  ON "validation_results_per_aspect" ("server_id", "resource_type", "fhir_id", "aspect", "settings_snapshot_hash");

-- Create validation_messages table
CREATE TABLE IF NOT EXISTS "validation_messages" (
  "id" SERIAL PRIMARY KEY,
  "validation_result_id" INTEGER NOT NULL REFERENCES "validation_results_per_aspect"("id") ON DELETE CASCADE,
  "server_id" INTEGER NOT NULL REFERENCES "fhir_servers"("id"),
  "resource_type" TEXT NOT NULL,
  "fhir_id" TEXT NOT NULL,
  "aspect" VARCHAR(50) NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "code" VARCHAR(100),
  "canonical_path" VARCHAR(256) NOT NULL,
  "text" TEXT NOT NULL,
  "normalized_text" VARCHAR(512) NOT NULL,
  "rule_id" VARCHAR(100),
  "signature" VARCHAR(64) NOT NULL,
  "signature_version" INTEGER NOT NULL DEFAULT 1,
  "path_truncated" BOOLEAN DEFAULT FALSE,
  "text_truncated" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for validation_messages
CREATE INDEX IF NOT EXISTS "validation_messages_signature_idx" 
  ON "validation_messages" ("server_id", "signature");

CREATE INDEX IF NOT EXISTS "validation_messages_aspect_severity_idx" 
  ON "validation_messages" ("server_id", "aspect", "severity");

CREATE INDEX IF NOT EXISTS "validation_messages_resource_idx" 
  ON "validation_messages" ("server_id", "resource_type", "fhir_id");

-- Create validation_message_groups table (optional caching)
CREATE TABLE IF NOT EXISTS "validation_message_groups" (
  "id" SERIAL PRIMARY KEY,
  "server_id" INTEGER NOT NULL REFERENCES "fhir_servers"("id"),
  "signature" VARCHAR(64) NOT NULL,
  "signature_version" INTEGER NOT NULL DEFAULT 1,
  "aspect" VARCHAR(50) NOT NULL,
  "severity" VARCHAR(20) NOT NULL,
  "code" VARCHAR(100),
  "canonical_path" VARCHAR(256) NOT NULL,
  "sample_text" TEXT NOT NULL,
  "total_resources" INTEGER NOT NULL DEFAULT 0,
  "first_seen_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_seen_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for validation_message_groups
CREATE UNIQUE INDEX IF NOT EXISTS "validation_message_groups_unique_server_signature" 
  ON "validation_message_groups" ("server_id", "signature");

CREATE INDEX IF NOT EXISTS "validation_message_groups_aspect_severity_idx" 
  ON "validation_message_groups" ("server_id", "aspect", "severity");

-- Add comment to track migration
COMMENT ON TABLE "validation_results_per_aspect" IS 'Per-aspect validation results for FHIR resources (Migration 013)';
COMMENT ON TABLE "validation_messages" IS 'Normalized validation messages with signatures for grouping (Migration 013)';
COMMENT ON TABLE "validation_message_groups" IS 'Cached message groups for fast groups API queries (Migration 013)';
