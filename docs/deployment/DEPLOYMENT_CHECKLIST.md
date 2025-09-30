# Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Configuration
- [ ] `DATABASE_URL` is set correctly for production database
- [ ] `NODE_ENV=production`
- [ ] **CRITICAL**: `DEMO_MOCKS=false` (or unset, defaults to false)
- [ ] All required environment variables are set
- [ ] No hardcoded secrets in code
- [ ] `.env` file is NOT committed to git

### 2. Code Quality
- [ ] All CI checks pass (GitHub Actions green)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No linting errors (`npm run lint`)
- [ ] Test coverage meets threshold (`npm test -- --coverage`)
- [ ] No hardcoded FHIR URLs in production code
- [ ] No ungated mock responses

### 3. Database
- [ ] Migrations tested on staging database
- [ ] Migration rollback tested and documented
- [ ] Database backups configured
- [ ] Connection pooling configured
- [ ] Indexes created for performance-critical queries

### 4. Security
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] Rate limiting configured (`securityMiddleware`)
- [ ] Input validation in place (Zod schemas)
- [ ] CORS configured appropriately
- [ ] Secrets managed via environment variables
- [ ] HTTPS enforced in production

### 5. Performance
- [ ] List/Group API p95 < 500ms (verified)
- [ ] Detail API p95 < 300ms (verified)
- [ ] Cache TTL configured (default: 30s)
- [ ] Query optimization reviewed
- [ ] Build size acceptable (<10MB recommended)

### 6. Monitoring & Observability
- [ ] Error logging configured
- [ ] Performance metrics collection enabled
- [ ] Health check endpoint accessible (`/api/health`)
- [ ] Validation queue monitoring in place
- [ ] Dashboard displays real data (no mocks)

### 7. Feature Flags
- [ ] `DEMO_MOCKS=false` (production safety)
- [ ] `ENABLE_AUDIT_TRAIL=true` (recommended)
- [ ] `ENABLE_PERFORMANCE_TRACKING=true` (low overhead)
- [ ] `ENABLE_EXPERIMENTAL_FEATURES=false` (unless testing)
- [ ] `STRICT_VALIDATION_MODE=false` (unless required)

### 8. FHIR Server Configuration
- [ ] Active FHIR server is configured
- [ ] FHIR server credentials are valid
- [ ] FHIR server connection tested
- [ ] Validation aspects configured correctly
- [ ] Resource type filters set appropriately

### 9. Documentation
- [ ] README.md is up to date
- [ ] API documentation complete
- [ ] Migration procedures documented
- [ ] Rollback procedures documented
- [ ] Known issues/limitations documented

### 10. Deployment Process
- [ ] Deployment script tested on staging
- [ ] Zero-downtime strategy defined
- [ ] Database migration strategy defined
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

## Deployment Steps

### 1. Pre-Deployment
```bash
# Run all checks
npm run lint
npx tsc --noEmit
npm test -- --run
./scripts/check-no-mocks.sh

# Build for production
npm run build
```

### 2. Database Migration
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Run migrations
npm run db:migrate
```

### 3. Application Deployment
```bash
# Set environment variables
export NODE_ENV=production
export DEMO_MOCKS=false
export DATABASE_URL="postgresql://..."

# Start application
npm start

# Or with PM2
pm2 start npm --name "records-fhir" -- start
```

### 4. Post-Deployment Verification
```bash
# Check server health
curl http://localhost:5000/api/health

# Verify no mock data in responses
# - Test dashboard stats
# - Test validation progress
# - Test FHIR server list
# - All should return real data or 503 errors

# Check logs for errors
pm2 logs records-fhir --lines 100

# Monitor performance
# - Check response times
# - Check database connection pool
# - Check memory usage
```

### 5. Smoke Tests
- [ ] Dashboard loads successfully
- [ ] FHIR servers are listed correctly
- [ ] Resource browsing works
- [ ] Validation triggers correctly
- [ ] Queue controls work (start/pause/resume/stop)
- [ ] Resource editing works
- [ ] No mock data appears in any view

## Rollback Procedure

### Quick Rollback
```bash
# Stop current deployment
pm2 stop records-fhir

# Restore previous version
git checkout <previous-tag>
npm ci
npm run build

# Rollback database if needed
npm run db:migrate:down

# Restart with previous version
pm2 restart records-fhir
```

### Database Rollback
```bash
# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Or run down migration
npm run db:migrate:down
```

## Emergency Contacts
- Dev Team Lead: [Contact Info]
- Database Admin: [Contact Info]
- DevOps: [Contact Info]
- On-Call: [Contact Info]

## Post-Deployment Monitoring (First 24h)
- [ ] Monitor error rates (target: <1%)
- [ ] Monitor response times (p95 within budgets)
- [ ] Monitor database performance
- [ ] Monitor memory usage
- [ ] Check for any mock data leaks
- [ ] Verify validation accuracy
- [ ] Review user feedback/support tickets

## Success Criteria
- ✅ All health checks passing
- ✅ No 5xx errors in production
- ✅ Response times within budgets
- ✅ All features working as expected
- ✅ No mock data in production
- ✅ Database migrations successful
- ✅ Monitoring/alerts operational
