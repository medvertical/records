# Records FHIR Validation Platform - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Records FHIR Validation Platform to production environments. The guide covers multiple deployment options including Vercel, Docker, and traditional server deployments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Vercel Deployment](#vercel-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Traditional Server Deployment](#traditional-server-deployment)
6. [Database Setup](#database-setup)
7. [Configuration Management](#configuration-management)
8. [Monitoring and Logging](#monitoring-and-logging)
9. [Security Considerations](#security-considerations)
10. [Performance Optimization](#performance-optimization)
11. [Backup and Recovery](#backup-and-recovery)
12. [Maintenance and Updates](#maintenance-and-updates)

---

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **PostgreSQL**: 13.x or higher
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: Minimum 10GB free space
- **Network**: HTTPS support for production

### Required Tools

- **Git**: For version control
- **npm/yarn**: Package manager
- **PostgreSQL client**: For database management
- **SSL certificate**: For HTTPS in production

### Optional Tools

- **Docker**: For containerized deployment
- **Nginx**: For reverse proxy and load balancing
- **PM2**: For process management
- **Vercel CLI**: For Vercel deployment

---

## Environment Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd records
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/records

# Server Configuration
NODE_ENV=production
PORT=3000

# FHIR Server Configuration
FHIR_SERVER_URL=https://your-fhir-server.com/fhir
FHIR_SERVER_AUTH_TYPE=none
FHIR_SERVER_USERNAME=
FHIR_SERVER_PASSWORD=
FHIR_SERVER_TOKEN=

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Cache Configuration
CACHE_TTL=300000
CACHE_MAX_SIZE=100

# Performance Configuration
MAX_CONCURRENT_VALIDATIONS=10
VALIDATION_TIMEOUT=30000

# Security Configuration
CORS_ORIGIN=*
SESSION_SECRET=your-session-secret-here

# Monitoring Configuration
ENABLE_METRICS=true
METRICS_PORT=9090
```

### 4. Database Setup

```bash
# Create database
createdb records

# Run migrations
npm run db:push

# Verify database connection
psql $DATABASE_URL -c "SELECT 1;"
```

---

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Configure Project

```bash
vercel
```

Follow the prompts to configure your project.

### 4. Set Environment Variables

```bash
vercel env add DATABASE_URL
vercel env add NODE_ENV
vercel env add FHIR_SERVER_URL
# Add other required environment variables
```

### 5. Deploy

```bash
vercel --prod
```

### 6. Configure Custom Domain (Optional)

```bash
vercel domains add your-domain.com
```

### Vercel Configuration

The project includes a `vercel.json` configuration file:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/public/**",
      "use": "@vercel/static"
    },
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "dist/index.js"
    },
    {
      "src": "/assets/(.*)",
      "dest": "dist/public/assets/$1"
    },
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Vercel-Specific Considerations

1. **Serverless Functions**: The application is optimized for Vercel's serverless environment
2. **SSE Support**: Server-Sent Events work well on Vercel
3. **Database Connections**: Use connection pooling for PostgreSQL
4. **File Storage**: Use external storage for file uploads

---

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["npm", "start"]
```

### 2. Create Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/records
      - FHIR_SERVER_URL=https://your-fhir-server.com/fhir
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:13-alpine
    environment:
      - POSTGRES_DB=records
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. Build and Deploy

```bash
# Build Docker image
docker build -t records-app .

# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f app
```

### 4. Nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSE specific configuration
        location /api/validation/stream {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_set_header Connection '';
            proxy_http_version 1.1;
            proxy_buffering off;
            proxy_cache off;
            proxy_read_timeout 24h;
        }

        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

---

## Traditional Server Deployment

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Nginx
sudo apt install nginx

# Install PM2
sudo npm install -g pm2
```

### 2. Application Deployment

```bash
# Clone repository
git clone <repository-url> /var/www/records
cd /var/www/records

# Install dependencies
npm install

# Build application
npm run build

# Set up PM2
pm2 start dist/index.js --name records-app
pm2 save
pm2 startup
```

### 3. Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/validation/stream {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }
}
```

### 4. SSL Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

---

## Database Setup

### 1. PostgreSQL Installation

```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib

# macOS
brew install postgresql
```

### 2. Database Configuration

```bash
# Create database user
sudo -u postgres createuser --interactive

# Create database
sudo -u postgres createdb records

# Set up database schema
psql -U postgres -d records -f migrations/001_rock_solid_validation_settings.sql
```

### 3. Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fhir_resources_server_id ON fhir_resources(server_id);
CREATE INDEX IF NOT EXISTS idx_fhir_resources_type ON fhir_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_validation_results_resource_id ON validation_results(resource_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_validated_at ON validation_results(validated_at);

-- Configure PostgreSQL for production
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Reload configuration
SELECT pg_reload_conf();
```

### 4. Database Backup

```bash
# Create backup script
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/records_$DATE.sql"

mkdir -p $BACKUP_DIR
pg_dump -U postgres -h localhost records > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "records_*.sql.gz" -mtime +7 -delete
```

---

## Configuration Management

### 1. Environment-Specific Configuration

```javascript
// config/index.js
const config = {
  development: {
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/records_dev',
      pool: { min: 2, max: 10 }
    },
    server: {
      port: process.env.PORT || 3000,
      host: 'localhost'
    },
    logging: {
      level: 'debug',
      format: 'pretty'
    }
  },
  
  production: {
    database: {
      url: process.env.DATABASE_URL,
      pool: { min: 5, max: 20 },
      ssl: { rejectUnauthorized: false }
    },
    server: {
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    },
    logging: {
      level: 'info',
      format: 'json'
    }
  }
};

module.exports = config[process.env.NODE_ENV || 'development'];
```

### 2. Secrets Management

```bash
# Use environment variables for secrets
export DATABASE_URL="postgresql://user:password@localhost:5432/records"
export SESSION_SECRET="your-secret-key"
export FHIR_SERVER_TOKEN="your-fhir-token"

# Or use a secrets management service
# AWS Secrets Manager, HashiCorp Vault, etc.
```

### 3. Configuration Validation

```javascript
// config/validation.js
const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  DATABASE_URL: Joi.string().uri().required(),
  PORT: Joi.number().port().default(3000),
  FHIR_SERVER_URL: Joi.string().uri().required(),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info')
});

const { error, value } = schema.validate(process.env);
if (error) {
  throw new Error(`Configuration validation error: ${error.message}`);
}

module.exports = value;
```

---

## Monitoring and Logging

### 1. Application Monitoring

```javascript
// monitoring/metrics.js
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const validationProgress = new prometheus.Gauge({
  name: 'validation_progress_percentage',
  help: 'Current validation progress percentage'
});

const sseConnections = new prometheus.Gauge({
  name: 'sse_connections_active',
  help: 'Number of active SSE connections'
});

module.exports = {
  httpRequestDuration,
  validationProgress,
  sseConnections
};
```

### 2. Logging Configuration

```javascript
// logging/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'records-app' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### 3. Health Checks

```javascript
// health/health.js
const healthCheck = {
  async checkDatabase() {
    try {
      await db.query('SELECT 1');
      return { status: 'healthy', message: 'Database connection OK' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  },

  async checkFhirServer() {
    try {
      const response = await fetch(`${process.env.FHIR_SERVER_URL}/metadata`);
      if (response.ok) {
        return { status: 'healthy', message: 'FHIR server accessible' };
      } else {
        return { status: 'unhealthy', message: `FHIR server returned ${response.status}` };
      }
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  },

  async checkSSE() {
    const activeConnections = sseClients.size;
    return {
      status: activeConnections > 0 ? 'healthy' : 'warning',
      message: `${activeConnections} active SSE connections`
    };
  }
};

module.exports = healthCheck;
```

---

## Security Considerations

### 1. HTTPS Configuration

```javascript
// security/ssl.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('ssl/private-key.pem'),
  cert: fs.readFileSync('ssl/certificate.pem'),
  ca: fs.readFileSync('ssl/ca-bundle.pem')
};

const server = https.createServer(options, app);
```

### 2. CORS Configuration

```javascript
// security/cors.js
const cors = require('cors');

const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
```

### 3. Rate Limiting

```javascript
// security/rateLimit.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);
```

### 4. Input Validation

```javascript
// security/validation.js
const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }
    next();
  };
};

module.exports = validateRequest;
```

---

## Performance Optimization

### 1. Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM fhir_resources WHERE server_id = 1;

-- Create appropriate indexes
CREATE INDEX CONCURRENTLY idx_fhir_resources_server_type 
ON fhir_resources(server_id, resource_type);

-- Update table statistics
ANALYZE fhir_resources;
```

### 2. Caching Strategy

```javascript
// cache/redis.js
const Redis = require('redis');
const client = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const cache = {
  async get(key) {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },

  async set(key, value, ttl = 300) {
    await client.setex(key, ttl, JSON.stringify(value));
  },

  async del(key) {
    await client.del(key);
  }
};

module.exports = cache;
```

### 3. Connection Pooling

```javascript
// database/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

---

## Backup and Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/records_$DATE.sql"

# Create backup
pg_dump -U postgres -h localhost records > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage (optional)
aws s3 cp "$BACKUP_FILE.gz" s3://your-backup-bucket/

# Clean up old backups
find $BACKUP_DIR -name "records_*.sql.gz" -mtime +7 -delete
```

### 2. Application Backup

```bash
#!/bin/bash
# app-backup.sh

APP_DIR="/var/www/records"
BACKUP_DIR="/var/backups/app"
DATE=$(date +%Y%m%d_%H%M%S)

# Create application backup
tar -czf "$BACKUP_DIR/records-app-$DATE.tar.gz" -C $APP_DIR .

# Clean up old backups
find $BACKUP_DIR -name "records-app-*.tar.gz" -mtime +7 -delete
```

### 3. Recovery Procedures

```bash
# Database recovery
gunzip -c /var/backups/postgresql/records_20250116_120000.sql.gz | psql -U postgres -d records

# Application recovery
tar -xzf /var/backups/app/records-app-20250116_120000.tar.gz -C /var/www/records/
```

---

## Maintenance and Updates

### 1. Update Procedures

```bash
#!/bin/bash
# update.sh

# Backup current version
./backup.sh

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npm run db:push

# Build application
npm run build

# Restart application
pm2 restart records-app

# Verify deployment
curl -f http://localhost:3000/health || exit 1
```

### 2. Monitoring Scripts

```bash
#!/bin/bash
# monitor.sh

# Check application health
if ! curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "Application health check failed"
    # Send alert
    # Restart application
    pm2 restart records-app
fi

# Check database connection
if ! psql $DATABASE_URL -c "SELECT 1;" > /dev/null 2>&1; then
    echo "Database connection failed"
    # Send alert
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is high: $DISK_USAGE%"
    # Send alert
fi
```

### 3. Log Rotation

```bash
# /etc/logrotate.d/records
/var/www/records/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload records-app
    endscript
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database schema up to date
- [ ] SSL certificates installed
- [ ] Backup procedures in place
- [ ] Monitoring configured
- [ ] Security measures implemented

### Deployment

- [ ] Code deployed to production
- [ ] Dependencies installed
- [ ] Application built
- [ ] Database migrations run
- [ ] Application started
- [ ] Health checks passing

### Post-Deployment

- [ ] Application accessible
- [ ] SSE connections working
- [ ] FHIR server connectivity verified
- [ ] Validation engine functional
- [ ] Dashboard loading correctly
- [ ] Error handling working
- [ ] Performance metrics normal
- [ ] Logs being generated

---

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check environment variables
   - Verify database connection
   - Check port availability

2. **SSE connections failing**
   - Verify proxy configuration
   - Check firewall settings
   - Test direct connection

3. **Database connection issues**
   - Verify connection string
   - Check database server status
   - Verify user permissions

4. **Performance issues**
   - Check database indexes
   - Monitor memory usage
   - Review query performance

### Support

For deployment issues not covered in this guide:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review application logs
3. Check system resources
4. Create an issue in the project repository

---

## Quick Reference

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/records
NODE_ENV=production
PORT=3000

# Optional
LOG_LEVEL=info
CACHE_TTL=300000
MAX_CONCURRENT_VALIDATIONS=10
```

### Common Commands

```bash
# Build application
npm run build

# Start application
npm start

# Run database migrations
npm run db:push

# Check application health
curl http://localhost:3000/health

# View logs
pm2 logs records-app

# Restart application
pm2 restart records-app
```

### Ports

- **3000**: Application port
- **5432**: PostgreSQL port
- **80/443**: HTTP/HTTPS ports
- **9090**: Metrics port (optional)

