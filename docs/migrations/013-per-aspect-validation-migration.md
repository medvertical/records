# Migration 013: Per-Aspect Validation Storage

## Overview

This migration introduces a new per-aspect validation storage architecture, replacing the monolithic `validation_results` table with granular per-aspect tables for better query performance and data organization.

## Migration Details

**Migration Number:** 013  
**Date:** 2025-09-30  
**Type:** Schema Addition (Non-breaking)

### New Tables

1. **`validation_results_per_aspect`** - Per-aspect validation results
2. **`validation_messages`** - Normalized validation messages with signatures
3. **`validation_message_groups`** - Cached message groups for fast queries

### What Changes

- **Added:** Three new tables with proper indexes and foreign keys
- **Preserved:** Existing `validation_results` table (legacy data intact)
- **No Data Loss:** Old validation data remains untouched

## Data Preservation Guarantees

### ✅ Guaranteed Safe Operations

1. **Forward Migration (UP)**
   - Creates new tables alongside existing ones
   - **Zero data loss** - existing validation results preserved
   - **No downtime** - old queries continue to work
   - **Backward compatible** - legacy code unaffected

2. **Rollback Migration (DOWN)**
   - Drops only new tables (`validation_results_per_aspect`, `validation_messages`, `validation_message_groups`)
   - **Preserves legacy data** - `validation_results` table untouched
   - **Safe rollback** - can revert at any time

### ⚠️ Important Notes

- **New and old tables coexist** - Application must choose which to use
- **No automatic data migration** - Existing validation results are NOT copied to new tables
- **Fresh start** - New validations write to new tables; old data remains in legacy table
- **Cleanup responsibility** - Old validation data can be cleared manually when ready

## Migration Time Estimates

### Forward Migration (UP)

Migration time is **independent of existing data** since we're creating new empty tables.

| Database Size | Estimated Time | Notes |
|---------------|----------------|-------|
| Any size | < 5 seconds | Creates 3 tables + indexes |
| 1M+ records | < 10 seconds | Index creation slightly slower |

**Factors:**
- Creating tables: ~1-2 seconds
- Creating indexes on empty tables: ~1-3 seconds
- Setting up foreign keys: ~1 second

### Rollback Migration (DOWN)

Rollback time depends on whether new tables have data.

| New Table Data | Estimated Time | Notes |
|----------------|----------------|-------|
| Empty tables | < 2 seconds | Simple DROP TABLE |
| 1K records | < 5 seconds | Drop with cascade |
| 10K records | < 10 seconds | Drop with cascade |
| 100K records | < 30 seconds | Drop with cascade |
| 1M+ records | 1-3 minutes | Drop with cascade |

**Factors:**
- Foreign key cascade deletions
- Index cleanup
- PostgreSQL cleanup operations

## Performance Impact

### During Migration

- **Minimal impact** - Creating tables on empty schema is fast
- **No locks on existing data** - Legacy `validation_results` unaffected
- **No blocking queries** - Application continues normal operation

### After Migration

**Query Performance (New Tables):**
- ✅ **Faster filtered queries** - Indexes on (server_id, aspect, severity)
- ✅ **Faster grouping** - Signature-based indexes
- ✅ **Better scalability** - Normalized message storage

**Storage:**
- Slight increase due to normalization (messages deduplicated by signature)
- Better compression due to consistent data patterns

## Migration Procedures

### Running Forward Migration

```bash
# Using npm script
npm run db:migrate

# Or manually
tsx server/db/migrate.ts up

# Or using SQL directly
psql $DATABASE_URL -f migrations/013_per_aspect_validation_storage.sql
```

### Running Rollback

```bash
# Using npm script (specify migration number)
npm run db:migrate:down 013_per_aspect_validation_storage

# Or manually
tsx server/db/migrate.ts down 013_per_aspect_validation_storage

# Or using SQL directly
psql $DATABASE_URL -f migrations/013_per_aspect_validation_storage_down.sql
```

### Testing Migration

```bash
# Run automated migration test
npm run db:test:migration
```

This will:
1. Check initial state (tables should not exist)
2. Run forward migration
3. Verify tables created
4. Insert test data
5. Verify data persistence
6. Run rollback
7. Verify tables dropped
8. Report test results

## Data Migration Strategy

### Option 1: Fresh Start (Recommended for MVP)

1. Run forward migration
2. Clear legacy validation results (optional)
3. Start fresh validations with new tables

```bash
npm run db:migrate
npm run db:clear:legacy  # Optional: clear old data
```

### Option 2: Gradual Migration (Future Enhancement)

1. Run forward migration
2. Keep both tables active
3. Write to new tables, read from both
4. Gradually migrate old data in background
5. Switch fully to new tables
6. Drop legacy table when ready

**Not implemented in MVP** - requires additional migration scripts (see subtask 1.12).

## Verification Steps

After migration, verify the new schema:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'validation_results_per_aspect',
    'validation_messages',
    'validation_message_groups'
  );

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename LIKE 'validation_%' 
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Verify foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'validation_%';
```

## Rollback Scenarios

### When to Rollback

- **Critical bug discovered** in new validation logic
- **Performance issues** with new schema (unlikely but possible)
- **Data integrity concerns** in new tables
- **Need to revert to legacy system** quickly

### Safe Rollback Conditions

✅ **Safe to rollback if:**
- New tables have no production data
- Testing phase only
- No dependencies on new schema

⚠️ **Caution if:**
- New tables contain production validation data
- Users are actively using new validation features
- Need to preserve new validation results

### Rollback Procedure

1. **Backup new table data** (if needed):
   ```bash
   npm run db:clear:stats  # Check data volume first
   pg_dump -t validation_results_per_aspect -t validation_messages -t validation_message_groups $DATABASE_URL > backup_new_validation_data.sql
   ```

2. **Run rollback migration:**
   ```bash
   npm run db:migrate:down 013_per_aspect_validation_storage
   ```

3. **Verify legacy system still works:**
   ```bash
   # Check legacy table
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM validation_results;"
   ```

## Troubleshooting

### Migration Fails

**Error: "Table already exists"**
- Tables from previous migration attempt exist
- Solution: Run rollback first, then re-run forward migration

**Error: "Foreign key constraint violation"**
- Referenced table (e.g., `fhir_servers`) missing
- Solution: Ensure base schema is up to date

### Rollback Fails

**Error: "Cannot drop table - dependent objects"**
- Other tables/views depend on validation tables
- Solution: Add CASCADE to DROP statements (already in rollback script)

**Error: "Table does not exist"**
- Already rolled back or never migrated
- Solution: Verify state with `npm run db:clear:stats`

## Monitoring

After migration, monitor:

1. **Table sizes:**
   ```sql
   SELECT 
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
   FROM pg_tables
   WHERE tablename LIKE 'validation_%'
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

2. **Index usage:**
   ```sql
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans
   FROM pg_stat_user_indexes
   WHERE tablename LIKE 'validation_%'
   ORDER BY idx_scan DESC;
   ```

3. **Query performance:**
   - Monitor query times for grouping/filtering
   - Target: p95 < 500ms for list/group queries

## Related Documentation

- [PRD: Records FHIR Validation Platform](../requirements/prd-records-fhir-platform.md)
- [Validation API Documentation](../technical/validation/API_DOCUMENTATION.md)
- [Schema: Per-Aspect Validation](../../shared/schema-validation-per-aspect.ts)

## Support

For issues or questions:
- Run automated test: `npm run db:test:migration`
- Check data stats: `npm run db:clear:stats`
- Review logs in migration scripts
