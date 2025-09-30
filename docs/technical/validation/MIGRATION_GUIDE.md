# Migration Guide

## Overview
Comprehensive guide for migrating to the new per-aspect validation system and handling database schema changes.

## Pre-Migration Checklist

### 1. System Preparation
- [ ] Database backup completed
- [ ] Downtime window scheduled
- [ ] Rollback plan reviewed
- [ ] Team notified
- [ ] Monitoring alerts configured

### 2. Environment Verification
```bash
# Check current database version
psql $DATABASE_URL -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 1;"

# Verify disk space (need ~2x current DB size)
df -h

# Check database connection
psql $DATABASE_URL -c "SELECT version();"
```

### 3. Backup Strategy
```bash
# Full database backup
pg_dump $DATABASE_URL > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Verify backup
pg_restore --list backup_pre_migration_*.sql | head -20

# Store backup safely
aws s3 cp backup_pre_migration_*.sql s3://backups/validation/
```

## Migration Scenarios

### Scenario 1: Fresh Installation (No Existing Data)

**Timeline:** 5-10 minutes  
**Downtime:** None (initial setup)

```bash
# 1. Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/records"
export DEMO_MOCKS=false

# 2. Run migrations
npm run db:migrate

# 3. Seed initial data (optional)
npm run db:seed:dev

# 4. Verify
curl http://localhost:5000/api/health

# 5. Start application
npm start
```

### Scenario 2: Upgrade from Legacy Validation (< v2.0)

**Timeline:** 30-60 minutes (depends on data volume)  
**Downtime:** 15-30 minutes  
**Data Volume Impact:**
- < 10K resources: ~15 minutes
- 10K-100K resources: ~30 minutes
- 100K-1M resources: ~60 minutes

#### Step-by-Step Process

**Step 1: Pre-Migration Validation**
```bash
# Check current validation results count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM validation_results_legacy;"

# Check settings format
curl http://localhost:5000/api/validation/settings
```

**Step 2: Settings Migration**
```bash
# Dry-run settings migration (check what will change)
npm run db:migrate:settings:dry

# Review output, then apply
npm run db:migrate:settings

# Verify new settings structure
curl http://localhost:5000/api/validation/settings | jq '.aspects'
```

**Step 3: Database Schema Migration**
```bash
# Run schema migration (creates new tables)
npm run db:migrate

# Expected output:
# ✅ Creating validation_results_per_aspect table
# ✅ Creating validation_messages table  
# ✅ Creating validation_message_groups table
# ✅ Adding indexes
# ✅ Adding foreign key constraints
```

**Step 4: Data Migration**
```bash
# Migrate legacy validation results to per-aspect format
npm run db:migrate:data

# This will:
# 1. Read legacy validation_results
# 2. Split into per-aspect records
# 3. Compute message signatures
# 4. Create validation_messages
# 5. Build message groups

# Progress will be logged:
# [1/10000] Migrating Patient/123...
# [2/10000] Migrating Observation/456...
```

**Step 5: Verification**
```bash
# Verify record counts match
psql $DATABASE_URL << EOF
SELECT 
  'Legacy' as source, COUNT(*) as count 
FROM validation_results_legacy
UNION ALL
SELECT 
  'New Per-Aspect' as source, COUNT(DISTINCT (server_id, resource_type, fhir_id)) 
FROM validation_results_per_aspect;
EOF

# Verify message signatures
psql $DATABASE_URL -c "SELECT COUNT(*) FROM validation_messages;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM validation_message_groups;"
```

**Step 6: Cutover**
```bash
# 1. Stop application
pm2 stop records-fhir

# 2. Final data sync (if using blue-green)
npm run db:migrate:data --incremental

# 3. Switch to new version
git checkout v2.0.0
npm ci
npm run build

# 4. Start application
pm2 start npm --name "records-fhir" -- start

# 5. Verify
curl http://localhost:5000/api/health
curl http://localhost:5000/api/validation/issues/groups | jq '.groups | length'
```

**Step 7: Cleanup (Optional, after 7 days)**
```bash
# Drop legacy tables
psql $DATABASE_URL << EOF
DROP TABLE IF EXISTS validation_results_legacy CASCADE;
DROP TABLE IF EXISTS validation_settings_legacy CASCADE;
EOF
```

### Scenario 3: Zero-Downtime Migration (Blue-Green)

**Timeline:** 1-2 hours  
**Downtime:** None (requires load balancer)

#### Architecture
```
Load Balancer
├── Blue Environment (v1.0, legacy validation)
└── Green Environment (v2.0, new validation)
```

#### Process

**Phase 1: Setup Green Environment**
```bash
# 1. Clone database
pg_dump $DATABASE_URL | psql $DATABASE_URL_GREEN

# 2. Deploy new version to green
cd green-deployment
git checkout v2.0.0
npm ci
export DATABASE_URL=$DATABASE_URL_GREEN
npm run db:migrate
npm run build
pm2 start npm --name "records-fhir-green" -- start --port 5001

# 3. Verify green is healthy
curl http://localhost:5001/api/health
```

**Phase 2: Data Synchronization**
```bash
# Set up continuous sync (while blue is running)
# Option A: Logical replication
# Option B: Custom sync script

# Sync script (runs every 5 minutes)
while true; do
  npm run db:sync:blue-to-green
  sleep 300
done
```

**Phase 3: Cutover**
```bash
# 1. Final sync
npm run db:sync:blue-to-green --final

# 2. Switch load balancer traffic
# (100% blue -> 10% green -> 50% green -> 100% green)
./scripts/traffic-shift.sh --target green --percentage 10
sleep 60
./scripts/traffic-shift.sh --target green --percentage 50
sleep 60
./scripts/traffic-shift.sh --target green --percentage 100

# 3. Monitor green metrics
./scripts/monitor-metrics.sh --environment green

# 4. If all good, decommission blue
pm2 stop records-fhir-blue
```

**Phase 4: Rollback (if needed)**
```bash
# Quick rollback: shift traffic back to blue
./scripts/traffic-shift.sh --target blue --percentage 100

# Blue environment is still running with latest data
```

## Rollback Procedures

### Immediate Rollback (< 1 hour since migration)

**Scenario:** Migration completed but issues found immediately

```bash
# 1. Stop new version
pm2 stop records-fhir

# 2. Restore database backup
psql $DATABASE_URL < backup_pre_migration_*.sql

# 3. Start old version
git checkout v1.0.0
npm ci
npm run build
pm2 start npm --name "records-fhir" -- start

# 4. Verify
curl http://localhost:5000/api/health
```

**Data Loss:** None (if backup is recent)  
**Downtime:** 10-15 minutes

### Delayed Rollback (> 1 hour, < 24 hours)

**Scenario:** Issues found after users have made changes

```bash
# 1. Identify new data since migration
psql $DATABASE_URL << EOF
SELECT * FROM validation_results_per_aspect 
WHERE validated_at > '2025-09-30 12:00:00'
INTO TEMP TABLE new_validations;
EOF

# 2. Export new data
pg_dump $DATABASE_URL -t new_validations > new_data.sql

# 3. Restore base backup
psql $DATABASE_URL < backup_pre_migration_*.sql

# 4. Import compatible new data (may need transformation)
psql $DATABASE_URL < new_data_transformed.sql

# 5. Restart old version
git checkout v1.0.0
pm2 restart records-fhir
```

**Data Loss:** Partial (some new validations may be lost)  
**Downtime:** 20-30 minutes

### Long-Term Rollback (> 24 hours)

**Scenario:** Major issues require rollback after significant use

**NOT RECOMMENDED** - Instead:
1. Fix forward by patching new version
2. Run compensating transactions
3. Manually reconcile data

If absolutely necessary:
```bash
# Contact DevOps team
# Prepare detailed migration plan
# Schedule maintenance window
# Expect 1-2 hours downtime
```

## Data Preservation Guarantees

### What is Preserved
✅ All resource validations (split into per-aspect records)  
✅ Validation messages (with computed signatures)  
✅ Settings history (migrated to new format)  
✅ Server configurations  
✅ Timestamps and metadata  

### What Changes
🔄 Table structure (legacy → per-aspect)  
🔄 Settings format (`structural.enabled` → `aspects.structural.enabled`)  
🔄 Message grouping (new signature-based groups)  

### What is NOT Preserved
❌ Legacy validation_results table (dropped after cleanup)  
❌ Old settings format (converted)  
❌ Cached aggregations (rebuilt)  

## Performance Impact

### During Migration
- **CPU:** +50% (signature computation)
- **Memory:** +1GB (batch processing)
- **Disk I/O:** High (table creation, indexing)
- **API Response Time:** +200-500ms (during migration only)

### After Migration
- **List/Group Queries:** Faster (better indexes)
- **Detail Queries:** Slightly faster (per-aspect caching)
- **Disk Usage:** +20% (denormalized messages)
- **API Response Time:** Same or better

## Monitoring During Migration

### Critical Metrics
```bash
# CPU usage
top -p $(pgrep -f "npm.*start")

# Memory usage
free -h

# Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Migration progress
tail -f logs/migration.log

# Error rate
curl http://localhost:5000/api/validation/errors/recent
```

### Success Criteria
- [ ] All tests passing
- [ ] Zero data loss (record counts match)
- [ ] API response times < budgets
- [ ] No 5xx errors in logs
- [ ] Message groups populated correctly

## Troubleshooting Migration Issues

### Issue: Migration Fails with Constraint Violation

**Symptoms:**
```
ERROR: duplicate key value violates unique constraint "validation_results_per_aspect_pkey"
```

**Resolution:**
```bash
# Check for duplicate data
psql $DATABASE_URL << EOF
SELECT server_id, resource_type, fhir_id, aspect, COUNT(*)
FROM validation_results_per_aspect
GROUP BY server_id, resource_type, fhir_id, aspect
HAVING COUNT(*) > 1;
EOF

# Remove duplicates (keep most recent)
npm run db:deduplicate
npm run db:migrate
```

### Issue: Settings Migration Produces Invalid Format

**Symptoms:**
```
Error: ValidationSettings schema validation failed
```

**Resolution:**
```bash
# Reset settings to defaults
npm run db:migrate:settings --reset

# Or manually fix
curl -X POST http://localhost:5000/api/validation/settings/reset
```

### Issue: Migration Takes Too Long

**Symptoms:**
- Migration running > 2 hours
- High disk I/O

**Resolution:**
```bash
# Check progress
psql $DATABASE_URL -c "SELECT COUNT(*) FROM validation_results_per_aspect;"

# If stuck, cancel and run in batches
Ctrl+C
npm run db:migrate:data --batch-size 100
```

## Post-Migration Tasks

### Immediate (Day 1)
- [ ] Verify all critical workflows
- [ ] Check validation queue processing
- [ ] Review error logs
- [ ] Monitor performance metrics

### Short-term (Week 1)
- [ ] Rebuild message groups (if counts seem off)
- [ ] Optimize slow queries
- [ ] Review and adjust cache TTL
- [ ] User feedback collection

### Long-term (Month 1)
- [ ] Archive old backups
- [ ] Drop legacy tables (after verification)
- [ ] Update documentation
- [ ] Team training on new features

## Support

### Documentation
- **API Changes:** `docs/technical/validation/API_DOCUMENTATION.md`
- **Architecture:** `docs/technical/validation/VALIDATION_ARCHITECTURE.md`
- **Troubleshooting:** `docs/technical/validation/TROUBLESHOOTING_GUIDE.md`

### Contact
- **Technical Questions:** [Email/Slack]
- **Emergency Support:** [On-Call Number]
- **Migration Assistance:** [DevOps Team]
