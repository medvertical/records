# Records FHIR Validation Platform - Troubleshooting Guide

## Overview

This guide provides solutions to common issues encountered when using the Records FHIR Validation Platform. The guide is organized by category and includes step-by-step solutions, diagnostic commands, and prevention strategies.

## Table of Contents

1. [SSE Connection Issues](#sse-connection-issues)
2. [Validation Engine Problems](#validation-engine-problems)
3. [FHIR Server Connection Issues](#fhir-server-connection-issues)
4. [Database Issues](#database-issues)
5. [Performance Issues](#performance-issues)
6. [Build and Deployment Issues](#build-and-deployment-issues)
7. [Type Safety and Runtime Errors](#type-safety-and-runtime-errors)
8. [Logging and Debugging](#logging-and-debugging)
9. [Browser Compatibility](#browser-compatibility)
10. [Network and Proxy Issues](#network-and-proxy-issues)

---

## SSE Connection Issues

### Problem: SSE Connection Fails to Establish

**Symptoms:**
- EventSource fails to connect
- No initial "connected" message received
- Browser shows network errors
- Console shows "Failed to load resource" errors

**Diagnostic Steps:**
```bash
# Test SSE endpoint directly
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/validation/stream

# Check if server is running
curl -I http://localhost:3000/api/validation/health
```

**Solutions:**

1. **Check Server Status:**
   ```javascript
   // Verify server is running
   fetch('/api/validation/health')
     .then(response => {
       if (response.ok) {
         console.log('Server is running');
       } else {
         console.error('Server returned:', response.status);
       }
     });
   ```

2. **Verify EventSource Support:**
   ```javascript
   if (typeof EventSource === 'undefined') {
     console.error('EventSource not supported in this browser');
     // Implement polling fallback
   }
   ```

3. **Check CORS Configuration:**
   ```javascript
   // Test CORS headers
   fetch('/api/validation/stream', {
     method: 'HEAD',
     mode: 'cors'
   }).then(response => {
     console.log('CORS headers:', response.headers);
   });
   ```

### Problem: SSE Messages Not Received

**Symptoms:**
- Connection established but no messages received
- Progress updates not appearing in UI
- Heartbeat messages missing

**Diagnostic Steps:**
```javascript
const eventSource = new EventSource('/api/validation/stream');

// Add comprehensive logging
eventSource.onopen = () => {
  console.log('SSE connection opened');
};

eventSource.onmessage = (event) => {
  console.log('SSE message received:', event.data);
  try {
    const message = JSON.parse(event.data);
    console.log('Parsed message:', message);
  } catch (error) {
    console.error('Failed to parse SSE message:', error);
  }
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  console.log('Ready state:', eventSource.readyState);
};
```

**Solutions:**

1. **Check Message Format:**
   ```javascript
   // Validate message structure
   function validateSSEMessage(data) {
     try {
       const message = JSON.parse(data);
       if (!message.type || !message.timestamp) {
         console.error('Invalid message format:', message);
         return false;
       }
       return true;
     } catch (error) {
       console.error('Message parsing error:', error);
       return false;
     }
   }
   ```

2. **Implement Message Buffering:**
   ```javascript
   class SSEMessageBuffer {
     constructor() {
       this.buffer = [];
       this.maxSize = 100;
     }
     
     add(message) {
       this.buffer.push(message);
       if (this.buffer.length > this.maxSize) {
         this.buffer.shift();
       }
     }
     
     getRecent(count = 10) {
       return this.buffer.slice(-count);
     }
   }
   ```

### Problem: Frequent SSE Reconnections

**Symptoms:**
- Connection keeps dropping and reconnecting
- High network traffic from reconnection attempts
- "SSE client error: Error: aborted" in server logs

**Solutions:**

1. **Implement Custom Reconnection Logic:**
   ```javascript
   class RobustSSEConnection {
     constructor(url, options = {}) {
       this.url = url;
       this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
       this.reconnectDelay = options.reconnectDelay || 1000;
       this.reconnectAttempts = 0;
       this.isManualClose = false;
     }
     
     connect() {
       this.eventSource = new EventSource(this.url);
       
       this.eventSource.onopen = () => {
         console.log('SSE connected');
         this.reconnectAttempts = 0;
       };
       
       this.eventSource.onerror = () => {
         if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
           setTimeout(() => {
             this.reconnectAttempts++;
             console.log(`Reconnecting... attempt ${this.reconnectAttempts}`);
             this.connect();
           }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
         } else {
           console.error('Max reconnection attempts reached');
           this.fallbackToPolling();
         }
       };
     }
     
     close() {
       this.isManualClose = true;
       this.eventSource.close();
     }
     
     fallbackToPolling() {
       console.log('Falling back to API polling');
       setInterval(() => {
         fetch('/api/validation/status')
           .then(response => response.json())
           .then(data => {
             // Handle progress update
             console.log('Polling update:', data);
           });
       }, 2000);
     }
   }
   ```

---

## Validation Engine Problems

### Problem: Validation Engine Says Started But Not Running

**Symptoms:**
- UI shows validation as "started" but no progress updates
- Validation status endpoint returns "idle" or "not_running"
- No SSE messages for validation progress

**Diagnostic Steps:**
```bash
# Check validation status
curl http://localhost:3000/api/validation/status

# Check server logs for validation errors
# Look for validation-related error messages
```

**Solutions:**

1. **Check Validation Service State:**
   ```javascript
   // Verify validation service is properly initialized
   fetch('/api/validation/status')
     .then(response => response.json())
     .then(data => {
       console.log('Validation status:', data);
       if (data.status === 'idle' && data.isRunning === false) {
         console.error('Validation service not running despite start command');
         // Restart validation
         fetch('/api/validation/start', { method: 'POST' });
       }
     });
   ```

2. **Check FHIR Server Connection:**
   ```javascript
   // Verify FHIR server is accessible
   fetch('/api/fhir/connection/test')
     .then(response => response.json())
     .then(data => {
       if (!data.connected) {
         console.error('FHIR server not connected:', data.error);
         // Fix FHIR server connection first
       }
     });
   ```

### Problem: Wrong Numbers in Dashboard

**Symptoms:**
- Dashboard shows incorrect resource counts
- Validation statistics don't match actual data
- Progress percentages are wrong

**Diagnostic Steps:**
```bash
# Check FHIR server resource counts
curl http://localhost:3000/api/fhir/resource-counts

# Check validation statistics
curl http://localhost:3000/api/dashboard/validation-stats

# Check combined dashboard data
curl http://localhost:3000/api/dashboard/combined
```

**Solutions:**

1. **Force Refresh FHIR Server Data:**
   ```javascript
   // Clear cache and refresh data
   fetch('/api/dashboard/force-refresh', { method: 'POST' })
     .then(response => response.json())
     .then(data => {
       console.log('Data refreshed:', data);
       // Reload dashboard
       window.location.reload();
     });
   ```

2. **Check Data Consistency:**
   ```javascript
   // Compare different data sources
   Promise.all([
     fetch('/api/fhir/resource-counts').then(r => r.json()),
     fetch('/api/dashboard/validation-stats').then(r => r.json()),
     fetch('/api/dashboard/combined').then(r => r.json())
   ]).then(([resourceCounts, validationStats, combinedData]) => {
     console.log('Resource counts:', resourceCounts);
     console.log('Validation stats:', validationStats);
     console.log('Combined data:', combinedData);
     
     // Check for inconsistencies
     if (resourceCounts.total !== validationStats.totalValidated) {
       console.warn('Data inconsistency detected');
     }
   });
   ```

---

## FHIR Server Connection Issues

### Problem: FHIR Server Connection Failed

**Symptoms:**
- "Failed to connect to FHIR server" error
- Dashboard shows "Server not connected"
- Validation cannot start due to server issues

**Diagnostic Steps:**
```bash
# Test FHIR server connection
curl http://localhost:3000/api/fhir/connection/test

# Test specific FHIR server
curl -X POST http://localhost:3000/api/fhir/servers/1/test

# Check FHIR server metadata
curl http://localhost:3000/api/fhir/metadata
```

**Solutions:**

1. **Check FHIR Server URL:**
   ```javascript
   // Verify FHIR server URL is correct
   fetch('/api/fhir/servers')
     .then(response => response.json())
     .then(servers => {
       const activeServer = servers.find(s => s.isActive);
       if (activeServer) {
         console.log('Active server:', activeServer);
         // Test the URL directly
         fetch(activeServer.url + '/metadata')
           .then(response => {
             if (response.ok) {
               console.log('FHIR server is accessible');
             } else {
               console.error('FHIR server returned:', response.status);
             }
           });
       }
     });
   ```

2. **Check Authentication:**
   ```javascript
   // Test authentication configuration
   fetch('/api/fhir/auth/test', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       url: 'https://your-fhir-server.com/fhir',
       authConfig: {
         type: 'basic',
         username: 'your-username',
         password: 'your-password'
       }
     })
   }).then(response => response.json())
     .then(data => {
       if (data.connected) {
         console.log('Authentication successful');
       } else {
         console.error('Authentication failed:', data.error);
       }
     });
   ```

### Problem: FHIR Server Timeout

**Symptoms:**
- Requests to FHIR server timeout
- "Request timeout" errors in logs
- Slow response times

**Solutions:**

1. **Increase Timeout Settings:**
   ```javascript
   // Configure longer timeouts for FHIR requests
   const fhirClient = new FhirClient({
     baseUrl: 'https://your-fhir-server.com/fhir',
     timeout: 30000, // 30 seconds
     retryAttempts: 3,
     retryDelay: 1000
   });
   ```

2. **Implement Retry Logic:**
   ```javascript
   async function retryFhirRequest(requestFn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await requestFn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         console.log(`Retry ${i + 1} after error:`, error.message);
         await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
       }
     }
   }
   ```

---

## Database Issues

### Problem: Database Connection Failed

**Symptoms:**
- "Database connection failed" errors
- API endpoints return 500 errors
- Application fails to start

**Diagnostic Steps:**
```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check database URL format
echo $DATABASE_URL
```

**Solutions:**

1. **Verify Database URL:**
   ```bash
   # Check environment variables
   cat .env | grep DATABASE_URL
   
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **Check Database Permissions:**
   ```sql
   -- Check if user has necessary permissions
   SELECT has_database_privilege('your_user', 'your_database', 'CONNECT');
   SELECT has_table_privilege('your_user', 'fhir_servers', 'SELECT');
   ```

### Problem: Database Query Performance Issues

**Symptoms:**
- Slow API responses
- High database CPU usage
- Timeout errors

**Solutions:**

1. **Check Query Performance:**
   ```sql
   -- Enable query logging
   SET log_statement = 'all';
   SET log_duration = on;
   
   -- Check slow queries
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC 
   LIMIT 10;
   ```

2. **Optimize Database Indexes:**
   ```sql
   -- Check missing indexes
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE schemaname = 'public'
   ORDER BY n_distinct DESC;
   
   -- Create indexes for frequently queried columns
   CREATE INDEX IF NOT EXISTS idx_fhir_resources_server_id ON fhir_resources(server_id);
   CREATE INDEX IF NOT EXISTS idx_validation_results_resource_id ON validation_results(resource_id);
   ```

---

## Performance Issues

### Problem: Slow Dashboard Loading

**Symptoms:**
- Dashboard takes long time to load
- High memory usage
- Browser becomes unresponsive

**Solutions:**

1. **Implement Data Pagination:**
   ```javascript
   // Load dashboard data in chunks
   async function loadDashboardData() {
     const [serverStats, validationStats, resourceCounts] = await Promise.all([
       fetch('/api/dashboard/fhir-server-stats').then(r => r.json()),
       fetch('/api/dashboard/validation-stats').then(r => r.json()),
       fetch('/api/fhir/resource-counts').then(r => r.json())
     ]);
     
     return { serverStats, validationStats, resourceCounts };
   }
   ```

2. **Use React Query for Caching:**
   ```javascript
   import { useQuery } from '@tanstack/react-query';
   
   function useDashboardData() {
     return useQuery({
       queryKey: ['dashboard'],
       queryFn: loadDashboardData,
       staleTime: 5 * 60 * 1000, // 5 minutes
       cacheTime: 10 * 60 * 1000, // 10 minutes
     });
   }
   ```

### Problem: High Memory Usage

**Symptoms:**
- Application consumes excessive memory
- Browser crashes or becomes slow
- Server memory usage increases over time

**Solutions:**

1. **Implement Memory Management:**
   ```javascript
   // Clean up old data and connections
   class MemoryManager {
     constructor() {
       this.cleanupInterval = setInterval(() => {
         this.cleanup();
       }, 60000); // Every minute
     }
     
     cleanup() {
       // Clear old cache entries
       this.clearOldCache();
       
       // Close unused connections
       this.closeUnusedConnections();
       
       // Force garbage collection if available
       if (window.gc) {
         window.gc();
       }
     }
     
     clearOldCache() {
       // Remove cache entries older than 1 hour
       const oneHourAgo = Date.now() - 60 * 60 * 1000;
       // Implementation depends on your caching strategy
     }
   }
   ```

---

## Build and Deployment Issues

### Problem: Build Fails with TypeScript Errors

**Symptoms:**
- `npm run build` fails
- TypeScript compilation errors
- Missing type definitions

**Solutions:**

1. **Check TypeScript Configuration:**
   ```bash
   # Verify TypeScript configuration
   npx tsc --noEmit
   
   # Check for missing types
   npm install --save-dev @types/node @types/express
   ```

2. **Fix Type Errors:**
   ```typescript
   // Add proper type annotations
   interface ApiResponse<T> {
     success: boolean;
     data?: T;
     error?: string;
   }
   
   // Use type guards
   function isApiResponse(obj: any): obj is ApiResponse<any> {
     return obj && typeof obj.success === 'boolean';
   }
   ```

### Problem: Vercel Deployment Issues

**Symptoms:**
- Deployment fails on Vercel
- Build errors in Vercel logs
- Application doesn't work in production

**Solutions:**

1. **Check Vercel Configuration:**
   ```json
   // vercel.json
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
         "src": "/(.*)",
         "dest": "dist/index.js"
       }
     ]
   }
   ```

2. **Check Environment Variables:**
   ```bash
   # Verify all required environment variables are set in Vercel
   vercel env ls
   
   # Set missing variables
   vercel env add DATABASE_URL
   vercel env add NODE_ENV
   ```

---

## Type Safety and Runtime Errors

### Problem: Runtime Type Errors

**Symptoms:**
- "Cannot read properties of undefined" errors
- Type coercion issues
- Runtime validation failures

**Solutions:**

1. **Add Runtime Type Validation:**
   ```typescript
   import { z } from 'zod';
   
   const validationProgressSchema = z.object({
     totalResources: z.number().min(0),
     processedResources: z.number().min(0),
     validResources: z.number().min(0),
     errorResources: z.number().min(0),
     isComplete: z.boolean()
   });
   
   function validateProgress(data: any) {
     try {
       return validationProgressSchema.parse(data);
     } catch (error) {
       console.error('Validation error:', error);
       return null;
     }
   }
   ```

2. **Use Type Guards:**
   ```typescript
   function isValidationProgress(obj: any): obj is ValidationProgress {
     return (
       obj &&
       typeof obj.totalResources === 'number' &&
       typeof obj.processedResources === 'number' &&
       typeof obj.validResources === 'number' &&
       typeof obj.errorResources === 'number' &&
       typeof obj.isComplete === 'boolean'
     );
   }
   
   // Safe property access
   function getProgressPercentage(progress: any): number {
     if (isValidationProgress(progress) && progress.totalResources > 0) {
       return (progress.processedResources / progress.totalResources) * 100;
     }
     return 0;
   }
   ```

---

## Logging and Debugging

### Problem: Insufficient Logging Information

**Symptoms:**
- Hard to debug issues
- Missing context in error messages
- No performance metrics

**Solutions:**

1. **Enable Structured Logging:**
   ```javascript
   import { logger } from './utils/logger';
   
   // Use contextual logging
   logger.info('Validation started', 'validation', {
     resourceTypes: ['Patient', 'Observation'],
     batchSize: 100,
     userId: 'user123'
   });
   
   logger.error('Validation failed', 'validation', {
     error: error.message,
     resourceType: 'Patient',
     resourceId: 'patient123',
     stack: error.stack
   });
   ```

2. **Add Performance Monitoring:**
   ```javascript
   function withPerformanceLogging(fn, operation) {
     return async (...args) => {
       const start = Date.now();
       try {
         const result = await fn(...args);
         const duration = Date.now() - start;
         logger.info(`${operation} completed`, 'performance', {
           duration,
           success: true
         });
         return result;
       } catch (error) {
         const duration = Date.now() - start;
         logger.error(`${operation} failed`, 'performance', {
           duration,
           error: error.message,
           success: false
         });
         throw error;
       }
     };
   }
   ```

---

## Browser Compatibility

### Problem: SSE Not Working in Certain Browsers

**Symptoms:**
- SSE works in some browsers but not others
- Different behavior across browsers
- Older browser support issues

**Solutions:**

1. **Check Browser Support:**
   ```javascript
   function checkSSESupport() {
     if (typeof EventSource === 'undefined') {
       console.warn('EventSource not supported, falling back to polling');
       return false;
     }
     return true;
   }
   
   // Implement polling fallback
   function createPollingConnection(url, interval = 2000) {
     let isActive = true;
     
     const poll = async () => {
       if (!isActive) return;
       
       try {
         const response = await fetch(url);
         const data = await response.json();
         // Handle data
         console.log('Polling update:', data);
       } catch (error) {
         console.error('Polling error:', error);
       }
       
       if (isActive) {
         setTimeout(poll, interval);
       }
     };
     
     poll();
     
     return {
       close: () => { isActive = false; }
     };
   }
   ```

---

## Network and Proxy Issues

### Problem: SSE Works Locally But Fails in Production

**Symptoms:**
- SSE works in development but not production
- Connection timeouts in production
- Proxy or firewall blocking SSE

**Solutions:**

1. **Check Network Configuration:**
   ```javascript
   // Add timeout handling
   const eventSource = new EventSource('/api/validation/stream');
   
   const connectionTimeout = setTimeout(() => {
     if (eventSource.readyState !== EventSource.OPEN) {
       console.error('SSE connection timeout');
       eventSource.close();
       // Implement fallback
     }
   }, 10000);
   
   eventSource.onopen = () => {
     clearTimeout(connectionTimeout);
   };
   ```

2. **Configure Proxy Settings:**
   ```nginx
   # Nginx configuration for SSE
   location /api/validation/stream {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       
       # SSE specific headers
       proxy_set_header Connection '';
       proxy_http_version 1.1;
       proxy_buffering off;
       proxy_cache off;
       proxy_read_timeout 24h;
   }
   ```

---

## Prevention Strategies

### Best Practices

1. **Implement Comprehensive Error Handling:**
   ```javascript
   try {
     // Your code here
   } catch (error) {
     logger.error('Operation failed', 'operation', {
       error: error.message,
       stack: error.stack,
       context: { /* relevant context */ }
     });
     
     // Provide user-friendly error message
     showUserError('Something went wrong. Please try again.');
   }
   ```

2. **Use Health Checks:**
   ```javascript
   // Implement health check endpoint
   app.get('/health', (req, res) => {
     const health = {
       status: 'ok',
       timestamp: new Date().toISOString(),
       services: {
         database: checkDatabaseHealth(),
         fhirServer: checkFhirServerHealth(),
         sse: checkSSEHealth()
       }
     };
     
     res.json(health);
   });
   ```

3. **Monitor Performance:**
   ```javascript
   // Add performance monitoring
   const performanceObserver = new PerformanceObserver((list) => {
     list.getEntries().forEach((entry) => {
       if (entry.duration > 1000) { // Log slow operations
         logger.warn('Slow operation detected', 'performance', {
           name: entry.name,
           duration: entry.duration,
           startTime: entry.startTime
         });
       }
     });
   });
   
   performanceObserver.observe({ entryTypes: ['measure'] });
   ```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the Logs:**
   - Browser console for client-side errors
   - Server logs for backend issues
   - Network tab for request/response problems

2. **Create a Bug Report:**
   - Include error messages and stack traces
   - Provide steps to reproduce the issue
   - Include browser and system information

3. **Contact Support:**
   - Create an issue in the project repository
   - Include relevant log files and configuration
   - Provide a minimal reproduction case

---

## Quick Reference

### Common Commands

```bash
# Check server status
curl http://localhost:3000/health

# Test SSE connection
curl -N -H "Accept: text/event-stream" http://localhost:3000/api/validation/stream

# Check validation status
curl http://localhost:3000/api/validation/status

# Test FHIR server connection
curl http://localhost:3000/api/fhir/connection/test

# Check database connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Environment Variables

```bash
# Required environment variables
DATABASE_URL=postgresql://user:password@localhost:5432/records
NODE_ENV=production
PORT=3000

# Optional environment variables
LOG_LEVEL=info
CACHE_TTL=300000
MAX_CONCURRENT_VALIDATIONS=10
```

### Common Error Codes

- `VALIDATION_FAILED`: Validation process failed
- `FHIR_SERVER_CONNECTION_FAILED`: Cannot connect to FHIR server
- `DATABASE_CONNECTION_FAILED`: Database connection issue
- `SSE_CONNECTION_FAILED`: Server-Sent Events connection failed
- `AUTHENTICATION_FAILED`: Authentication error
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `TIMEOUT_ERROR`: Request timeout
- `UNKNOWN_ERROR`: Unclassified error

