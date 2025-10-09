# Records FHIR Platform - Troubleshooting Guide

**Version:** MVP v1.2  
**Last Updated:** 2025-10-09

---

## 📋 Table of Contents

1. [Installation Issues](#installation-issues)
2. [Connection Problems](#connection-problems)
3. [Validation Errors](#validation-errors)
4. [Performance Issues](#performance-issues)
5. [Database Problems](#database-problems)
6. [Configuration Issues](#configuration-issues)
7. [Common Error Messages](#common-error-messages)
8. [Debug Mode](#debug-mode)
9. [Getting Support](#getting-support)

---

## 🔧 Installation Issues

### 1. HAPI Validator JAR Not Found

**Error:**
```
Error: HAPI validator JAR not found at server/lib/validator_cli.jar
Please run: bash scripts/setup-hapi-validator.sh
```

**Cause:** HAPI FHIR Validator CLI is not installed

**Solution:**
```bash
# Automated setup
bash scripts/setup-hapi-validator.sh

# Manual setup
mkdir -p server/lib
curl -L -o server/lib/validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.23/validator_cli.jar
```

**Verify:**
```bash
ls -lh server/lib/validator_cli.jar
# Should show ~30-40 MB file
```

---

### 2. Java Runtime Not Found

**Error:**
```
Error: Java Runtime not found (required: Java 11+)
Please install Java: https://adoptium.net/
```

**Cause:** Java is not installed or not in PATH

**Solution:**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install openjdk-11-jre -y
java -version  # Verify
```

**macOS:**
```bash
brew install openjdk@11
echo 'export PATH="/opt/homebrew/opt/openjdk@11/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
java -version
```

**Windows:**
1. Download from [Adoptium.net](https://adoptium.net/)
2. Install and add to PATH
3. Restart terminal
4. Run `java -version`

---

### 3. npm install Fails with Peer Dependency Errors

**Error:**
```
npm error ERESOLVE could not resolve
npm error Could not resolve dependency:
npm error peer vite@"^5.2.0 || ^6" from @tailwindcss/vite@4.1.3
```

**Cause:** Peer dependency version conflicts

**Solution:**
```bash
# Use legacy peer deps flag
npm install --legacy-peer-deps

# Or force (not recommended)
npm install --force
```

---

### 4. Database Connection Failed

**Error:**
```
Error: ECONNREFUSED 127.0.0.1:5432
Connection to database failed
```

**Cause:** PostgreSQL is not running or wrong credentials

**Solution:**

**Check if PostgreSQL is running:**
```bash
# Linux
sudo systemctl status postgresql

# macOS
brew services list | grep postgresql
```

**Start PostgreSQL:**
```bash
# Linux
sudo systemctl start postgresql

# macOS
brew services start postgresql@14
```

**Verify connection:**
```bash
psql -U postgres -h localhost -p 5432
```

**Check DATABASE_URL in .env:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/records
#                          ^^^^  ^^^^^^^^  ^^^^^^^^^       ^^^^^^^
#                          user  password  host:port       database
```

---

## 🔌 Connection Problems

### 1. FHIR Server Connection Failed

**Error:**
```
Failed to connect to FHIR server: ECONNREFUSED
Server: https://fhir.example.com/baseR4
```

**Causes & Solutions:**

**A. Server is down or unreachable**
```bash
# Test with curl
curl -I https://fhir.example.com/baseR4/metadata

# If fails, server is down
```

**B. Wrong URL**
```bash
# Common mistakes:
❌ https://fhir.example.com           # Missing /baseR4
❌ https://fhir.example.com/fhir      # Wrong path
✅ https://fhir.example.com/baseR4    # Correct
```

**C. Authentication required**
```bash
# Add auth in server settings:
Authorization: Bearer your-token-here

# Or in .env:
FHIR_SERVER_AUTH=Bearer your-token
```

**D. SSL certificate issues**
```bash
# For development only (not production!):
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
```

---

### 2. Ontoserver Not Accessible

**Error:**
```
Terminology validation failed: Ontoserver not accessible
URL: http://localhost:8081/fhir
```

**Solution:**

**Check if Ontoserver is running:**
```bash
docker ps | grep ontoserver
```

**Start Ontoserver:**
```bash
docker-compose up -d ontoserver
```

**Verify health:**
```bash
curl http://localhost:8081/fhir/metadata
```

**Check logs:**
```bash
docker logs ontoserver
```

---

### 3. tx.fhir.org Timeout

**Error:**
```
Terminology validation timed out after 30 seconds
Server: https://tx.fhir.org/r4
```

**Causes & Solutions:**

**A. Network connectivity**
```bash
# Test connection
curl -I https://tx.fhir.org/r4/metadata

# If slow, increase timeout in .env:
HAPI_VALIDATOR_TIMEOUT=60000  # 60 seconds
```

**B. tx.fhir.org is overloaded**
- Switch to **Offline Mode** (Settings → Validation Mode)
- Use local Ontoserver

**C. Firewall blocking**
- Check corporate firewall rules
- Add tx.fhir.org to whitelist

---

## ❌ Validation Errors

### 1. All Resources Show 100% Score (False Positives)

**Error:**
All resources pass validation with no issues, even invalid ones

**Cause:** HAPI validator not integrated or stub validators still active

**Solution:**

**1. Verify HAPI validator is installed:**
```bash
ls -lh server/lib/validator_cli.jar
java -jar server/lib/validator_cli.jar --help
```

**2. Check logs for HAPI calls:**
```bash
DEBUG=validation:* npm run dev
# Should see: "Running HAPI validator for resource..."
```

**3. Test HAPI validator directly:**
```bash
echo '{"resourceType": "Patient"}' > test.json
java -jar server/lib/validator_cli.jar test.json -version r4
# Should show validation errors
```

**4. Restart application:**
```bash
# Clear cache
rm -rf node_modules/.cache
npm run dev
```

---

### 2. Profile Validation Always Fails

**Error:**
```
Profile validation failed: StructureDefinition not found
Profile: http://example.org/fhir/StructureDefinition/MyProfile
```

**Cause:** Profile package not installed

**Solution:**

**1. Check installed packages:**
- Settings → Packages → View installed

**2. Install required package:**
```bash
# Via UI:
Settings → Packages → + Install Package

# Or via API:
POST /api/validation/profile-packages/install
{
  "packageId": "de.basisprofil.r4",
  "version": "1.5.0"
}
```

**3. Verify profile URL in resource:**
```json
{
  "resourceType": "Patient",
  "meta": {
    "profile": [
      "http://fhir.de/StructureDefinition/patient-de-basis/1.5.0"
      // Must match installed package
    ]
  }
}
```

---

### 3. Terminology Validation Fails

**Error:**
```
CodeSystem not found: http://loinc.org
Unable to validate code: 29463-7
```

**Causes & Solutions:**

**A. Online mode but tx.fhir.org unreachable**
- Switch to **Hybrid Mode** or **Offline Mode**

**B. Offline mode but CodeSystem not loaded**
```bash
# Load CodeSystems into Ontoserver
curl -X POST http://localhost:8081/fhir \
  -H "Content-Type: application/json" \
  -d @codesystem-loinc.json
```

**C. Invalid code in resource**
- Check code is valid in CodeSystem
- Verify ValueSet binding
- Review error message for suggestions

---

### 4. Reference Validation Fails

**Error:**
```
Reference not found: Patient/123
Referenced from: Observation/456
```

**Cause:** Referenced resource does not exist on server

**Solution:**

**A. Create missing resource**
- Ensure referenced Patient/123 exists
- Validate in correct order (Patient before Observation)

**B. Update reference**
```json
{
  "subject": {
    "reference": "Patient/123"  // Change to existing ID
  }
}
```

**C. Use contained resources**
```json
{
  "resourceType": "Observation",
  "contained": [
    {
      "resourceType": "Patient",
      "id": "123"
    }
  ],
  "subject": {
    "reference": "#123"  // Internal reference
  }
}
```

---

### 5. R6 Validation Limited

**Warning:**
```
⚠️ FHIR R6 Limited Support
Terminology and reference validation not available
```

**Cause:** R6 is still experimental, limited support

**Workaround:**
- Use **R4** or **R5** servers for full validation
- For R6: Accept limited validation (structure + profile only)
- Wait for R6 specification finalization

---

## ⚡ Performance Issues

### 1. Validation is Slow

**Symptoms:**
- Takes > 5 seconds per resource
- UI is unresponsive
- Timeout errors

**Solutions:**

**A. Adjust concurrency settings:**
```
Settings → Validation → Performance Settings

Max Concurrent: 10 (was: 5)
Batch Size: 100 (was: 50)
```

**B. Reduce enabled aspects:**
- Disable aspects you don't need
- Profile validation is slowest

**C. Check server resources:**
```bash
# CPU usage
top
# Memory usage
free -h
# Disk I/O
iostat -x 1
```

**D. Optimize database:**
```sql
-- Analyze tables
ANALYZE validation_results_per_aspect;

-- Vacuum
VACUUM ANALYZE;

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename LIKE 'validation%';
```

---

### 2. Out of Memory Errors

**Error:**
```
<--- Last few GCs --->
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Cause:** Node.js default heap size too small (512 MB)

**Solution:**

**A. Increase heap size:**
```bash
# In .env
NODE_OPTIONS=--max-old-space-size=4096

# Or inline:
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

**B. Reduce batch size:**
```
Settings → Performance → Batch Size: 20 (was: 100)
```

**C. Enable worker threads:**
```bash
# In .env
ENABLE_WORKER_THREADS=true
VALIDATION_MAX_WORKERS=3
```

---

### 3. Database Query Timeout

**Error:**
```
Error: Query timeout after 30 seconds
SELECT * FROM validation_results_per_aspect...
```

**Solutions:**

**A. Add missing indexes:**
```sql
-- Check missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.5;

-- Add recommended indexes
CREATE INDEX idx_validation_results_resource_id 
  ON validation_results_per_aspect(resource_id);
```

**B. Increase query timeout:**
```sql
-- In PostgreSQL config
ALTER DATABASE records SET statement_timeout = '60s';
```

**C. Optimize queries:**
```sql
-- Use EXPLAIN ANALYZE
EXPLAIN ANALYZE
SELECT * FROM validation_results_per_aspect
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## 🗄️ Database Problems

### 1. Migration Failed

**Error:**
```
Error: Migration failed: relation "validation_results_per_aspect" already exists
```

**Solution:**

**A. Check migration status:**
```bash
npm run db:migrate:status
```

**B. Rollback failed migration:**
```bash
npm run db:migrate:down
```

**C. Force clean state (⚠️ deletes data):**
```bash
# Backup first!
pg_dump records > backup_$(date +%Y%m%d).sql

# Drop and recreate
dropdb records
createdb records
npm run db:migrate
```

---

### 2. Database Disk Full

**Error:**
```
ERROR: could not write to file "base/16385/123456": No space left on device
```

**Solution:**

**A. Check disk space:**
```bash
df -h /var/lib/postgresql
```

**B. Clean old validation data:**
```bash
# Via API
POST /api/validation/cleanup
{
  "olderThan": "30 days"
}

# Or SQL
DELETE FROM validation_messages
WHERE created_at < NOW() - INTERVAL '30 days';

VACUUM FULL validation_messages;
```

**C. Clear export files:**
```bash
# Delete old exports
find ./exports -name "*.json.gz" -mtime +30 -delete
```

---

### 3. Too Many Database Connections

**Error:**
```
ERROR: sorry, too many clients already
FATAL: remaining connection slots are reserved
```

**Solution:**

**A. Check current connections:**
```sql
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'records';
```

**B. Increase max connections:**
```sql
-- In postgresql.conf
max_connections = 200  # Was: 100

-- Reload
SELECT pg_reload_conf();
```

**C. Adjust connection pool:**
```bash
# In .env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10  # Was: 20
```

---

## ⚙️ Configuration Issues

### 1. Environment Variables Not Loaded

**Error:**
Configuration values are undefined or using defaults

**Solution:**

**A. Verify .env exists:**
```bash
ls -la .env
# Should exist in project root
```

**B. Check .env syntax:**
```bash
# Correct:
DATABASE_URL=postgresql://user:pass@localhost/db

# Wrong:
DATABASE_URL = postgresql://user:pass@localhost/db  # No spaces!
DATABASE_URL="postgresql://..."  # No quotes!
```

**C. Restart application:**
```bash
# Kill all node processes
pkill node

# Start again
npm run dev
```

---

### 2. Settings Not Persisting

**Error:**
Changed validation settings revert after page reload

**Cause:** Database not saving settings

**Solution:**

**A. Check database connection:**
```bash
psql -U records_user -d records
\dt validation_settings
```

**B. Verify save API call:**
```bash
# Browser DevTools → Network tab
# Look for: PUT /api/validation/settings
# Should return: 200 OK
```

**C. Check user permissions:**
```sql
SELECT * FROM pg_tables 
WHERE tablename = 'validation_settings';

-- Verify ownership
```

---

## 🚨 Common Error Messages

### "Cannot find module './server/db'"

**Error:**
```
Error: Cannot find module './server/db'
```

**Cause:** Drizzle CLI path issue

**Solution:**
```bash
# Run migrations from project root
cd /path/to/records
npm run db:migrate

# Not from subdirectory
```

---

### "HAPI validation failed after 3 attempts"

**Error:**
```
HAPI validation failed after 3 attempts
Last error: Connection timed out
```

**Solutions:**
1. **Increase retry count:**
   ```bash
   # In .env
   HAPI_VALIDATOR_MAX_RETRIES=5
   ```

2. **Increase timeout:**
   ```bash
   HAPI_VALIDATOR_TIMEOUT=60000  # 60 seconds
   ```

3. **Check HAPI validator:**
   ```bash
   java -jar server/lib/validator_cli.jar --help
   ```

---

### "Validation aspect skipped"

**Warning:**
```
⏭️ Aspect skipped: Terminology
Reason: No terminology server configured
```

**Cause:** Terminology server not configured

**Solution:**
- **Online Mode**: Ensure tx.fhir.org is accessible
- **Offline Mode**: Setup and start Ontoserver
- **Hybrid Mode**: Configure both

---

## 🐛 Debug Mode

### Enable Debug Logging

**Full debug:**
```bash
DEBUG=* npm run dev
```

**Validation only:**
```bash
DEBUG=validation:* npm run dev
```

**Database only:**
```bash
DEBUG=db:* npm run dev
```

### Check Logs

**Application logs:**
```bash
# Development
tail -f logs/app.log

# Production
journalctl -u records -f
```

**PostgreSQL logs:**
```bash
# Linux
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# macOS
tail -f /opt/homebrew/var/log/postgresql@14.log
```

**Docker logs:**
```bash
docker-compose logs -f app
docker-compose logs -f postgres
docker-compose logs -f ontoserver
```

---

## 📞 Getting Support

### Before Requesting Support

**1. Collect information:**
```bash
# Application version
npm run version

# Node.js version
node -v

# PostgreSQL version
psql --version

# Java version
java -version
```

**2. Export logs:**
```bash
# Last 100 lines
tail -100 logs/app.log > logs_export.txt
```

**3. Check existing issues:**
- Search [GitHub Issues](https://github.com/your-repo/issues)
- Check this troubleshooting guide

### How to Report Issues

**Create issue with:**

1. **Title:** Short, descriptive summary
2. **Description:** Detailed problem description
3. **Steps to reproduce**
4. **Expected behavior**
5. **Actual behavior**
6. **Environment:**
   - OS and version
   - Node.js version
   - PostgreSQL version
   - Java version
7. **Logs:** Relevant error messages
8. **Screenshots:** If UI-related

### Contact

- 📖 **Documentation**: [docs/](../../)
- 🐛 **Issues**: GitHub Issues
- 💬 **Discussions**: GitHub Discussions
- 📧 **Email**: support@example.com

---

## 🔍 Additional Resources

- [User Guide](./USER_GUIDE.md) - Full user documentation
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Deployment instructions
- [Validation Architecture](../technical/validation/VALIDATION_ARCHITECTURE.md) - Technical details
- [Multi-Version Support](../technical/validation/MULTI_VERSION_SUPPORT.md) - R4/R5/R6 documentation

---

**Last Updated:** 2025-10-09  
**Next Review:** Q1 2026

