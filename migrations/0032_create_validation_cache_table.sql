-- Migration: Create validation_cache table for L2 caching
-- Task 7.4: Create L2 database schema for persistent caching

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS validation_cache;

-- Create validation_cache table
CREATE TABLE IF NOT EXISTS validation_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Cache key (SHA-256 hash of resource + settings + version)
  cache_key TEXT NOT NULL UNIQUE,
  
  -- Category for grouping (validation, profile, terminology, igPackage)
  category TEXT NOT NULL,
  
  -- The cached value (stored as JSON)
  value TEXT NOT NULL,
  
  -- Resource hash (for efficient lookups)
  resource_hash TEXT,
  
  -- Settings hash (for invalidation on settings change)
  settings_hash TEXT,
  
  -- FHIR version
  fhir_version TEXT,
  
  -- Size in bytes
  size_bytes INTEGER NOT NULL DEFAULT 0,
  
  -- Hit count
  hits INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  accessed_at DATETIME,
  
  -- Metadata
  resource_type TEXT,
  validation_profile TEXT,
  
  -- Indexes for efficient queries
  CHECK (category IN ('validation', 'profile', 'terminology', 'igPackage'))
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_validation_cache_key ON validation_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_validation_cache_category ON validation_cache(category);
CREATE INDEX IF NOT EXISTS idx_validation_cache_resource_hash ON validation_cache(resource_hash);
CREATE INDEX IF NOT EXISTS idx_validation_cache_settings_hash ON validation_cache(settings_hash);
CREATE INDEX IF NOT EXISTS idx_validation_cache_expires_at ON validation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_validation_cache_resource_type ON validation_cache(resource_type);
CREATE INDEX IF NOT EXISTS idx_validation_cache_fhir_version ON validation_cache(fhir_version);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_validation_cache_category_expires ON validation_cache(category, expires_at);
CREATE INDEX IF NOT EXISTS idx_validation_cache_resource_settings ON validation_cache(resource_hash, settings_hash);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_validation_cache_timestamp
AFTER UPDATE ON validation_cache
FOR EACH ROW
BEGIN
  UPDATE validation_cache SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


