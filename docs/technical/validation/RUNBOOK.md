# Validation System Runbook

## Overview
Operational guide for managing the FHIR Validation Platform in production.

## Quick Reference

### Emergency Contacts
- **On-Call Engineer:** [Contact Info]
- **Database Admin:** [Contact Info]
- **DevOps Team:** [Contact Info]

### Critical Endpoints
- **Health Check:** `GET /api/health`
- **Queue Status:** `GET /api/validation/queue/stats`
- **Validation Progress:** `GET /api/validation/progress`

### Critical Commands
```bash
# Check system health
curl http://localhost:5000/api/health

# Check queue status
curl http://localhost:5000/api/validation/queue/stats

# Emergency stop validation
curl -X POST http://localhost:5000/api/validation/queue/stop
```

## Common Operations

### 1. Queue Management

#### Start Validation Batch
```bash
# Start validation for specific resource types
curl -X POST http://localhost:5000/api/validation/queue/start \
  -H "Content-Type: application/json" \
  -d '{
    "resourceTypes": ["Patient", "Observation"],
    "batchSize": 10,
    "priority": "normal"
  }'

# Response
{
  "status": "started",
  "queueId": "abc123",
  "totalItems": 1000,
  "startedAt": "2025-09-30T12:00:00Z"
}
```

#### Pause Validation
```bash
# Pause current batch processing
curl -X POST http://localhost:5000/api/validation/queue/pause

# Response
{
  "status": "paused",
  "processedItems": 250,
  "remainingItems": 750,
  "pausedAt": "2025-09-30T12:15:00Z"
}
```

#### Resume Validation
```bash
# Resume paused batch
curl -X POST http://localhost:5000/api/validation/queue/resume

# Response
{
  "status": "running",
  "resumedAt": "2025-09-30T12:20:00Z"
}
```

#### Stop Validation (Emergency)
```bash
# Stop and clear queue
curl -X POST http://localhost:5000/api/validation/queue/stop

# Response
{
  "status": "stopped",
  "itemsProcessed": 250,
  "itemsAbandoned": 750,
  "stoppedAt": "2025-09-30T12:25:00Z"
}
```

#### Check Queue Status
```bash
# Get detailed queue statistics
curl http://localhost:5000/api/validation/queue/stats

# Response
{
  "status": "running",
  "totalItems": 1000,
  "processedItems": 250,
  "failedItems": 5,
  "successRate": 98.0,
  "averageProcessingTime": 1250,
  "estimatedCompletion": "2025-09-30T13:00:00Z",
  "eta": "35 minutes"
}
```

### 2. Data Management

#### Clear Validation Results

**Option A: Clear by Server**
```bash
# Clear all validation data for a specific server
curl -X DELETE http://localhost:5000/api/validation/clear/server/1

# Response
{
  "deleted": {
    "results": 5000,
    "messages": 15000,
    "groups": 250
  },
  "server": {
    "id": 1,
    "name": "Production FHIR Server"
  }
}
```

**Option B: Clear by Resource Type**
```bash
# Clear validation data for specific resource type
curl -X DELETE http://localhost:5000/api/validation/clear/resource-type/Patient

# Response
{
  "deleted": {
    "results": 2000,
    "messages": 6000,
    "groups": 100
  },
  "resourceType": "Patient"
}
```

**Option C: Clear All (Nuclear Option)**
```bash
# Clear ALL validation data (use with extreme caution!)
curl -X DELETE http://localhost:5000/api/validation/clear/all \
  -H "X-Confirm-Action: yes-delete-all-validation-data"

# Response
{
  "deleted": {
    "results": 10000,
    "messages": 30000,
    "groups": 500
  },
  "warning": "All validation data has been deleted"
}
```

**CLI Method (Safer)**
```bash
# Using CLI script
npm run db:clear

# Clear only stats (keep messages)
npm run db:clear:stats

# Nuclear option
npm run db:clear:all
```

#### Get Deletion Statistics
```bash
# Check what would be deleted (dry-run)
curl http://localhost:5000/api/validation/clear/stats

# Response
{
  "validation_results": 10000,
  "validation_messages": 30000,
  "validation_message_groups": 500,
  "total_size_mb": 125,
  "oldest_record": "2025-08-01T00:00:00Z",
  "newest_record": "2025-09-30T12:00:00Z"
}
```

### 3. Rebuild Message Groups

**When to Rebuild:**
- Message groups out of sync with messages
- After bulk data import/migration
- Signature algorithm changed

```bash
# Rebuild groups from existing messages
curl -X POST http://localhost:5000/api/validation/groups/rebuild

# Response
{
  "status": "rebuilding",
  "jobId": "rebuild-123",
  "estimatedDuration": "5 minutes"
}

# Check rebuild status
curl http://localhost:5000/api/validation/groups/rebuild/rebuild-123/status

# Response
{
  "status": "complete",
  "groupsCreated": 500,
  "groupsUpdated": 250,
  "groupsDeleted": 50,
  "duration": "4m 32s"
}
```

### 4. Settings Management

#### View Current Settings
```bash
curl http://localhost:5000/api/validation/settings

# Response
{
  "aspects": {
    "structural": {"enabled": true, "severity": "error"},
    "profile": {"enabled": true, "severity": "warning"},
    "terminology": {"enabled": true, "severity": "warning"},
    "reference": {"enabled": true, "severity": "error"},
    "businessRule": {"enabled": true, "severity": "error"},
    "metadata": {"enabled": false, "severity": "error"}
  },
  "settingsHash": "abc123def456",
  "lastModified": "2025-09-30T10:00:00Z"
}
```

#### Update Settings
```bash
# Disable an aspect
curl -X PUT http://localhost:5000/api/validation/settings \
  -H "Content-Type: application/json" \
  -d '{
    "aspects": {
      "metadata": {"enabled": false, "severity": "error"}
    }
  }'

# Response
{
  "success": true,
  "previousHash": "abc123def456",
  "newHash": "def789ghi012",
  "changedAspects": ["metadata"],
  "revalidationRequired": true
}
```

#### Reset to Defaults
```bash
curl -X POST http://localhost:5000/api/validation/settings/reset

# Response
{
  "success": true,
  "settingsHash": "default-123",
  "message": "Settings reset to defaults"
}
```

### 5. Server Management

#### Switch Active Server
```bash
# Activate a different FHIR server
curl -X POST http://localhost:5000/api/fhir/servers/2/activate

# Response
{
  "success": true,
  "server": {
    "id": 2,
    "name": "Staging FHIR Server",
    "url": "http://staging.fhir.org/baseR4",
    "isActive": true
  },
  "previousServer": {
    "id": 1,
    "name": "Production FHIR Server"
  }
}
```

#### Test Server Connection
```bash
# Test FHIR server connectivity
curl http://localhost:5000/api/fhir/connection/test

# Response
{
  "connected": true,
  "version": "R4",
  "serverName": "Production FHIR Server",
  "responseTime": 250,
  "timestamp": "2025-09-30T12:00:00Z"
}
```

## Monitoring

### Health Checks

#### System Health
```bash
curl http://localhost:5000/api/health

# Healthy Response
{
  "status": "healthy",
  "timestamp": "2025-09-30T12:00:00Z",
  "uptime": 86400,
  "components": {
    "database": "healthy",
    "fhir_server": "healthy",
    "queue": "healthy"
  }
}

# Unhealthy Response
{
  "status": "unhealthy",
  "timestamp": "2025-09-30T12:00:00Z",
  "components": {
    "database": "unhealthy",
    "error": "Connection refused"
  }
}
```

#### Queue Health
```bash
curl http://localhost:5000/api/validation/queue/health

# Response
{
  "status": "healthy",
  "queueLength": 100,
  "processing": true,
  "errors": 0,
  "lastProcessed": "2025-09-30T11:59:50Z"
}
```

### Performance Metrics

#### Validation Progress
```bash
curl http://localhost:5000/api/validation/progress

# Response
{
  "totalResources": 1000,
  "processedResources": 250,
  "validResources": 230,
  "errorResources": 20,
  "currentResourceType": "Patient",
  "isComplete": false,
  "eta": "35 minutes",
  "startTime": "2025-09-30T12:00:00Z"
}
```

### Logs

#### View Recent Errors
```bash
curl http://localhost:5000/api/validation/errors/recent?limit=10

# Response
{
  "errors": [
    {
      "id": 1,
      "message": "Validation timeout for Patient/123",
      "severity": "error",
      "timestamp": "2025-09-30T11:55:00Z",
      "resourceType": "Patient",
      "resourceId": "123"
    }
  ]
}
```

## Troubleshooting

### Queue Not Processing

**Symptoms:**
- Queue status shows items but no progress
- Processed count not increasing

**Diagnosis:**
```bash
# Check queue status
curl http://localhost:5000/api/validation/queue/stats

# Check for errors
curl http://localhost:5000/api/validation/errors/recent
```

**Resolution:**
```bash
# 1. Try resume (in case paused)
curl -X POST http://localhost:5000/api/validation/queue/resume

# 2. If that fails, stop and restart
curl -X POST http://localhost:5000/api/validation/queue/stop
curl -X POST http://localhost:5000/api/validation/queue/start \
  -d '{"resourceTypes": ["Patient"]}'
```

### High Memory Usage

**Symptoms:**
- Server memory consumption > 2GB
- Slow response times

**Diagnosis:**
```bash
# Check queue size
curl http://localhost:5000/api/validation/queue/stats

# Check batch size setting
curl http://localhost:5000/api/validation/settings
```

**Resolution:**
```bash
# 1. Reduce batch size
curl -X PUT http://localhost:5000/api/validation/settings \
  -d '{"batchSize": 5}'

# 2. Pause and clear large queues
curl -X POST http://localhost:5000/api/validation/queue/pause
curl -X POST http://localhost:5000/api/validation/queue/stop
```

### Stale Validation Data

**Symptoms:**
- Old validation results displayed
- Results don't match current settings

**Diagnosis:**
```bash
# Check settings hash
curl http://localhost:5000/api/validation/settings

# Check validation result timestamps
curl 'http://localhost:5000/api/validation/resources/Patient/123/messages'
```

**Resolution:**
```bash
# Clear and revalidate
curl -X DELETE http://localhost:5000/api/validation/clear/resource-type/Patient
curl -X POST http://localhost:5000/api/validation/queue/start \
  -d '{"resourceTypes": ["Patient"]}'
```

## Maintenance Tasks

### Daily
- [ ] Check queue status and errors
- [ ] Review system health endpoints
- [ ] Monitor response times (p95 < budgets)

### Weekly
- [ ] Review and clear old validation results (>30 days)
- [ ] Check database size and index performance
- [ ] Review slow query logs

### Monthly
- [ ] Rebuild message groups for consistency
- [ ] Analyze validation patterns and adjust settings
- [ ] Review and optimize cache TTL settings

## Backup & Recovery

### Backup Validation Data
```bash
# Export validation results to JSON
curl http://localhost:5000/api/validation/export > validation-backup.json

# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore from Backup
```bash
# Database restore
psql $DATABASE_URL < backup_20250930.sql

# Rebuild groups after restore
curl -X POST http://localhost:5000/api/validation/groups/rebuild
```

## Feature Flags

### Check Feature Flags
```bash
# Flags are shown in health endpoint
curl http://localhost:5000/api/health

# Look for "feature_flags" section
{
  "feature_flags": {
    "DEMO_MOCKS": false,
    "EXPERIMENTAL_FEATURES": false,
    "PERFORMANCE_TRACKING": true
  }
}
```

### Emergency: Disable Feature
Set environment variable and restart:
```bash
export DEMO_MOCKS=false
pm2 restart records-fhir
```

## Escalation

### When to Escalate
- Queue stuck for > 30 minutes
- Database connection failures > 5 minutes
- Response times > 5 seconds sustained
- Memory usage > 4GB
- Error rate > 10%

### Escalation Process
1. Gather diagnostics (health checks, logs, queue stats)
2. Attempt standard troubleshooting (see above)
3. If unresolved, contact on-call engineer
4. Provide diagnostic info and steps already taken

## References
- **API Documentation:** `docs/technical/validation/API_DOCUMENTATION.md`
- **Troubleshooting Guide:** `docs/technical/validation/TROUBLESHOOTING_GUIDE.md`
- **Deployment Checklist:** `docs/deployment/DEPLOYMENT_CHECKLIST.md`
- **Testing Strategy:** `docs/technical/TESTING_STRATEGY.md`
