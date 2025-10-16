-- Migration: Profile Cache Schema
-- Date: October 2025
-- Purpose: Create database schema for caching FHIR profiles, packages, and dependencies
-- Dependencies: Existing validation_settings and fhir_servers tables
-- Task: 4.5 - Create profile cache schema in database

-- ============================================================================
-- PROFILE PACKAGES TABLE
-- ============================================================================

-- Table for caching downloaded FHIR packages (IG packages, npm packages, etc.)
CREATE TABLE IF NOT EXISTS "profile_packages" (
    "id" SERIAL PRIMARY KEY,
    "package_id" VARCHAR(255) NOT NULL, -- e.g., "de.basisprofil.r4", "hl7.fhir.us.core"
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500),
    "version" VARCHAR(100) NOT NULL,
    "fhir_version" VARCHAR(20) NOT NULL, -- R4, R5, R6
    "author" VARCHAR(255),
    "description" TEXT,
    "canonical_url" VARCHAR(500),
    "source" VARCHAR(50) NOT NULL CHECK (source IN ('simplifier', 'fhir-registry', 'npm', 'local', 'filesystem')),
    "download_url" VARCHAR(1000),
    "package_content" BYTEA, -- Compressed package content (.tgz)
    "package_metadata" JSONB DEFAULT '{}', -- package.json content
    "dependencies" TEXT[], -- Array of dependency package IDs
    "keywords" TEXT[] DEFAULT '{}',
    "status" VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'retired', 'unknown')),
    "downloaded_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "last_accessed_at" TIMESTAMP DEFAULT NOW(),
    "access_count" INTEGER DEFAULT 0,
    "file_size_bytes" BIGINT,
    "checksum_sha256" VARCHAR(64), -- SHA-256 hash of package content
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROFILES CACHE TABLE
-- ============================================================================

-- Table for caching individual FHIR profiles (StructureDefinitions)
CREATE TABLE IF NOT EXISTS "profiles_cache" (
    "id" SERIAL PRIMARY KEY,
    "canonical_url" VARCHAR(500) NOT NULL,
    "version" VARCHAR(100),
    "name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500),
    "profile_id" VARCHAR(255), -- StructureDefinition.id
    "package_id" INTEGER REFERENCES "profile_packages"("id") ON DELETE CASCADE,
    "resource_type" VARCHAR(100), -- Patient, Observation, etc.
    "kind" VARCHAR(50) CHECK (kind IN ('resource', 'complex-type', 'primitive-type', 'logical')),
    "abstract" BOOLEAN DEFAULT false,
    "base_definition" VARCHAR(500), -- Base profile this extends
    "derivation" VARCHAR(20) CHECK (derivation IN ('specialization', 'constraint')),
    "type" VARCHAR(100), -- FHIR resource type this profile applies to
    "source" VARCHAR(50) NOT NULL CHECK (source IN ('simplifier', 'fhir-registry', 'npm', 'local', 'filesystem', 'database')),
    "fhir_version" VARCHAR(20) NOT NULL,
    "profile_content" JSONB NOT NULL, -- Full StructureDefinition JSON
    "differential_elements" JSONB DEFAULT '{}', -- StructureDefinition.differential
    "snapshot_elements" JSONB DEFAULT '{}', -- StructureDefinition.snapshot
    "status" VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'retired', 'unknown')),
    "experimental" BOOLEAN DEFAULT false,
    "date" TIMESTAMP,
    "publisher" VARCHAR(255),
    "contact_info" JSONB DEFAULT '{}',
    "use_context" JSONB DEFAULT '{}',
    "jurisdiction" JSONB DEFAULT '{}',
    "purpose" TEXT,
    "copyright" TEXT,
    "context_info" JSONB DEFAULT '{}', -- Extension context information
    "resolution_time_ms" INTEGER DEFAULT 0,
    "dependencies_resolved" BOOLEAN DEFAULT false,
    "resolution_source" VARCHAR(50), -- Where it was resolved from
    "cached_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "last_accessed_at" TIMESTAMP DEFAULT NOW(),
    "access_count" INTEGER DEFAULT 0,
    "validation_count" INTEGER DEFAULT 0, -- How many times used for validation
    "checksum_sha256" VARCHAR(64), -- SHA-256 hash of profile_content
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROFILE DEPENDENCIES TABLE
-- ============================================================================

-- Table for tracking dependencies between profiles
CREATE TABLE IF NOT EXISTS "profile_dependencies" (
    "id" SERIAL PRIMARY KEY,
    "profile_id" INTEGER NOT NULL REFERENCES "profiles_cache"("id") ON DELETE CASCADE,
    "depends_on_profile_id" INTEGER REFERENCES "profiles_cache"("id") ON DELETE SET NULL,
    "depends_on_canonical_url" VARCHAR(500) NOT NULL,
    "depends_on_version" VARCHAR(100),
    "dependency_type" VARCHAR(50) NOT NULL CHECK (dependency_type IN ('base_definition', 'profile_reference', 'target_profile', 'extension', 'value_set', 'code_system')),
    "path" VARCHAR(500), -- FHIR path where dependency is referenced (e.g., "Patient.extension[0]")
    "required" BOOLEAN DEFAULT true,
    "resolved" BOOLEAN DEFAULT false,
    "resolution_attempted_at" TIMESTAMP,
    "resolution_error" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PROFILE RESOLUTION LOG TABLE
-- ============================================================================

-- Table for tracking profile resolution attempts and performance
CREATE TABLE IF NOT EXISTS "profile_resolution_log" (
    "id" SERIAL PRIMARY KEY,
    "canonical_url" VARCHAR(500) NOT NULL,
    "version" VARCHAR(100),
    "resolution_attempt" INTEGER DEFAULT 1,
    "source_attempted" VARCHAR(50), -- simplifier, fhir-registry, etc.
    "success" BOOLEAN NOT NULL,
    "profile_id" INTEGER REFERENCES "profiles_cache"("id") ON DELETE SET NULL,
    "resolution_time_ms" INTEGER,
    "error_message" TEXT,
    "user_agent" VARCHAR(500),
    "initiated_by" VARCHAR(255), -- validation-engine, manual, etc.
    "settings_hash" VARCHAR(64), -- Hash of validation settings used
    "attempted_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Profile Packages Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_profile_packages_unique_package_version" 
    ON "profile_packages" ("package_id", "version");

CREATE INDEX IF NOT EXISTS "idx_profile_packages_source" 
    ON "profile_packages" ("source");

CREATE INDEX IF NOT EXISTS "idx_profile_packages_fhir_version" 
    ON "profile_packages" ("fhir_version");

CREATE INDEX IF NOT EXISTS "idx_profile_packages_downloaded_at" 
    ON "profile_packages" ("downloaded_at");

CREATE INDEX IF NOT EXISTS "idx_profile_packages_last_accessed" 
    ON "profile_packages" ("last_accessed_at");

CREATE INDEX IF NOT EXISTS "idx_profile_packages_checksum" 
    ON "profile_packages" ("checksum_sha256");

-- Profiles Cache Indexes  
CREATE UNIQUE INDEX IF NOT EXISTS "idx_profiles_cache_unique_canonical_version" 
    ON "profiles_cache" ("canonical_url", "version");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_canonical_url" 
    ON "profiles_cache" ("canonical_url");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_name" 
    ON "profiles_cache" ("name");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_resource_type" 
    ON "profiles_cache" ("resource_type");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_base_definition" 
    ON "profiles_cache" ("base_definition");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_package_id" 
    ON "profiles_cache" ("package_id");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_source_fhir_version" 
    ON "profiles_cache" ("source", "fhir_version");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_cached_at" 
    ON "profiles_cache" ("cached_at");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_last_accessed" 
    ON "profiles_cache" ("last_accessed_at");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_validation_count" 
    ON "profiles_cache" ("validation_count");

CREATE INDEX IF NOT EXISTS "idx_profiles_cache_checksum" 
    ON "profiles_cache" ("checksum_sha256");

-- Profile Dependencies Indexes
CREATE INDEX IF NOT EXISTS "idx_profile_dependencies_profile_id" 
    ON "profile_dependencies" ("profile_id");

CREATE INDEX IF NOT EXISTS "idx_profile_dependencies_depends_on_profile" 
    ON "profile_dependencies" ("depends_on_profile_id");

CREATE INDEX IF NOT EXISTS "idx_profile_dependencies_canonical_url" 
    ON "profile_dependencies" ("depends_on_canonical_url");

CREATE INDEX IF NOT EXISTS "idx_profile_dependencies_type" 
    ON "profile_dependencies" ("dependency_type");

CREATE INDEX IF NOT EXISTS "idx_profile_dependencies_resolved" 
    ON "profile_dependencies" ("resolved");

-- Profile Resolution Log Indexes
CREATE INDEX IF NOT EXISTS "idx_profile_resolution_log_canonical_url" 
    ON "profile_resolution_log" ("canonical_url");

CREATE INDEX IF NOT EXISTS "idx_profile_resolution_log_attempted_at" 
    ON "profile_resolution_log" ("attempted_at");

CREATE INDEX IF NOT EXISTS "idx_profile_resolution_log_success" 
    ON "profile_resolution_log" ("success");

CREATE INDEX IF NOT EXISTS "idx_profile_resolution_log_source" 
    ON "profile_resolution_log" ("source_attempted");

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all cache tables
CREATE TRIGGER "trigger_update_profile_packages_updated_at"
    BEFORE UPDATE ON "profile_packages"
    FOR EACH ROW EXECUTE FUNCTION update_profile_cache_updated_at();

CREATE TRIGGER "trigger_update_profiles_cache_updated_at"
    BEFORE UPDATE ON "profiles_cache"
    FOR EACH ROW EXECUTE FUNCTION update_profile_cache_updated_at();

CREATE TRIGGER "trigger_update_profile_dependencies_updated_at"
    BEFORE UPDATE ON "profile_dependencies"
    FOR EACH ROW EXECUTE FUNCTION update_profile_cache_updated_at();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for profile cache statistics
CREATE OR REPLACE VIEW "profile_cache_stats" AS
SELECT 
    COUNT(*) as total_profiles,
    COUNT(DISTINCT canonical_url) as unique_profiles,
    COUNT(DISTINCT package_id) as total_packages,
    AVG(resolution_time_ms) as avg_resolution_time_ms,
    SUM(access_count) as total_accesses,
    SUM(validation_count) as total_validations,
    COUNT(CASE WHEN dependencies_resolved = true THEN 1 END) as profiles_with_dependencies_resolved,
    COUNT(CASE WHEN source = 'simplifier' THEN 1 END) as from_simplifier,
    COUNT(CASE WHEN source = 'fhir-registry' THEN 1 END) as from_fhir_registry,
    COUNT(CASE WHEN source = 'local' THEN 1 END) as from_local,
    MAX(cached_at) as last_cached_at,
    MAX(last_accessed_at) as last_accessed_at
FROM profiles_cache;

-- View for dependency tree (recursive)
CREATE OR REPLACE VIEW "profile_dependency_tree" AS
WITH RECURSIVE dependency_tree AS (
    -- Base case: profiles with no dependencies (roots)
    SELECT 
        pc.id,
        pc.canonical_url,
        pc.name,
        pc.version,
        0 as depth,
        ARRAY[pc.id] as path,
        pc.canonical_url as root_profile
    FROM profiles_cache pc
    WHERE NOT EXISTS (
        SELECT 1 FROM profile_dependencies pd 
        WHERE pd.profile_id = pc.id
    )
    
    UNION ALL
    
    -- Recursive case: profiles that depend on others
    SELECT 
        pc.id,
        pc.canonical_url,
        pc.name,
        pc.version,
        dt.depth + 1,
        dt.path || pc.id,
        dt.root_profile
    FROM profiles_cache pc
    JOIN profile_dependencies pd ON pd.profile_id = pc.id
    JOIN dependency_tree dt ON dt.id = pd.depends_on_profile_id
    WHERE NOT (pc.id = ANY(dt.path)) -- Prevent circular dependencies
)
SELECT * FROM dependency_tree;

-- View for unresolved dependencies
CREATE OR REPLACE VIEW "unresolved_profile_dependencies" AS
SELECT 
    pd.id,
    pc.canonical_url as profile_url,
    pc.name as profile_name,
    pd.depends_on_canonical_url,
    pd.depends_on_version,
    pd.dependency_type,
    pd.path,
    pd.resolution_attempted_at,
    pd.resolution_error
FROM profile_dependencies pd
JOIN profiles_cache pc ON pc.id = pd.profile_id
WHERE pd.resolved = false
ORDER BY pd.created_at DESC;

-- ============================================================================
-- INITIAL DATA AND CLEANUP
-- ============================================================================

-- Add sample data comment (no actual data insertion for safety)
-- INSERT statements would go here for known profiles like:
-- - hl7.fhir.core (base FHIR profiles)  
-- - de.basisprofil.r4 (German base profiles)
-- - hl7.fhir.us.core (US Core profiles)

-- Create maintenance function for cache cleanup
CREATE OR REPLACE FUNCTION cleanup_profile_cache(
    older_than_days INTEGER DEFAULT 90,
    min_access_count INTEGER DEFAULT 0
)
RETURNS TABLE(cleaned_profiles INTEGER, cleaned_packages INTEGER) AS $$
DECLARE
    profile_count INTEGER;
    package_count INTEGER;
BEGIN
    -- Clean unused profiles older than specified days with low access count
    DELETE FROM profiles_cache 
    WHERE cached_at < NOW() - INTERVAL '1 day' * older_than_days
    AND access_count <= min_access_count;
    
    GET DIAGNOSTICS profile_count = ROW_COUNT;
    
    -- Clean orphaned packages (packages with no profiles)
    DELETE FROM profile_packages pp
    WHERE NOT EXISTS (
        SELECT 1 FROM profiles_cache pc WHERE pc.package_id = pp.id
    )
    AND downloaded_at < NOW() - INTERVAL '1 day' * older_than_days;
    
    GET DIAGNOSTICS package_count = ROW_COUNT;
    
    RETURN QUERY SELECT profile_count, package_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE profile_packages IS 'Caches downloaded FHIR implementation guide packages from various sources';
COMMENT ON TABLE profiles_cache IS 'Caches individual FHIR profiles (StructureDefinitions) for fast validation';
COMMENT ON TABLE profile_dependencies IS 'Tracks dependencies between FHIR profiles for resolution ordering';
COMMENT ON TABLE profile_resolution_log IS 'Logs all profile resolution attempts for debugging and analytics';

COMMENT ON COLUMN profiles_cache.profile_content IS 'Complete StructureDefinition JSON for validation use';
COMMENT ON COLUMN profiles_cache.resolution_time_ms IS 'Time taken to resolve this profile from external sources';
COMMENT ON COLUMN profiles_cache.validation_count IS 'Number of times this profile was used in validation';

COMMENT ON FUNCTION cleanup_profile_cache IS 'Maintenance function to clean old unused cached profiles and packages';

