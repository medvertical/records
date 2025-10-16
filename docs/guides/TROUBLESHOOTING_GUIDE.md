# Validation Engine Troubleshooting Guide
**Task 12.12: Complete troubleshooting reference**

## Quick Diagnosis

```bash
# Check server status
curl http://localhost:3000/api/health

# Check performance
curl http://localhost:3000/api/performance/baseline/current | jq

# Check settings
curl http://localhost:3000/api/validation/settings | jq

# View performance dashboard
open http://localhost:3000/performance
```

---

## Performance Issues

### Validation Too Slow (>2s)

**Symptoms:**
- Validation takes >2 seconds
- Users complaining about slow response
- High latency in API calls

**Diagnosis:**
```bash
# Check which aspect is slow
curl http://localhost:3000/api/performance/timing/stats | jq '.byAspect'

# Check if optimizations enabled
curl http://localhost:3000/api/performance/pool/stats
curl http://localhost:3000/api/performance/validation/mode
```

**Solutions:**

1. **Enable HAPI Process Pool** (83% faster)
```bash
# Add to .env
HAPI_USE_PROCESS_POOL=true
HAPI_POOL_SIZE=5

# Restart server
npm restart
```

2. **Enable Parallel Validation** (40-60% faster)
```bash
# Via API
curl -X POST http://localhost:3000/api/performance/validation/mode \
  -H "Content-Type: application/json" \
  -d '{"parallel": true}'
```

3. **Increase Cache Sizes**
```bash
TERMINOLOGY_CACHE_SIZE=100000
PROFILE_CACHE_SIZE=2000
L1_CACHE_SIZE=2000
```

4. **Enable Profile Preloading**
```bash
ENABLE_PROFILE_PRELOADING=true
PROFILE_PRELOAD_ON_STARTUP=true
```

### Low Cache Hit Rate (<60%)

**Symptoms:**
- Cache hit rate below 60%
- Inconsistent performance
- First validations always slow

**Diagnosis:**
```bash
curl http://localhost:3000/api/performance/baseline/current | jq '.cacheEffectiveness'
```

**Solutions:**

1. **Increase Cache Sizes**
```bash
TERMINOLOGY_CACHE_SIZE=100000
L1_CACHE_SIZE=2000
```

2. **Increase TTLs**
```bash
TERMINOLOGY_CACHE_TTL=14400000  # 4 hours
L1_TERMINOLOGY_TTL=7200000      # 2 hours
```

3. **Check for Frequent Settings Changes**
- Settings changes invalidate caches
- Minimize settings updates in production

### High Memory Usage (>1GB)

**Symptoms:**
- Node.js process using >1GB RAM
- Out of memory errors
- System slowdowns

**Diagnosis:**
```bash
curl http://localhost:3000/api/performance/baseline/current | jq '.memoryUsageMB'
```

**Solutions:**

1. **Reduce HAPI Pool Size**
```bash
HAPI_POOL_SIZE=3  # Down from 5
HAPI_JAVA_HEAP=1536m  # Down from 2048m
```

2. **Reduce Cache Sizes**
```bash
TERMINOLOGY_CACHE_SIZE=25000  # Down from 50000
L1_CACHE_SIZE=500             # Down from 1000
```

3. **Enable More Frequent Cleanup**
```bash
TERMINOLOGY_CACHE_CLEANUP=300000  # 5 minutes
L2_CACHE_CLEANUP_INTERVAL=1800000  # 30 minutes
```

4. **Increase Node.js Memory Limit**
```bash
NODE_OPTIONS="--max-old-space-size=2048"
```

---

## Error Messages

### "HAPI validation failed"

**Cause:** HAPI FHIR Validator encountered an error

**Solutions:**

1. **Check Java Installation**
```bash
java -version
# Should be Java 17+
```

2. **Check HAPI Pool Status**
```bash
curl http://localhost:3000/api/performance/pool/stats
```

3. **Enable Process Pool**
```bash
HAPI_USE_PROCESS_POOL=true
```

4. **Check Logs**
```bash
tail -f logs/server.log | grep HAPI
```

### "Terminology server unavailable"

**Cause:** Cannot reach terminology server (tx.fhir.org)

**Solutions:**

1. **Check Network Connectivity**
```bash
curl -I https://tx.fhir.org/r4
```

2. **Enable Offline Mode**
```bash
VALIDATION_MODE=offline
```

3. **Use Secondary Server**
```bash
TERMINOLOGY_SERVER_PRIMARY=tx.dev.hl7.org.au
```

4. **Enable Fallback**
```bash
TERMINOLOGY_ENABLE_FALLBACK=true
```

### "Profile not found"

**Cause:** Referenced profile cannot be resolved

**Solutions:**

1. **Enable Profile Preloading**
```bash
ENABLE_PROFILE_PRELOADING=true
PROFILE_PRELOAD_ON_STARTUP=true
```

2. **Trigger Manual Preload**
```bash
curl -X POST http://localhost:3000/api/performance/profiles/preload
```

3. **Check Simplifier Connectivity**
```bash
curl -I https://simplifier.net
```

4. **Add Custom Profile**
```bash
CUSTOM_PROFILES_TO_PRELOAD=http://your-profile-url
```

### "DATABASE_URL must be set"

**Cause:** PostgreSQL connection not configured

**Solutions:**

1. **Set DATABASE_URL**
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

2. **Check PostgreSQL Running**
```bash
psql -h localhost -U user -d dbname
```

3. **Run Migrations**
```bash
npm run db:migrate
```

---

## Connection Issues

### Cannot Connect to Database

**Symptoms:**
- "ECONNREFUSED" errors
- "Connection terminated" errors
- Server crashes on startup

**Solutions:**

1. **Check PostgreSQL Running**
```bash
# macOS
brew services list | grep postgresql

# Linux
systemctl status postgresql

# Start if needed
brew services start postgresql  # macOS
systemctl start postgresql      # Linux
```

2. **Verify Connection String**
```bash
# Test connection
psql $DATABASE_URL

# Check format
# postgresql://user:password@host:port/database
```

3. **Check Firewall**
```bash
# Allow PostgreSQL port
sudo ufw allow 5432
```

4. **Check Logs**
```bash
# PostgreSQL logs
tail -f /usr/local/var/log/postgres.log  # macOS
journalctl -u postgresql                 # Linux
```

### Cannot Reach Terminology Server

**Symptoms:**
- Terminology validation failing
- "ETIMEDOUT" or "ENOTFOUND" errors
- Long validation times

**Solutions:**

1. **Test Connectivity**
```bash
curl -v https://tx.fhir.org/r4/metadata
```

2. **Check Proxy Settings**
```bash
# If behind corporate proxy
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port
```

3. **Use Alternative Server**
```bash
TERMINOLOGY_SERVER_PRIMARY=tx.dev.hl7.org.au
```

4. **Enable Offline Mode**
```bash
VALIDATION_MODE=offline
```

---

## Startup Issues

### Server Won't Start

**Symptoms:**
- Process exits immediately
- "Error: Cannot find module" errors
- Port already in use

**Solutions:**

1. **Install Dependencies**
```bash
npm ci
```

2. **Check Port Available**
```bash
# Check if port 3000 in use
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

3. **Check Node Version**
```bash
node -v
# Should be v18.0.0 or higher

# Use nvm to switch
nvm use 18
```

4. **Check Environment Variables**
```bash
# Verify .env file exists
cat .env

# Check required variables
echo $DATABASE_URL
echo $PORT
```

### Slow Startup (>30s)

**Symptoms:**
- Server takes >30 seconds to start
- "Preloading profiles..." message hangs

**Solutions:**

1. **Disable Startup Preloading**
```bash
PROFILE_PRELOAD_ON_STARTUP=false
```

2. **Preload After Startup**
```bash
# Start server first
npm start

# Then preload profiles
curl -X POST http://localhost:3000/api/performance/profiles/preload
```

3. **Reduce Pool Size**
```bash
HAPI_POOL_SIZE=2  # Fewer processes to spawn
```

---

## Testing Issues

### Tests Failing

**Symptoms:**
- "DATABASE_URL must be set" in tests
- Tests timing out
- Random test failures

**Solutions:**

1. **Set Test Database**
```bash
DATABASE_URL="postgresql://test:test@localhost:5432/test" npm test
```

2. **Increase Test Timeout**
```bash
# In test file
it('should validate', async () => {
  // test code
}, 10000);  // 10 second timeout
```

3. **Run Tests Individually**
```bash
npm test -- --run path/to/test.ts
```

4. **Clear Test Data**
```bash
npm run db:clear:all
npm run db:migrate
```

### Performance Tests Failing

**Symptoms:**
- Tests exceed time thresholds
- "expected X to be less than Y" errors

**Solutions:**

1. **Enable Optimizations**
```bash
HAPI_USE_PROCESS_POOL=true
ENABLE_PARALLEL_VALIDATION=true
```

2. **Warm Up Caches**
```bash
# Run validations before testing
# This is usually handled automatically
```

3. **Adjust Thresholds**
```typescript
// In test file
const THRESHOLD = 3000; // Increase if system is slow
```

4. **Check System Load**
```bash
# Ensure system not under heavy load
top
```

---

## Cache Issues

### Cache Not Working

**Symptoms:**
- Every validation is slow
- Cache hit rate is 0%
- No performance improvement

**Solutions:**

1. **Enable Caching**
```bash
L1_CACHE_ENABLED=true
L2_CACHE_ENABLED=true
TERMINOLOGY_CACHE_SIZE=50000
```

2. **Check Cache Stats**
```bash
curl http://localhost:3000/api/cache/stats
```

3. **Clear and Rebuild Cache**
```bash
curl -X DELETE http://localhost:3000/api/cache/clear
# Then run validations to populate
```

4. **Verify Settings Stable**
- Settings changes invalidate caches
- Ensure settings not changing frequently

### Cache Growing Too Large

**Symptoms:**
- High memory usage
- Slow cache lookups
- Out of memory errors

**Solutions:**

1. **Reduce Cache Sizes**
```bash
TERMINOLOGY_CACHE_SIZE=25000
L1_CACHE_SIZE=500
```

2. **Reduce TTLs**
```bash
TERMINOLOGY_CACHE_TTL=3600000  # 1 hour
L1_VALIDATION_TTL=180000       # 3 minutes
```

3. **Enable More Frequent Cleanup**
```bash
TERMINOLOGY_CACHE_CLEANUP=300000  # 5 minutes
```

4. **Clear Caches**
```bash
curl -X DELETE http://localhost:3000/api/cache/clear
```

---

## Integration Issues

### Cannot Validate Against FHIR Server

**Symptoms:**
- Reference validation failing
- "Resource not found" errors
- Connection refused

**Solutions:**

1. **Check FHIR Server URL**
```bash
FHIR_SERVER_URL=http://localhost:8080/fhir
```

2. **Test FHIR Server**
```bash
curl http://localhost:8080/fhir/metadata
```

3. **Disable Reference Validation**
```bash
# Via settings
{
  "aspects": {
    "reference": { "enabled": false }
  }
}
```

### Business Rules Not Working

**Symptoms:**
- Custom rules not executing
- No validation errors for rule violations
- Rules not appearing in UI

**Solutions:**

1. **Check Rules Enabled**
```bash
curl http://localhost:3000/api/validation/settings | jq '.aspects.businessRules'
```

2. **List Rules**
```bash
curl http://localhost:3000/api/validation/rules
```

3. **Test Rule**
```bash
curl -X POST http://localhost:3000/api/validation/rules/:id/test \
  -H "Content-Type: application/json" \
  -d '{"resource": {...}}'
```

4. **Check FHIRPath Syntax**
- Verify FHIRPath expression is valid
- Test in rule editor UI

---

## Deployment Issues

### Docker Container Won't Start

**Symptoms:**
- Container exits immediately
- "Cannot connect to database" errors
- Java not found

**Solutions:**

1. **Check Java in Container**
```dockerfile
# In Dockerfile, ensure Java installed
RUN apk add --no-cache openjdk17-jre
```

2. **Pass Environment Variables**
```bash
docker run -e DATABASE_URL=... -e HAPI_USE_PROCESS_POOL=true ...
```

3. **Use docker-compose**
```bash
docker-compose up -d
docker-compose logs -f
```

4. **Check Container Logs**
```bash
docker logs <container-id>
```

### Production Performance Poor

**Symptoms:**
- Slower than development
- High latency
- Timeouts

**Solutions:**

1. **Enable Production Optimizations**
```bash
NODE_ENV=production
HAPI_USE_PROCESS_POOL=true
HAPI_POOL_SIZE=8
ENABLE_PARALLEL_VALIDATION=true
```

2. **Increase Resources**
- More CPU cores
- More RAM (16GB+ recommended)
- Faster database

3. **Enable All Caching**
```bash
L1_CACHE_ENABLED=true
L2_CACHE_ENABLED=true
TERMINOLOGY_CACHE_SIZE=100000
```

4. **Use Production Database**
- Not SQLite
- PostgreSQL 15+
- Proper indexes

---

## Logging & Debugging

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm start
```

### Check Logs

```bash
# Application logs
tail -f logs/server.log

# Filter by component
tail -f logs/server.log | grep "ValidationEngine"
tail -f logs/server.log | grep "HAPI"

# Error logs only
tail -f logs/server.log | grep "ERROR"
```

### Enable Performance Profiling

```bash
# Timing profile
npm run profile:timing

# CPU profile
npm run profile:cpu

# Memory profile
npm run profile:memory
```

### Check Performance Metrics

```bash
# Current baseline
curl http://localhost:3000/api/performance/baseline/current

# Timing stats
curl http://localhost:3000/api/performance/timing/stats

# Pool stats
curl http://localhost:3000/api/performance/pool/stats
```

---

## Getting Help

### Gather Diagnostic Information

```bash
# System info
node -v
npm -v
psql --version
java -version

# Configuration
cat .env | grep -v PASSWORD

# Performance status
curl http://localhost:3000/api/performance/baseline/current

# Settings
curl http://localhost:3000/api/validation/settings

# Recent logs
tail -100 logs/server.log
```

### Common Questions

**Q: Why is first validation slow?**  
A: First validation is "cold start" - caches empty, processes need spawning. Enable profile preloading and process pool for 76% faster cold starts.

**Q: How to make validation faster?**  
A: Enable all optimizations (HAPI pool, parallel validation, profile preloading, larger caches). See [OPTIMIZATION_MASTER_GUIDE.md](../performance/OPTIMIZATION_MASTER_GUIDE.md).

**Q: Can I run without internet?**  
A: Yes, set `VALIDATION_MODE=offline`. Terminology and profile validation will use caches only.

**Q: How much RAM do I need?**  
A: Minimum 4GB, recommended 8GB+. Adjust HAPI pool size based on available RAM.

**Q: How to improve cache hit rate?**  
A: Increase cache sizes, increase TTLs, ensure settings are stable (changes invalidate caches).

---

## Related Documentation

- [Configuration Guide](./CONFIGURATION_GUIDE.md)
- [Architecture Guide](../architecture/VALIDATION_ENGINE_ARCHITECTURE.md)
- [Performance Optimization](../performance/OPTIMIZATION_MASTER_GUIDE.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

## Summary

**Most Common Issues:**

1. **Slow validation** → Enable HAPI pool + parallel validation
2. **High memory** → Reduce pool size and cache sizes
3. **Cannot connect** → Check DATABASE_URL and PostgreSQL running
4. **Tests failing** → Set DATABASE_URL for tests
5. **Startup slow** → Disable profile preload on startup

**Quick Fixes:**

```bash
# Performance
HAPI_USE_PROCESS_POOL=true
ENABLE_PARALLEL_VALIDATION=true

# Memory
HAPI_POOL_SIZE=3
TERMINOLOGY_CACHE_SIZE=25000

# Connectivity
VALIDATION_MODE=hybrid
ENABLE_OFFLINE_FALLBACK=true
```

**Performance Dashboard:** http://localhost:3000/performance

Still having issues? Check the logs, gather diagnostic info, and consult the documentation!

