# Records FHIR Platform - Deployment Guide

**Version:** MVP v1.2  
**Last Updated:** 2025-10-09

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Docker Compose)](#quick-start-docker-compose)
3. [Manual Deployment](#manual-deployment)
4. [Ontoserver Setup](#ontoserver-setup)
5. [Production Deployment](#production-deployment)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Health Checks](#health-checks)
9. [Monitoring & Logging](#monitoring--logging)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Prerequisites

### System Requirements

**Minimum:**
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Disk**: 10 GB free space
- **OS**: Linux, macOS, or Windows (with WSL2)

**Recommended (Production):**
- **CPU**: 4-8 cores
- **RAM**: 16 GB
- **Disk**: 50 GB (SSD recommended)
- **OS**: Linux (Ubuntu 20.04+ or Debian 11+)

### Software Dependencies

**Required:**
- **Node.js**: 18.x or 20.x ([Download](https://nodejs.org/))
- **PostgreSQL**: 12+ ([Download](https://www.postgresql.org/download/))
- **Java Runtime**: 11+ ([Download](https://adoptium.net/))
- **Git**: Latest version

**Optional (for offline validation):**
- **Docker**: 20.10+ ([Download](https://docs.docker.com/get-docker/))
- **Docker Compose**: 1.29+ (included with Docker Desktop)

### FHIR Server

You need access to a FHIR server (R4, R5, or R6):

**Public test servers:**
- HAPI FHIR R4: `https://hapi.fhir.org/baseR4`
- HAPI FHIR R5: `https://hapi.fhir.org/baseR5`

**Or deploy your own:**
- [HAPI FHIR Server](https://github.com/hapifhir/hapi-fhir-jpaserver-starter)
- [Firely Server](https://fire.ly/products/firely-server/)

---

## 🚀 Quick Start (Docker Compose)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/records-fhir-platform.git
cd records-fhir-platform
```

### 2. Configure Environment

```bash
cp env.example.txt .env
```

Edit `.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/records

# FHIR Server (use your own or public test server)
DEFAULT_FHIR_SERVER_URL=https://hapi.fhir.org/baseR4

# Ontoserver (for offline validation)
ONTOSERVER_URL=http://ontoserver:8080/fhir

# Application
NODE_ENV=production
PORT=3000
FRONTEND_PORT=5174
```

### 3. Start Services

```bash
docker-compose up -d
```

**Services started:**
- ✅ **App** (port 3000) - Records FHIR Platform
- ✅ **PostgreSQL** (port 5432) - Database
- ✅ **Ontoserver** (port 8081) - Terminology server

### 4. Access Application

- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3000
- **Ontoserver**: http://localhost:8081

### 5. Initialize Database

```bash
# Run migrations
docker-compose exec app npm run db:migrate

# Seed dev data (optional)
docker-compose exec app npm run db:seed:dev
```

### 6. Setup HAPI Validator

```bash
# Inside container
docker-compose exec app bash scripts/setup-hapi-validator.sh
```

---

## ⚙️ Manual Deployment

### 1. Install Dependencies

```bash
# Clone repository
git clone https://github.com/your-org/records-fhir-platform.git
cd records-fhir-platform

# Install Node.js dependencies
npm install --legacy-peer-deps
```

### 2. Install Java Runtime

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install openjdk-11-jre -y
java -version  # Verify installation
```

**macOS:**
```bash
brew install openjdk@11
echo 'export PATH="/opt/homebrew/opt/openjdk@11/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
java -version
```

**Windows:**
- Download from [Adoptium.net](https://adoptium.net/)
- Install and add to PATH
- Verify: `java -version`

### 3. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Create database:**
```bash
sudo -u postgres psql
CREATE DATABASE records;
CREATE USER records_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE records TO records_user;
\q
```

### 4. Setup HAPI Validator

```bash
bash scripts/setup-hapi-validator.sh
```

Or manually:

```bash
mkdir -p server/lib
curl -L -o server/lib/validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.23/validator_cli.jar
```

### 5. Configure Environment

```bash
cp env.example.txt .env
```

Edit `.env` with your database credentials and FHIR server URL.

### 6. Run Database Migrations

```bash
npm run db:migrate
```

### 7. Build Application

```bash
# Build frontend
npm run build

# Or for development
npm run dev:full
```

### 8. Start Application

**Development:**
```bash
npm run dev:full
```

**Production:**
```bash
NODE_ENV=production npm start
```

---

## 📦 Ontoserver Setup

Ontoserver provides **offline terminology validation** for German healthcare profiles.

### Docker Compose (Recommended)

Already included in `docker-compose.yml`:

```yaml
services:
  ontoserver:
    image: aehrc/ontoserver:latest
    ports:
      - "8081:8080"
    environment:
      - JAVA_OPTS=-Xmx4g
    volumes:
      - ontoserver-data:/var/ontoserver
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/fhir/metadata"]
      interval: 30s
      timeout: 10s
      retries: 3
```

**Start:**
```bash
docker-compose up -d ontoserver
```

### Manual Docker Installation

```bash
# Pull image
docker pull aehrc/ontoserver:latest

# Run container
docker run -d \
  --name ontoserver \
  -p 8081:8080 \
  -e JAVA_OPTS=-Xmx4g \
  -v ontoserver-data:/var/ontoserver \
  aehrc/ontoserver:latest
```

### Verify Installation

```bash
# Check health
curl http://localhost:8081/fhir/metadata

# Expected: CapabilityStatement JSON
```

### Load German Terminology

```bash
# Download German CodeSystems and ValueSets
# (Requires BfArM or KBV credentials)

# Import into Ontoserver
curl -X POST http://localhost:8081/fhir \
  -H "Content-Type: application/json" \
  -d @codesystem-german-icd10.json
```

**German Terminology Sources:**
- **ICD-10-GM**: [BfArM](https://www.bfarm.de/)
- **OPS**: [BfArM](https://www.bfarm.de/)
- **LOINC German**: [LOINC.org](https://loinc.org/)
- **SNOMED CT German Edition**: [SNOMED International](https://www.snomed.org/)

### Configure Records Platform

Update `.env`:

```bash
TERMINOLOGY_MODE=offline  # or 'hybrid'
ONTOSERVER_URL=http://localhost:8081/fhir
```

Or use UI:
- Settings → Validation → Mode → **Offline**

---

## 🏭 Production Deployment

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Load Balancer (Nginx)                │
│                   (HTTPS, Port 443)                      │
└─────────────────────┬────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        v             v             v
┌───────────┐  ┌───────────┐  ┌───────────┐
│  App (1)  │  │  App (2)  │  │  App (3)  │
│  Port     │  │  Port     │  │  Port     │
│  3000     │  │  3001     │  │  3002     │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      └──────────────┼──────────────┘
                     │
                     v
            ┌────────────────┐
            │   PostgreSQL   │
            │   (Primary)    │
            └────────┬───────┘
                     │
            ┌────────┴───────┐
            │                │
            v                v
      ┌──────────┐    ┌──────────┐
      │ Replica  │    │ Replica  │
      │  (Read)  │    │  (Read)  │
      └──────────┘    └──────────┘
```

### 1. Nginx Configuration

```nginx
# /etc/nginx/sites-available/records

upstream records_backend {
    server localhost:3000 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3001 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3002 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name records.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name records.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/records.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/records.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to backend
    location /api {
        proxy_pass http://records_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Frontend (static files)
    location / {
        root /var/www/records/dist;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://records_backend;
        access_log off;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/records /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Systemd Service

```ini
# /etc/systemd/system/records.service

[Unit]
Description=Records FHIR Platform
After=network.target postgresql.service

[Service]
Type=simple
User=records
WorkingDirectory=/opt/records-fhir-platform
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/records-fhir-platform/logs

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable records
sudo systemctl start records
sudo systemctl status records
```

### 3. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start app with PM2
pm2 start npm --name "records" -- start

# Configure cluster mode (3 instances)
pm2 start npm --name "records" -i 3 -- start

# Save PM2 config
pm2 save

# Auto-start on boot
pm2 startup systemd
```

**PM2 Ecosystem Config** (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'records',
    script: 'dist/index.js',
    instances: 3,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '1G',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 4. PostgreSQL Production Setup

```sql
-- Production database configuration
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '26214kB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;

-- Reload configuration
SELECT pg_reload_conf();
```

**Backup script:**
```bash
#!/bin/bash
# /opt/backup/records-db-backup.sh

BACKUP_DIR="/opt/backup/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="records"

mkdir -p $BACKUP_DIR

# Full backup
pg_dump -U postgres -Fc $DB_NAME > $BACKUP_DIR/${DB_NAME}_${DATE}.dump

# Keep only last 7 days
find $BACKUP_DIR -name "${DB_NAME}_*.dump" -mtime +7 -delete

# Optional: Upload to S3
# aws s3 cp $BACKUP_DIR/${DB_NAME}_${DATE}.dump s3://your-bucket/backups/
```

**Cron job:**
```bash
# Daily at 2 AM
0 2 * * * /opt/backup/records-db-backup.sh
```

---

## 🔧 Environment Configuration

### Complete `.env` Template

```bash
# ============================================================================
# Records FHIR Platform - Production Configuration
# ============================================================================

# ----------------------------------------------------------------------------
# Database
# ----------------------------------------------------------------------------
DATABASE_URL=postgresql://records_user:your-secure-password@localhost:5432/records

# Connection Pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ----------------------------------------------------------------------------
# Application
# ----------------------------------------------------------------------------
NODE_ENV=production
PORT=3000
FRONTEND_PORT=5174
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://records.example.com
ALLOWED_ORIGINS=https://records.example.com,https://admin.records.example.com

# ----------------------------------------------------------------------------
# FHIR Server
# ----------------------------------------------------------------------------
DEFAULT_FHIR_SERVER_URL=https://fhir.example.com/baseR4
FHIR_SERVER_AUTH=Bearer your-token-here

# ----------------------------------------------------------------------------
# HAPI Validator
# ----------------------------------------------------------------------------
HAPI_VALIDATOR_JAR_PATH=./server/lib/validator_cli.jar
HAPI_VALIDATOR_TIMEOUT=300000
HAPI_VALIDATOR_MAX_RETRIES=3

# ----------------------------------------------------------------------------
# Validation
# ----------------------------------------------------------------------------
VALIDATION_MAX_CONCURRENT=5
VALIDATION_BATCH_SIZE=50
VALIDATION_MAX_WORKERS=5
VALIDATION_WORKER_TIMEOUT=300000

# ----------------------------------------------------------------------------
# Terminology
# ----------------------------------------------------------------------------
TERMINOLOGY_MODE=hybrid  # online | offline | hybrid
TX_FHIR_ORG_URL=https://tx.fhir.org
ONTOSERVER_URL=http://localhost:8081/fhir

# Caching
TERMINOLOGY_CACHE_TTL_ONLINE=3600000   # 1 hour
TERMINOLOGY_CACHE_TTL_OFFLINE=-1       # Indefinite

# ----------------------------------------------------------------------------
# Profile Packages
# ----------------------------------------------------------------------------
PROFILE_CACHE_DIR=./profile-cache
SIMPLIFIER_API_URL=https://packages.simplifier.net

# ----------------------------------------------------------------------------
# Export
# ----------------------------------------------------------------------------
EXPORT_DIR=./exports
EXPORT_RETENTION_DAYS=30
EXPORT_MAX_FILE_SIZE=104857600  # 100 MB

# ----------------------------------------------------------------------------
# Security
# ----------------------------------------------------------------------------
SESSION_SECRET=your-secret-key-here-change-in-production
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# ----------------------------------------------------------------------------
# Monitoring & Logging
# ----------------------------------------------------------------------------
LOG_FILE=./logs/app.log
ERROR_LOG_FILE=./logs/error.log

# Sentry (optional)
SENTRY_DSN=your-sentry-dsn

# ----------------------------------------------------------------------------
# Feature Flags
# ----------------------------------------------------------------------------
ENABLE_WORKER_THREADS=true
ENABLE_ADAPTIVE_POLLING=true
ENABLE_EXPORT_COMPRESSION=true
ENABLE_BUSINESS_RULES=true
ENABLE_REFERENCE_VALIDATION=true
```

---

## 🗄️ Database Setup

### Initial Setup

```bash
# 1. Create database
createdb records

# 2. Run migrations
npm run db:migrate

# 3. Verify schema
psql records -c "\dt"
```

### Migration Management

```bash
# Create new migration
npm run db:migrate

# Rollback last migration
npm run db:migrate:down

# Check migration status
npm run db:migrate:status
```

### Database Backup & Restore

**Backup:**
```bash
pg_dump -U records_user -Fc records > records_backup_$(date +%Y%m%d).dump
```

**Restore:**
```bash
pg_restore -U records_user -d records records_backup_20251009.dump
```

---

## ✅ Health Checks

### Application Health Endpoint

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123456,
  "timestamp": "2025-10-09T20:00:00.000Z",
  "services": {
    "database": "healthy",
    "hapiValidator": "healthy",
    "ontoserver": "healthy"
  }
}
```

### Database Health

```bash
psql -U records_user -d records -c "SELECT version();"
```

### Ontoserver Health

```bash
curl http://localhost:8081/fhir/metadata
```

---

## 📊 Monitoring & Logging

### Application Logs

**Location:**
- Development: Console output
- Production: `./logs/app.log`, `./logs/error.log`

**View logs:**
```bash
# Tail app log
tail -f logs/app.log

# Search for errors
grep "ERROR" logs/app.log

# With PM2
pm2 logs records
```

### Database Monitoring

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'records';

-- Slow queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '1 second'
ORDER BY duration DESC;

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 🔧 Troubleshooting

### Common Issues

**1. Database connection failed**
```bash
Error: ECONNREFUSED 127.0.0.1:5432
```
**Solution:**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify connection string in `.env`
- Check firewall rules

**2. HAPI Validator not found**
```bash
Error: HAPI validator JAR not found
```
**Solution:**
```bash
bash scripts/setup-hapi-validator.sh
```

**3. Out of memory errors**
```bash
Error: JavaScript heap out of memory
```
**Solution:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

**4. Port already in use**
```bash
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution:**
```bash
# Find process
lsof -ti:3000
# Kill process
kill -9 $(lsof -ti:3000)
```

**Full troubleshooting guide:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📞 Support

- 📖 **Documentation**: [docs/](../technical/)
- 🐛 **Issues**: GitHub Issues
- 💬 **Discussions**: GitHub Discussions

---

**Last Updated:** 2025-10-09

