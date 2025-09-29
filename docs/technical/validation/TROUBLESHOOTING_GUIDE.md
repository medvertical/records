# FHIR Validation Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for common FHIR validation issues, including diagnostics, solutions, and prevention strategies.

## Table of Contents

1. [Common Validation Issues](#common-validation-issues)
2. [External Service Issues](#external-service-issues)
3. [Performance Issues](#performance-issues)
4. [UI Display Issues](#ui-display-issues)
5. [Database Issues](#database-issues)
6. [Configuration Issues](#configuration-issues)
7. [Diagnostic Tools](#diagnostic-tools)
8. [Prevention Strategies](#prevention-strategies)

## Common Validation Issues

### Issue: All Resources Show 100% Validation Score

**Symptoms:**
- All FHIR resources show perfect validation scores (100%)
- No validation issues are reported
- Validation appears to be bypassed

**Root Causes:**
1. Validation service not properly initialized
2. External services (Ontoserver, Firely) are unavailable
3. Validation settings are disabled
4. Fallback validation is being used

**Diagnostics:**
```bash
# Check validation service status
curl -X GET http://localhost:3000/api/validation/status

# Check external service connectivity
curl -X GET http://localhost:3000/api/validation/health

# Verify validation settings
curl -X GET http://localhost:3000/api/validation/settings
```

**Solutions:**

1. **Check Service Initialization:**
   ```typescript
   // Verify validation service is properly initialized
   const validationService = new ConsolidatedValidationService();
   const status = await validationService.getStatus();
   console.log('Validation service status:', status);
   ```

2. **Verify External Services:**
   ```typescript
   // Test Ontoserver connectivity
   const ontoserverClient = new OntoserverClient();
   const r4Test = await ontoserverClient.testR4Connectivity();
   console.log('R4 Ontoserver:', r4Test.success ? 'Connected' : 'Failed');
   
   // Test Firely connectivity
   const firelyClient = new FirelyClient();
   const firelyTest = await firelyClient.testConnectivity();
   console.log('Firely Server:', firelyTest.success ? 'Connected' : 'Failed');
   ```

3. **Check Validation Settings:**
   ```typescript
   // Verify validation settings are enabled
   const settings = await validationSettingsService.getSettings();
   console.log('Validation enabled:', settings.enabled);
   console.log('Aspects enabled:', settings.aspects);
   ```

**Prevention:**
- Implement health checks for all external services
- Add monitoring for validation service status
- Configure alerts for validation failures

### Issue: Validation Takes Too Long

**Symptoms:**
- Validation operations take more than 10 seconds
- UI becomes unresponsive during validation
- Timeout errors occur

**Root Causes:**
1. External service timeouts
2. Database connection issues
3. Large resource validation
4. Network latency
5. Insufficient resources

**Diagnostics:**
```bash
# Check validation performance
curl -X GET http://localhost:3000/api/validation/performance

# Monitor external service response times
curl -X GET http://localhost:3000/api/validation/metrics

# Check database performance
curl -X GET http://localhost:3000/api/database/status
```

**Solutions:**

1. **Optimize External Service Calls:**
   ```typescript
   // Configure appropriate timeouts
   const ontoserverClient = new OntoserverClient();
   ontoserverClient.setTimeout(5000); // 5 seconds
   
   // Implement caching
   const cached = await terminologyCache.get('getCodeSystem', { system });
   if (cached) {
     return cached; // Use cached result
   }
   ```

2. **Implement Batch Processing:**
   ```typescript
   // Process multiple resources in batches
   const batchSize = 10;
   const batches = chunk(resources, batchSize);
   
   for (const batch of batches) {
     const results = await Promise.all(
       batch.map(resource => validateResource(resource))
     );
     // Process results
   }
   ```

3. **Database Optimization:**
   ```sql
   -- Add indexes for better performance
   CREATE INDEX idx_validation_results_resource_type ON validation_results(resource_type);
   CREATE INDEX idx_validation_results_validated_at ON validation_results(validated_at);
   ```

**Prevention:**
- Set appropriate timeout values
- Implement caching for frequently accessed data
- Monitor performance metrics
- Use batch processing for large datasets

### Issue: Validation Issues Not Displaying Correctly

**Symptoms:**
- Validation issues are not shown in the UI
- Incorrect issue counts or severity levels
- Missing validation badges or scores

**Root Causes:**
1. UI component rendering issues
2. Data format mismatches
3. State management problems
4. API response format issues

**Diagnostics:**
```bash
# Check API response format
curl -X POST http://localhost:3000/api/validation/validate \
  -H "Content-Type: application/json" \
  -d '{"resource": {...}}'

# Verify UI component props
# Check browser console for React errors
```

**Solutions:**

1. **Verify API Response Format:**
   ```typescript
   // Ensure API returns correct format
   interface ValidationResponse {
     success: boolean;
     data: {
       resourceType: string;
       resourceId: string;
       isValid: boolean;
       issues: ValidationIssue[];
       score: number;
       aspects: ValidationAspectResult[];
     };
   }
   ```

2. **Check UI Component State:**
   ```typescript
   // Verify component receives correct props
   const ValidationBadge = ({ validationResult }) => {
     console.log('Validation result:', validationResult);
     
     if (!validationResult) {
       return <div>No validation data</div>;
     }
     
     return (
       <div className={`badge ${getBadgeClass(validationResult.score)}`}>
         {validationResult.score}%
       </div>
     );
   };
   ```

3. **State Management:**
   ```typescript
   // Ensure proper state updates
   const [validationResults, setValidationResults] = useState(null);
   
   useEffect(() => {
     const fetchValidationResults = async () => {
       const results = await validationService.validateResource(resource);
       setValidationResults(results);
     };
     
     fetchValidationResults();
   }, [resource]);
   ```

**Prevention:**
- Implement proper error boundaries
- Add data validation for API responses
- Use TypeScript for type safety
- Test UI components with various data scenarios

## External Service Issues

### Issue: Ontoserver Connection Failed

**Symptoms:**
- Terminology validation fails
- "Ontoserver unavailable" errors
- Fallback validation being used

**Root Causes:**
1. Network connectivity issues
2. Ontoserver service down
3. Incorrect URL configuration
4. Authentication issues
5. Rate limiting

**Diagnostics:**
```bash
# Test Ontoserver connectivity
curl -X GET https://r4.ontoserver.csiro.au/fhir/metadata

# Check network connectivity
ping r4.ontoserver.csiro.au

# Verify DNS resolution
nslookup r4.ontoserver.csiro.au
```

**Solutions:**

1. **Network Troubleshooting:**
   ```bash
   # Check if service is reachable
   curl -I https://r4.ontoserver.csiro.au/fhir/metadata
   
   # Test with different timeout
   curl --connect-timeout 10 https://r4.ontoserver.csiro.au/fhir/metadata
   ```

2. **Configuration Check:**
   ```typescript
   // Verify configuration
   const config = {
     ontoserverR4Url: process.env.ONTOSERVER_R4_URL,
     timeout: process.env.VALIDATION_TIMEOUT || 5000
   };
   
   console.log('Ontoserver R4 URL:', config.ontoserverR4Url);
   ```

3. **Implement Fallback:**
   ```typescript
   // Use fallback validation when Ontoserver is unavailable
   const terminologyValidator = new TerminologyValidator();
   
   try {
     const result = await terminologyValidator.validateWithOntoserver(resource);
     return result;
   } catch (error) {
     console.warn('Ontoserver unavailable, using fallback:', error.message);
     return await terminologyValidator.validateWithFallback(resource);
   }
   ```

**Prevention:**
- Implement health checks
- Configure multiple Ontoserver instances
- Use caching to reduce external calls
- Monitor service availability

### Issue: Firely Server Connection Failed

**Symptoms:**
- Reference validation fails
- "Firely Server unavailable" errors
- Broken reference warnings not displayed

**Root Causes:**
1. Firely Server service down
2. Network connectivity issues
3. Incorrect configuration
4. Rate limiting

**Diagnostics:**
```bash
# Test Firely Server connectivity
curl -X GET https://server.fire.ly/R4/metadata

# Check service status
curl -X GET https://server.fire.ly/R4/health
```

**Solutions:**

1. **Service Health Check:**
   ```typescript
   const firelyClient = new FirelyClient();
   const health = await firelyClient.testConnectivity();
   
   if (!health.success) {
     console.error('Firely Server health check failed:', health.error);
     // Implement fallback or disable reference validation
   }
   ```

2. **Alternative Reference Validation:**
   ```typescript
   // Use local reference validation when Firely is unavailable
   const referenceValidator = new ReferenceValidator();
   
   try {
     return await referenceValidator.validateWithFirely(reference);
   } catch (error) {
     console.warn('Firely unavailable, using local validation:', error.message);
     return await referenceValidator.validateLocally(reference);
   }
   ```

**Prevention:**
- Implement service monitoring
- Configure multiple Firely instances
- Cache reference validation results
- Use local reference validation as fallback

## Performance Issues

### Issue: High Memory Usage

**Symptoms:**
- Memory usage continuously increases
- Application becomes slow
- Out of memory errors

**Root Causes:**
1. Memory leaks in validation code
2. Large validation result objects
3. Inefficient caching
4. Unclosed database connections

**Diagnostics:**
```bash
# Monitor memory usage
node --inspect server.js
# Use Chrome DevTools to analyze memory

# Check for memory leaks
node --expose-gc --max-old-space-size=4096 server.js
```

**Solutions:**

1. **Memory Leak Detection:**
   ```typescript
   // Add memory monitoring
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Memory usage:', {
       rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
       heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
       heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB'
     });
   }, 30000);
   ```

2. **Optimize Data Structures:**
   ```typescript
   // Use streaming for large datasets
   const processLargeDataset = async (resources) => {
     for await (const resource of resources) {
       const result = await validateResource(resource);
       // Process result immediately, don't store in memory
       await saveResult(result);
     }
   };
   ```

3. **Cache Management:**
   ```typescript
   // Implement cache size limits
   const terminologyCache = new TerminologyCache({
     maxSize: 1000,
     maxMemoryMB: 100,
     cleanupInterval: 300000 // 5 minutes
   });
   ```

**Prevention:**
- Implement memory monitoring
- Use streaming for large datasets
- Set appropriate cache limits
- Regular garbage collection

### Issue: Slow Validation Performance

**Symptoms:**
- Validation takes longer than expected
- UI becomes unresponsive
- Poor user experience

**Root Causes:**
1. Inefficient algorithms
2. Too many external service calls
3. Database query optimization
4. Network latency

**Diagnostics:**
```bash
# Profile validation performance
node --prof server.js
# Use node --prof-process to analyze

# Monitor external service calls
curl -X GET http://localhost:3000/api/validation/metrics
```

**Solutions:**

1. **Performance Profiling:**
   ```typescript
   // Add performance monitoring
   const performanceMeasurer = new PerformanceMeasurer();
   
   const operationId = `validation-${Date.now()}`;
   performanceMeasurer.startTiming(operationId, 'validateResource');
   
   try {
     const result = await validateResource(resource);
     const duration = performanceMeasurer.endTiming(operationId);
     
     if (duration > 5000) { // 5 seconds
       console.warn('Slow validation detected:', duration + 'ms');
     }
     
     return result;
   } catch (error) {
     performanceMeasurer.endTiming(operationId);
     throw error;
   }
   ```

2. **Optimize External Calls:**
   ```typescript
   // Batch external service calls
   const batchValidateCodes = async (codes) => {
     const batches = chunk(codes, 10); // Process 10 codes at a time
     const results = [];
     
     for (const batch of batches) {
       const batchResults = await Promise.all(
         batch.map(code => ontoserverClient.validateCode(code))
       );
       results.push(...batchResults);
     }
     
     return results;
   };
   ```

3. **Database Optimization:**
   ```sql
   -- Add composite indexes
   CREATE INDEX idx_validation_results_composite 
   ON validation_results(resource_type, validated_at, score);
   
   -- Optimize queries
   EXPLAIN ANALYZE SELECT * FROM validation_results 
   WHERE resource_type = 'Patient' AND validated_at > NOW() - INTERVAL '1 day';
   ```

**Prevention:**
- Implement performance monitoring
- Use caching effectively
- Optimize database queries
- Batch external service calls

## UI Display Issues

### Issue: Validation Badges Not Updating

**Symptoms:**
- Validation badges show old scores
- UI doesn't reflect latest validation results
- Real-time updates not working

**Root Causes:**
1. State management issues
2. Event handling problems
3. Component re-rendering issues
4. API polling failures

**Diagnostics:**
```bash
# Check API polling
curl -X GET http://localhost:3000/api/validation/results/patient-001

# Monitor WebSocket/SSE connections
# Check browser network tab for failed requests
```

**Solutions:**

1. **State Management Fix:**
   ```typescript
   // Ensure proper state updates
   const useValidationResults = (resourceId) => {
     const [results, setResults] = useState(null);
     const [isLoading, setIsLoading] = useState(false);
     
     const updateResults = useCallback(async () => {
       setIsLoading(true);
       try {
         const newResults = await validationService.getResults(resourceId);
         setResults(newResults);
       } catch (error) {
         console.error('Failed to update validation results:', error);
       } finally {
         setIsLoading(false);
       }
     }, [resourceId]);
     
     useEffect(() => {
       updateResults();
       const interval = setInterval(updateResults, 30000); // 30 seconds
       return () => clearInterval(interval);
     }, [updateResults]);
     
     return { results, isLoading, updateResults };
   };
   ```

2. **Event Handling:**
   ```typescript
   // Implement proper event handling
   const ValidationBadge = ({ resourceId }) => {
     const { results, isLoading } = useValidationResults(resourceId);
     
     // Listen for real-time updates
     useEffect(() => {
       const handleValidationUpdate = (event) => {
         if (event.data.resourceId === resourceId) {
           setResults(event.data.results);
         }
       };
       
       window.addEventListener('validation-updated', handleValidationUpdate);
       return () => window.removeEventListener('validation-updated', handleValidationUpdate);
     }, [resourceId]);
     
     if (isLoading) return <div>Loading...</div>;
     if (!results) return <div>No data</div>;
     
     return (
       <div className={`badge ${getBadgeClass(results.score)}`}>
         {results.score}%
       </div>
     );
   };
   ```

**Prevention:**
- Implement proper state management
- Use React hooks correctly
- Add error boundaries
- Monitor real-time connections

### Issue: Validation Scores Display Incorrectly

**Symptoms:**
- Scores show as 0% or 100% when they shouldn't
- Incorrect score calculations
- Missing score displays

**Root Causes:**
1. Score calculation errors
2. Data format issues
3. UI component bugs
4. API response problems

**Diagnostics:**
```typescript
// Check score calculation
const calculateScore = (issues) => {
  const totalIssues = issues.length;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  // Score calculation: 100 - (errors * 10) - (warnings * 5)
  const score = Math.max(0, 100 - (errorCount * 10) - (warningCount * 5));
  
  console.log('Score calculation:', {
    totalIssues,
    errorCount,
    warningCount,
    calculatedScore: score
  });
  
  return score;
};
```

**Solutions:**

1. **Score Calculation Fix:**
   ```typescript
   // Implement robust score calculation
   const calculateValidationScore = (aspects) => {
     if (!aspects || aspects.length === 0) {
       return 100; // No validation performed
     }
     
     let totalWeight = 0;
     let weightedScore = 0;
     
     aspects.forEach(aspect => {
       const weight = aspect.weight || 1;
       const aspectScore = Math.max(0, 100 - (aspect.issues.length * 10));
       
       weightedScore += aspectScore * weight;
       totalWeight += weight;
     });
     
     return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 100;
   };
   ```

2. **UI Component Validation:**
   ```typescript
   // Add input validation
   const ValidationScore = ({ score }) => {
     // Validate score input
     if (typeof score !== 'number' || isNaN(score)) {
       console.error('Invalid score provided:', score);
       return <div>Invalid score</div>;
     }
     
     if (score < 0 || score > 100) {
       console.error('Score out of range:', score);
       return <div>Score error</div>;
     }
     
     const getScoreColor = (score) => {
       if (score >= 80) return 'green';
       if (score >= 60) return 'yellow';
       return 'red';
     };
     
     return (
       <div className={`score ${getScoreColor(score)}`}>
         {score}%
       </div>
     );
   };
   ```

**Prevention:**
- Implement input validation
- Add comprehensive testing
- Use TypeScript for type safety
- Monitor score calculations

## Database Issues

### Issue: Validation Results Not Persisting

**Symptoms:**
- Validation results are not saved to database
- Previous validation results are lost
- Database connection errors

**Root Causes:**
1. Database connection issues
2. Transaction failures
3. Schema mismatches
4. Permission problems

**Diagnostics:**
```bash
# Check database connection
psql -h localhost -U username -d database -c "SELECT 1;"

# Check database logs
tail -f /var/log/postgresql/postgresql.log

# Verify table structure
psql -h localhost -U username -d database -c "\d validation_results"
```

**Solutions:**

1. **Database Connection Check:**
   ```typescript
   // Implement database health check
   const checkDatabaseHealth = async () => {
     try {
       const result = await db.query('SELECT 1 as health');
       console.log('Database health check passed');
       return { healthy: true, result: result.rows[0] };
     } catch (error) {
       console.error('Database health check failed:', error);
       return { healthy: false, error: error.message };
     }
   };
   ```

2. **Transaction Management:**
   ```typescript
   // Implement proper transaction handling
   const saveValidationResult = async (result) => {
     const client = await db.getClient();
     
     try {
       await client.query('BEGIN');
       
       // Insert validation result
       const insertQuery = `
         INSERT INTO validation_results 
         (resource_type, fhir_resource_id, is_valid, score, issues, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id
       `;
       
       const values = [
         result.resourceType,
         result.resourceId,
         result.isValid,
         result.score,
         JSON.stringify(result.issues),
         new Date()
       ];
       
       const insertResult = await client.query(insertQuery, values);
       
       await client.query('COMMIT');
       
       return insertResult.rows[0].id;
     } catch (error) {
       await client.query('ROLLBACK');
       throw error;
     } finally {
       client.release();
     }
   };
   ```

3. **Schema Validation:**
   ```sql
   -- Verify table structure
   CREATE TABLE IF NOT EXISTS validation_results (
     id SERIAL PRIMARY KEY,
     resource_type VARCHAR(50) NOT NULL,
     fhir_resource_id VARCHAR(100) NOT NULL,
     is_valid BOOLEAN NOT NULL,
     score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
     issues JSONB DEFAULT '[]',
     validated_at TIMESTAMP DEFAULT NOW(),
     created_at TIMESTAMP DEFAULT NOW()
   );
   ```

**Prevention:**
- Implement database health checks
- Use proper transaction management
- Add database monitoring
- Regular backup procedures

### Issue: Database Performance Issues

**Symptoms:**
- Slow database queries
- High database CPU usage
- Connection timeouts

**Root Causes:**
1. Missing indexes
2. Inefficient queries
3. Large result sets
4. Connection pool exhaustion

**Diagnostics:**
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;
```

**Solutions:**

1. **Query Optimization:**
   ```sql
   -- Add appropriate indexes
   CREATE INDEX CONCURRENTLY idx_validation_results_resource_type 
   ON validation_results(resource_type);
   
   CREATE INDEX CONCURRENTLY idx_validation_results_validated_at 
   ON validation_results(validated_at);
   
   CREATE INDEX CONCURRENTLY idx_validation_results_score 
   ON validation_results(score);
   ```

2. **Connection Pool Management:**
   ```typescript
   // Configure connection pool
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: process.env.DB_PORT,
     database: process.env.DB_NAME,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     max: 20, // Maximum connections
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

3. **Query Optimization:**
   ```sql
   -- Optimize common queries
   EXPLAIN ANALYZE 
   SELECT resource_type, AVG(score) as avg_score, COUNT(*) as count
   FROM validation_results 
   WHERE validated_at > NOW() - INTERVAL '24 hours'
   GROUP BY resource_type
   ORDER BY avg_score DESC;
   ```

**Prevention:**
- Regular query performance analysis
- Appropriate indexing strategy
- Connection pool monitoring
- Database maintenance procedures

## Configuration Issues

### Issue: Environment Variables Not Loaded

**Symptoms:**
- External service URLs not configured
- Default values being used
- Configuration errors

**Root Causes:**
1. Missing .env file
2. Incorrect environment variable names
3. Environment not properly set
4. Configuration loading issues

**Diagnostics:**
```bash
# Check environment variables
printenv | grep -E "(ONTOSERVER|FIRELY|DATABASE)"

# Check .env file
cat .env

# Verify configuration loading
node -e "console.log(require('dotenv').config())"
```

**Solutions:**

1. **Environment Configuration:**
   ```bash
   # .env file example
   DATABASE_URL=postgresql://user:password@localhost:5432/records
   ONTOSERVER_R4_URL=https://r4.ontoserver.csiro.au/fhir
   ONTOSERVER_R5_URL=https://r5.ontoserver.csiro.au/fhir
   FIRELY_SERVER_URL=https://server.fire.ly/R4
   VALIDATION_TIMEOUT=5000
   VALIDATION_RETRY_ATTEMPTS=3
   VALIDATION_RETRY_DELAY=1000
   ```

2. **Configuration Validation:**
   ```typescript
   // Validate configuration on startup
   const validateConfiguration = () => {
     const required = [
       'DATABASE_URL',
       'ONTOSERVER_R4_URL',
       'FIRELY_SERVER_URL'
     ];
     
     const missing = required.filter(key => !process.env[key]);
     
     if (missing.length > 0) {
       throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
     }
     
     console.log('Configuration validated successfully');
   };
   
   validateConfiguration();
   ```

3. **Default Values:**
   ```typescript
   // Provide sensible defaults
   const config = {
     databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/records',
     ontoserverR4Url: process.env.ONTOSERVER_R4_URL || 'https://r4.ontoserver.csiro.au/fhir',
     firelyServerUrl: process.env.FIRELY_SERVER_URL || 'https://server.fire.ly/R4',
     validationTimeout: parseInt(process.env.VALIDATION_TIMEOUT) || 5000,
     retryAttempts: parseInt(process.env.VALIDATION_RETRY_ATTEMPTS) || 3,
     retryDelay: parseInt(process.env.VALIDATION_RETRY_DELAY) || 1000
   };
   ```

**Prevention:**
- Document all required environment variables
- Implement configuration validation
- Use configuration management tools
- Provide clear setup instructions

## Diagnostic Tools

### Health Check Endpoints

```typescript
// Comprehensive health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabaseHealth(),
      ontoserver: await checkOntoserverHealth(),
      firely: await checkFirelyHealth(),
      cache: await checkCacheHealth()
    },
    performance: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpu: process.cpuUsage()
    }
  };
  
  const allHealthy = Object.values(health.services).every(service => service.healthy);
  health.status = allHealthy ? 'healthy' : 'unhealthy';
  
  res.status(allHealthy ? 200 : 503).json(health);
});
```

### Performance Monitoring

```typescript
// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = {
    validation: {
      totalValidations: validationCounter.total,
      averageTime: validationCounter.averageTime,
      errorRate: validationCounter.errorRate
    },
    cache: {
      hitRate: cacheStats.hitRate,
      missRate: cacheStats.missRate,
      size: cacheStats.size
    },
    external: {
      ontoserver: ontoserverMetrics,
      firely: firelyMetrics
    }
  };
  
  res.json(metrics);
});
```

### Logging Configuration

```typescript
// Structured logging
const logger = {
  info: (message, meta = {}) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  error: (message, error, meta = {}) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  },
  
  warn: (message, meta = {}) => {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
};
```

## Prevention Strategies

### Monitoring and Alerting

1. **Service Health Monitoring:**
   - Implement health check endpoints
   - Set up automated monitoring
   - Configure alerts for service failures

2. **Performance Monitoring:**
   - Track validation performance metrics
   - Monitor external service response times
   - Set up performance alerts

3. **Error Monitoring:**
   - Track error rates and types
   - Implement error reporting
   - Set up error alerts

### Testing and Validation

1. **Automated Testing:**
   - Comprehensive test suite
   - Integration tests for external services
   - Performance tests

2. **Load Testing:**
   - Stress test validation system
   - Test with large datasets
   - Validate performance under load

3. **Chaos Engineering:**
   - Test failure scenarios
   - Validate fallback mechanisms
   - Ensure graceful degradation

### Documentation and Training

1. **Comprehensive Documentation:**
   - Architecture documentation
   - API documentation
   - Troubleshooting guides

2. **Team Training:**
   - System architecture training
   - Troubleshooting procedures
   - Emergency response protocols

3. **Knowledge Sharing:**
   - Regular team reviews
   - Incident post-mortems
   - Best practices documentation

## Conclusion

This troubleshooting guide provides comprehensive information for diagnosing and resolving common FHIR validation issues. By following the diagnostic procedures and implementing the suggested solutions, teams can quickly identify and resolve problems, ensuring the validation system operates reliably and efficiently.

Key takeaways:

- **Proactive Monitoring**: Implement comprehensive health checks and monitoring
- **Graceful Degradation**: Design fallback mechanisms for external service failures
- **Performance Optimization**: Monitor and optimize system performance
- **Error Handling**: Implement robust error handling and logging
- **Documentation**: Maintain up-to-date documentation and troubleshooting guides

Regular review and updates of this guide will ensure it remains relevant and helpful as the system evolves and new issues are discovered.
