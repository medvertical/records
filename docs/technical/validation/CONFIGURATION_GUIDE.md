# FHIR Validation Configuration Guide

## Overview

This guide provides comprehensive documentation for configuring the FHIR validation system, including environment variables, service settings, performance tuning, and deployment configurations.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Service Configuration](#service-configuration)
3. [Performance Configuration](#performance-configuration)
4. [External Service Configuration](#external-service-configuration)
5. [Database Configuration](#database-configuration)
6. [Caching Configuration](#caching-configuration)
7. [Security Configuration](#security-configuration)
8. [Monitoring Configuration](#monitoring-configuration)
9. [Deployment Configurations](#deployment-configurations)

## Environment Variables

### Required Environment Variables

These environment variables are essential for the validation system to function properly:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/records

# External Services
ONTOSERVER_R4_URL=https://r4.ontoserver.csiro.au/fhir
ONTOSERVER_R5_URL=https://r5.ontoserver.csiro.au/fhir
FIRELY_SERVER_URL=https://server.fire.ly/R4

# Basic Validation Settings
VALIDATION_TIMEOUT=5000
VALIDATION_RETRY_ATTEMPTS=3
VALIDATION_RETRY_DELAY=1000
```

### Optional Environment Variables

These variables provide additional configuration options:

```bash
# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Performance Tuning
VALIDATION_BATCH_SIZE=10
VALIDATION_MAX_CONCURRENT=5
VALIDATION_CACHE_SIZE=1000

# External Service Timeouts
ONTOSERVER_TIMEOUT=5000
FIRELY_TIMEOUT=5000
EXTERNAL_SERVICE_TIMEOUT=5000

# Caching Configuration
CACHE_MAX_SIZE=5000
CACHE_MAX_MEMORY_MB=200
CACHE_DEFAULT_TTL=600000
CACHE_CLEANUP_INTERVAL=300000

# Database Pool Configuration
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Security
JWT_SECRET=your-jwt-secret-key
API_RATE_LIMIT=100
API_RATE_WINDOW=900000

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
```

### Environment-Specific Configurations

#### Development Environment

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
VALIDATION_TIMEOUT=10000
VALIDATION_RETRY_ATTEMPTS=1
CACHE_DEFAULT_TTL=60000
DB_POOL_MAX=10
ENABLE_METRICS=false
```

#### Staging Environment

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
VALIDATION_TIMEOUT=7000
VALIDATION_RETRY_ATTEMPTS=2
CACHE_DEFAULT_TTL=300000
DB_POOL_MAX=15
ENABLE_METRICS=true
```

#### Production Environment

```bash
# .env.production
NODE_ENV=production
LOG_LEVEL=warn
VALIDATION_TIMEOUT=5000
VALIDATION_RETRY_ATTEMPTS=3
CACHE_DEFAULT_TTL=600000
DB_POOL_MAX=20
ENABLE_METRICS=true
```

## Service Configuration

### Validation Service Configuration

The validation service can be configured through environment variables and configuration files:

```typescript
// config/validation.config.ts
export const validationConfig = {
  // Basic settings
  enabled: process.env.VALIDATION_ENABLED !== 'false',
  timeout: parseInt(process.env.VALIDATION_TIMEOUT) || 5000,
  retryAttempts: parseInt(process.env.VALIDATION_RETRY_ATTEMPTS) || 3,
  retryDelay: parseInt(process.env.VALIDATION_RETRY_DELAY) || 1000,
  
  // Batch processing
  batchSize: parseInt(process.env.VALIDATION_BATCH_SIZE) || 10,
  maxConcurrent: parseInt(process.env.VALIDATION_MAX_CONCURRENT) || 5,
  
  // Validation aspects
  aspects: {
    structural: process.env.VALIDATE_STRUCTURAL !== 'false',
    profile: process.env.VALIDATE_PROFILE !== 'false',
    terminology: process.env.VALIDATE_TERMINOLOGY !== 'false',
    reference: process.env.VALIDATE_REFERENCE !== 'false',
    businessRule: process.env.VALIDATE_BUSINESS_RULE !== 'false',
    metadata: process.env.VALIDATE_METADATA !== 'false'
  },
  
  // Scoring configuration
  scoring: {
    errorPenalty: parseInt(process.env.SCORE_ERROR_PENALTY) || 10,
    warningPenalty: parseInt(process.env.SCORE_WARNING_PENALTY) || 5,
    infoPenalty: parseInt(process.env.SCORE_INFO_PENALTY) || 1,
    maxScore: parseInt(process.env.SCORE_MAX) || 100,
    minScore: parseInt(process.env.SCORE_MIN) || 0
  }
};
```

### Validation Settings API

The validation system provides an API for runtime configuration:

```typescript
// API endpoints for configuration management
app.get('/api/validation/settings', async (req, res) => {
  const settings = await validationSettingsService.getSettings();
  res.json(settings);
});

app.put('/api/validation/settings', async (req, res) => {
  const updatedSettings = await validationSettingsService.updateSettings(req.body);
  res.json(updatedSettings);
});

app.post('/api/validation/settings/reset', async (req, res) => {
  const defaultSettings = await validationSettingsService.resetToDefaults();
  res.json(defaultSettings);
});
```

## Performance Configuration

### Timing Configuration

Configure validation timeouts and performance limits:

```typescript
// config/performance.config.ts
export const performanceConfig = {
  // Timeout settings
  timeouts: {
    validation: parseInt(process.env.VALIDATION_TIMEOUT) || 5000,
    external: parseInt(process.env.EXTERNAL_SERVICE_TIMEOUT) || 5000,
    database: parseInt(process.env.DB_TIMEOUT) || 3000,
    cache: parseInt(process.env.CACHE_TIMEOUT) || 1000
  },
  
  // Rate limiting
  rateLimits: {
    validation: parseInt(process.env.VALIDATION_RATE_LIMIT) || 100,
    external: parseInt(process.env.EXTERNAL_RATE_LIMIT) || 50,
    api: parseInt(process.env.API_RATE_LIMIT) || 1000
  },
  
  // Batch processing
  batchProcessing: {
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 100,
    maxConcurrentBatches: parseInt(process.env.MAX_CONCURRENT_BATCHES) || 5,
    batchTimeout: parseInt(process.env.BATCH_TIMEOUT) || 30000
  },
  
  // Memory management
  memory: {
    maxHeapSize: process.env.MAX_HEAP_SIZE || '2G',
    gcThreshold: parseInt(process.env.GC_THRESHOLD) || 100,
    memoryWarningThreshold: parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 80
  }
};
```

### Concurrency Configuration

Configure concurrent processing limits:

```typescript
// config/concurrency.config.ts
export const concurrencyConfig = {
  // Validation concurrency
  validation: {
    maxConcurrent: parseInt(process.env.VALIDATION_MAX_CONCURRENT) || 5,
    maxQueueSize: parseInt(process.env.VALIDATION_MAX_QUEUE_SIZE) || 100,
    queueTimeout: parseInt(process.env.VALIDATION_QUEUE_TIMEOUT) || 30000
  },
  
  // External service concurrency
  external: {
    ontoserver: {
      maxConcurrent: parseInt(process.env.ONTOSERVER_MAX_CONCURRENT) || 10,
      rateLimit: parseInt(process.env.ONTOSERVER_RATE_LIMIT) || 100
    },
    firely: {
      maxConcurrent: parseInt(process.env.FIRELY_MAX_CONCURRENT) || 5,
      rateLimit: parseInt(process.env.FIRELY_RATE_LIMIT) || 50
    }
  },
  
  // Database concurrency
  database: {
    maxConnections: parseInt(process.env.DB_POOL_MAX) || 20,
    minConnections: parseInt(process.env.DB_POOL_MIN) || 5,
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
  }
};
```

## External Service Configuration

### Ontoserver Configuration

Configure Ontoserver connections and behavior:

```typescript
// config/ontoserver.config.ts
export const ontoserverConfig = {
  // R4 Ontoserver
  r4: {
    url: process.env.ONTOSERVER_R4_URL || 'https://r4.ontoserver.csiro.au/fhir',
    timeout: parseInt(process.env.ONTOSERVER_TIMEOUT) || 5000,
    retryAttempts: parseInt(process.env.ONTOSERVER_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.ONTOSERVER_RETRY_DELAY) || 1000,
    rateLimit: parseInt(process.env.ONTOSERVER_R4_RATE_LIMIT) || 100,
    maxConcurrent: parseInt(process.env.ONTOSERVER_R4_MAX_CONCURRENT) || 10
  },
  
  // R5 Ontoserver
  r5: {
    url: process.env.ONTOSERVER_R5_URL || 'https://r5.ontoserver.csiro.au/fhir',
    timeout: parseInt(process.env.ONTOSERVER_TIMEOUT) || 5000,
    retryAttempts: parseInt(process.env.ONTOSERVER_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.ONTOSERVER_RETRY_DELAY) || 1000,
    rateLimit: parseInt(process.env.ONTOSERVER_R5_RATE_LIMIT) || 100,
    maxConcurrent: parseInt(process.env.ONTOSERVER_R5_MAX_CONCURRENT) || 10
  },
  
  // Fallback configuration
  fallback: {
    enabled: process.env.ONTOSERVER_FALLBACK_ENABLED !== 'false',
    timeout: parseInt(process.env.ONTOSERVER_FALLBACK_TIMEOUT) || 3000,
    retryAttempts: parseInt(process.env.ONTOSERVER_FALLBACK_RETRY_ATTEMPTS) || 1
  }
};
```

### Firely Server Configuration

Configure Firely Server connections:

```typescript
// config/firely.config.ts
export const firelyConfig = {
  // Server configuration
  server: {
    url: process.env.FIRELY_SERVER_URL || 'https://server.fire.ly/R4',
    timeout: parseInt(process.env.FIRELY_TIMEOUT) || 5000,
    retryAttempts: parseInt(process.env.FIRELY_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.FIRELY_RETRY_DELAY) || 1000,
    rateLimit: parseInt(process.env.FIRELY_RATE_LIMIT) || 50,
    maxConcurrent: parseInt(process.env.FIRELY_MAX_CONCURRENT) || 5
  },
  
  // Reference validation configuration
  referenceValidation: {
    enabled: process.env.FIRELY_REFERENCE_VALIDATION !== 'false',
    batchSize: parseInt(process.env.FIRELY_BATCH_SIZE) || 10,
    timeout: parseInt(process.env.FIRELY_REFERENCE_TIMEOUT) || 3000
  },
  
  // Fallback configuration
  fallback: {
    enabled: process.env.FIRELY_FALLBACK_ENABLED !== 'false',
    localValidation: process.env.FIRELY_LOCAL_VALIDATION !== 'false',
    timeout: parseInt(process.env.FIRELY_FALLBACK_TIMEOUT) || 2000
  }
};
```

## Database Configuration

### Connection Configuration

Configure database connections and pooling:

```typescript
// config/database.config.ts
export const databaseConfig = {
  // Connection settings
  connection: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'records',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  
  // Pool configuration
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 20,
    min: parseInt(process.env.DB_POOL_MIN) || 5,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
    acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
    createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT) || 30000,
    destroyTimeoutMillis: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,
    reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL) || 1000,
    createRetryIntervalMillis: parseInt(process.env.DB_CREATE_RETRY_INTERVAL) || 200
  },
  
  // Query configuration
  query: {
    timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
    statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 60000,
    idleInTransactionSessionTimeout: parseInt(process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT) || 60000
  }
};
```

### Migration Configuration

Configure database migrations and schema management:

```typescript
// config/migration.config.ts
export const migrationConfig = {
  // Migration settings
  migrations: {
    directory: process.env.MIGRATION_DIRECTORY || './migrations',
    tableName: process.env.MIGRATION_TABLE || 'migrations',
    schemaName: process.env.MIGRATION_SCHEMA || 'public'
  },
  
  // Schema configuration
  schema: {
    validationResults: {
      tableName: 'validation_results',
      indexes: [
        'idx_validation_results_resource_type',
        'idx_validation_results_validated_at',
        'idx_validation_results_score',
        'idx_validation_results_resource_id'
      ]
    },
    fhirResources: {
      tableName: 'fhir_resources',
      indexes: [
        'idx_fhir_resources_resource_type',
        'idx_fhir_resources_server_id',
        'idx_fhir_resources_created_at'
      ]
    }
  }
};
```

## Caching Configuration

### Terminology Cache Configuration

Configure caching for terminology lookups:

```typescript
// config/cache.config.ts
export const cacheConfig = {
  // Global cache settings
  global: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.CACHE_MAX_SIZE) || 5000,
    maxMemoryMB: parseInt(process.env.CACHE_MAX_MEMORY_MB) || 200,
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 600000,
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 300000
  },
  
  // Code system cache
  codeSystem: {
    enabled: process.env.CODE_SYSTEM_CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.CODE_SYSTEM_CACHE_SIZE) || 1000,
    ttl: parseInt(process.env.CODE_SYSTEM_CACHE_TTL) || 1800000, // 30 minutes
    cleanupInterval: parseInt(process.env.CODE_SYSTEM_CACHE_CLEANUP) || 600000
  },
  
  // Value set cache
  valueSet: {
    enabled: process.env.VALUE_SET_CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.VALUE_SET_CACHE_SIZE) || 2000,
    ttl: parseInt(process.env.VALUE_SET_CACHE_TTL) || 900000, // 15 minutes
    cleanupInterval: parseInt(process.env.VALUE_SET_CACHE_CLEANUP) || 600000
  },
  
  // Concept map cache
  conceptMap: {
    enabled: process.env.CONCEPT_MAP_CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.CONCEPT_MAP_CACHE_SIZE) || 500,
    ttl: parseInt(process.env.CONCEPT_MAP_CACHE_TTL) || 3600000, // 60 minutes
    cleanupInterval: parseInt(process.env.CONCEPT_MAP_CACHE_CLEANUP) || 900000
  },
  
  // Validation result cache
  validationResults: {
    enabled: process.env.VALIDATION_RESULT_CACHE_ENABLED !== 'false',
    maxSize: parseInt(process.env.VALIDATION_RESULT_CACHE_SIZE) || 10000,
    ttl: parseInt(process.env.VALIDATION_RESULT_CACHE_TTL) || 3600000, // 60 minutes
    cleanupInterval: parseInt(process.env.VALIDATION_RESULT_CACHE_CLEANUP) || 1800000
  }
};
```

## Security Configuration

### Authentication and Authorization

Configure security settings:

```typescript
// config/security.config.ts
export const securityConfig = {
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
    issuer: process.env.JWT_ISSUER || 'records-platform',
    audience: process.env.JWT_AUDIENCE || 'validation-service'
  },
  
  // API security
  api: {
    rateLimit: {
      windowMs: parseInt(process.env.API_RATE_WINDOW) || 900000, // 15 minutes
      max: parseInt(process.env.API_RATE_LIMIT) || 100,
      message: 'Too many requests from this IP'
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: process.env.CORS_CREDENTIALS === 'true'
    }
  },
  
  // External service security
  external: {
    httpsOnly: process.env.HTTPS_ONLY !== 'false',
    certificateValidation: process.env.CERT_VALIDATION !== 'false',
    timeout: parseInt(process.env.EXTERNAL_TIMEOUT) || 5000
  }
};
```

### Data Protection

Configure data protection and privacy settings:

```typescript
// config/privacy.config.ts
export const privacyConfig = {
  // Data encryption
  encryption: {
    enabled: process.env.ENCRYPTION_ENABLED !== 'false',
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
    key: process.env.ENCRYPTION_KEY,
    ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH) || 16
  },
  
  // Data retention
  retention: {
    validationResults: parseInt(process.env.RETENTION_VALIDATION_RESULTS) || 2592000000, // 30 days
    logs: parseInt(process.env.RETENTION_LOGS) || 604800000, // 7 days
    metrics: parseInt(process.env.RETENTION_METRICS) || 2592000000 // 30 days
  },
  
  // Audit logging
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    logLevel: process.env.AUDIT_LOG_LEVEL || 'info',
    includeRequestBody: process.env.AUDIT_INCLUDE_REQUEST_BODY !== 'false',
    includeResponseBody: process.env.AUDIT_INCLUDE_RESPONSE_BODY !== 'false'
  }
};
```

## Monitoring Configuration

### Metrics Configuration

Configure monitoring and metrics collection:

```typescript
// config/monitoring.config.ts
export const monitoringConfig = {
  // Metrics collection
  metrics: {
    enabled: process.env.ENABLE_METRICS !== 'false',
    port: parseInt(process.env.METRICS_PORT) || 9090,
    path: process.env.METRICS_PATH || '/metrics',
    collectDefaultMetrics: process.env.COLLECT_DEFAULT_METRICS !== 'false',
    collectInterval: parseInt(process.env.COLLECT_INTERVAL) || 15000
  },
  
  // Health checks
  health: {
    enabled: process.env.ENABLE_HEALTH_CHECKS !== 'false',
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
    endpoints: {
      database: '/health/database',
      ontoserver: '/health/ontoserver',
      firely: '/health/firely',
      cache: '/health/cache'
    }
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    output: process.env.LOG_OUTPUT || 'console',
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      path: process.env.LOG_FILE_PATH || './logs/app.log',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES) || 5
    }
  }
};
```

### Alerting Configuration

Configure alerting and notifications:

```typescript
// config/alerting.config.ts
export const alertingConfig = {
  // Alert thresholds
  thresholds: {
    errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.05, // 5%
    responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 5000, // 5 seconds
    memoryUsage: parseInt(process.env.ALERT_MEMORY_USAGE_THRESHOLD) || 80, // 80%
    cpuUsage: parseInt(process.env.ALERT_CPU_USAGE_THRESHOLD) || 80, // 80%
    diskUsage: parseInt(process.env.ALERT_DISK_USAGE_THRESHOLD) || 85 // 85%
  },
  
  // Notification channels
  notifications: {
    email: {
      enabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      },
      recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || []
    },
    
    slack: {
      enabled: process.env.SLACK_ALERTS_ENABLED === 'true',
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts'
    }
  }
};
```

## Deployment Configurations

### Docker Configuration

#### Dockerfile

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/records
      - ONTOSERVER_R4_URL=https://r4.ontoserver.csiro.au/fhir
      - FIRELY_SERVER_URL=https://server.fire.ly/R4
    depends_on:
      - db
      - redis
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "dist/health-check.js"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=records
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Configuration

#### Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: validation-service
  labels:
    app: validation-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: validation-service
  template:
    metadata:
      labels:
        app: validation-service
    spec:
      containers:
      - name: validation-service
        image: validation-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        - name: ONTOSERVER_R4_URL
          value: "https://r4.ontoserver.csiro.au/fhir"
        - name: FIRELY_SERVER_URL
          value: "https://server.fire.ly/R4"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Service

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: validation-service
spec:
  selector:
    app: validation-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

#### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: validation-config
data:
  VALIDATION_TIMEOUT: "5000"
  VALIDATION_RETRY_ATTEMPTS: "3"
  CACHE_MAX_SIZE: "5000"
  LOG_LEVEL: "info"
```

### Environment-Specific Configurations

#### Development Setup

```bash
# scripts/setup-dev.sh
#!/bin/bash

# Set development environment variables
export NODE_ENV=development
export LOG_LEVEL=debug
export VALIDATION_TIMEOUT=10000
export CACHE_DEFAULT_TTL=60000

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Run migrations
npm run migrate:dev

# Start development server
npm run dev
```

#### Production Setup

```bash
# scripts/setup-prod.sh
#!/bin/bash

# Set production environment variables
export NODE_ENV=production
export LOG_LEVEL=warn
export VALIDATION_TIMEOUT=5000
export CACHE_DEFAULT_TTL=600000

# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
npm run migrate:prod

# Start production server
npm start
```

## Configuration Validation

### Startup Validation

Validate configuration on application startup:

```typescript
// config/validation.ts
export const validateConfiguration = () => {
  const errors: string[] = [];
  
  // Required environment variables
  const required = [
    'DATABASE_URL',
    'ONTOSERVER_R4_URL',
    'FIRELY_SERVER_URL'
  ];
  
  required.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  });
  
  // Validate URLs
  const urlPattern = /^https?:\/\/.+/;
  if (process.env.ONTOSERVER_R4_URL && !urlPattern.test(process.env.ONTOSERVER_R4_URL)) {
    errors.push('Invalid ONTOSERVER_R4_URL format');
  }
  
  if (process.env.FIRELY_SERVER_URL && !urlPattern.test(process.env.FIRELY_SERVER_URL)) {
    errors.push('Invalid FIRELY_SERVER_URL format');
  }
  
  // Validate numeric values
  const numericVars = [
    'VALIDATION_TIMEOUT',
    'VALIDATION_RETRY_ATTEMPTS',
    'CACHE_MAX_SIZE'
  ];
  
  numericVars.forEach(key => {
    const value = process.env[key];
    if (value && (isNaN(Number(value)) || Number(value) < 0)) {
      errors.push(`Invalid numeric value for ${key}: ${value}`);
    }
  });
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('Configuration validation passed');
};

// Run validation on startup
validateConfiguration();
```

## Conclusion

This configuration guide provides comprehensive documentation for all aspects of the FHIR validation system configuration. By following these guidelines and using the provided configurations, teams can properly set up and deploy the validation system in various environments.

Key configuration areas covered:

- **Environment Variables**: Complete list of required and optional variables
- **Service Configuration**: Validation service and API settings
- **Performance Configuration**: Timing, concurrency, and optimization settings
- **External Service Configuration**: Ontoserver and Firely Server settings
- **Database Configuration**: Connection pooling and migration settings
- **Caching Configuration**: Terminology and validation result caching
- **Security Configuration**: Authentication, authorization, and data protection
- **Monitoring Configuration**: Metrics, health checks, and alerting
- **Deployment Configurations**: Docker, Kubernetes, and environment-specific setups

Regular review and updates of this configuration guide will ensure it remains current and helpful as the system evolves and new configuration options are added.
