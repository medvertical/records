# Performance Dashboard Guide
**Task 10.12: Real-time visualization of validation performance metrics**

## Overview

The Performance Dashboard provides comprehensive real-time monitoring and historical analysis of FHIR validation performance. It visualizes all the metrics we've been collecting throughout the performance optimization work, giving administrators and developers actionable insights into validation speed, resource usage, and system health.

## Dashboard URL

```
http://localhost:3000/performance
```

Access via:
- Navigation sidebar: "Performance" link
- Direct URL navigation
- Keyboard shortcut: (Coming in future version)

## Features

### 1. Real-Time Monitoring

**Auto-Refresh:**
- Automatic updates every 10 seconds (configurable)
- Toggle auto-refresh on/off
- Manual refresh button

**Key Metrics (Overview Cards):**
1. **Cold Start Time** - First validation without cache
2. **Warm Cache Time** - Subsequent cached validations  
3. **Throughput** - Resources validated per second
4. **Cache Hit Rate** - Effectiveness of caching layer

### 2. Target Achievement Alert

The dashboard automatically displays a success alert when the warm cache validation time is under the 2-second target, celebrating the achievement of interactive validation performance.

```
✓ Performance Target Achieved! 🎉
Warm cache validation time is 485ms, which is under the 2-second target.
Interactive validation is now extremely fast!
```

### 3. Tabbed Views

#### Overview Tab

**Validation Timing Card:**
- Total Validations: Count of all validations measured
- Average Time: Mean validation duration
- Min Time: Fastest validation
- Max Time: Slowest validation

**Memory Usage Card:**
- Heap Used: Active JavaScript heap memory
- Heap Total: Total allocated heap memory
- RSS (Resident Set Size): Total process memory
- External: C++ objects bound to JavaScript

#### Aspects Tab

**Performance by Validation Aspect:**
- Visual bar chart showing time spent per aspect
- Sorted by slowest to fastest
- Percentage of total validation time
- Sample count per aspect

Aspects tracked:
- Structural validation (HAPI FHIR Validator)
- Profile validation (StructureDefinition conformance)
- Terminology validation (ValueSet/CodeSystem)
- Reference validation (Reference integrity)
- Business rules (FHIRPath custom rules)
- Metadata validation (Resource metadata)

#### Resources Tab

**Performance by Resource Type:**
- Average validation time per FHIR resource type
- Visual bar chart visualization
- Sample count per resource type
- P95 (95th percentile) timing

Common resource types:
- Patient
- Observation
- Encounter
- Condition
- Procedure
- MedicationRequest
- DiagnosticReport
- etc.

#### Optimizations Tab

**1. HAPI Process Pool Status:**
- Enabled/Disabled badge
- Pool size (number of processes)
- Idle processes (ready for work)
- Busy processes (actively validating)
- Average validation time

**Alert:**
```
Enable with HAPI_USE_PROCESS_POOL=true for 80% faster structural validation
```

**2. Terminology Cache:**
- Cache size (number of entries)
- Hit rate percentage
- Total hits count
- Total misses count

**Success Badge:**
```
✓ Excellent (>80% hit rate)
```

**3. Validation Mode:**
- Mode: Parallel / Sequential
- Description: What the mode does
- Expected Speedup: Performance gain estimate

**4. Performance Summary:**
- Total validations tracked
- Number of phases tracked
- Number of resource types
- Number of aspects

#### System Tab

**System Resources:**

**Heap Memory Bar:**
```
Heap Used / Heap Total
[████████░░░░░░░░░░░░] 45.2 / 128.0 MB
```

**RSS Memory Bar:**
```
RSS (Resident Set Size)
[██████░░░░░░░░░░░░░░] 256.5 MB
```

## Metrics Explained

### Performance Metrics

#### Cold Start Time
**What it is:** Time to validate the first resource when the application starts (no cache, no process pool warm-up).

**Typical values:**
- Before optimization: 3,000-5,000ms
- After optimization: 800-1,500ms

**Affects:**
- Application startup
- First validation after server restart
- First validation of a new resource type

#### Warm Cache Time
**What it is:** Time to validate a resource when caches are warmed up and the process pool is ready.

**Target:** <2,000ms (2 seconds) for interactive validation

**Typical values:**
- Before optimization: 2,500-5,000ms
- After optimization: 250-800ms

**This is the most important metric** for user experience.

**Affects:**
- Interactive validation in the UI
- User-perceived performance
- Real-time feedback

#### Throughput
**What it is:** Number of resources validated per second in batch mode.

**Typical values:**
- Before optimization: 0.2-0.5 resources/second
- After optimization: 2-5 resources/second

**Affects:**
- Batch validation speed
- Import performance
- Bulk operations

### Cache Metrics

#### Hit Rate
**What it is:** Percentage of cache lookups that find a cached result.

**Formula:**
```
Hit Rate = (Hits / (Hits + Misses)) × 100%
```

**Target:** >80% for good cache effectiveness

**Typical values:**
- Cold start: 0-10%
- After warm-up: 80-95%
- Steady state: 85-98%

#### Hit Time vs Miss Time
**What it is:** Average time for cache hits vs misses.

**Typical difference:**
- Cache hit: 1-5ms
- Cache miss: 100-500ms

**Speedup:** 20-100x faster with cache

### Memory Metrics

#### Heap Used
**What it is:** Amount of JavaScript heap memory currently in use.

**Typical values:**
- Idle: 20-50 MB
- Under load: 50-200 MB
- High load: 200-500 MB

**Concerns:**
- >500 MB: May indicate memory leak
- >1 GB: Serious issue, investigate

#### Heap Total
**What it is:** Total JavaScript heap memory allocated by V8.

**Typical values:** 128-512 MB

**Note:** Heap total can grow and shrink based on application needs.

#### RSS (Resident Set Size)
**What it is:** Total memory used by the Node.js process (heap + native + stack + buffers).

**Typical values:**
- Idle: 50-150 MB
- Under load: 200-500 MB
- High load: 500-1000 MB

**Concerns:**
- >1 GB: May need optimization
- >2 GB: Serious issue, investigate

#### External
**What it is:** Memory used by C++ objects bound to JavaScript objects.

**Typical values:** 2-50 MB

**Examples:** Buffer objects, native modules

## Optimization Status Indicators

### Success Badges

#### ✓ Under 2s target!
**Displayed when:** Warm cache time < 2,000ms

**Meaning:** Interactive validation performance target achieved.

#### ✓ Excellent
**Displayed when:** Cache hit rate > 80%

**Meaning:** Cache is working effectively.

### Warning Alerts

#### Pool Disabled Warning
```
⚠ Enable with HAPI_USE_PROCESS_POOL=true for 80% faster structural validation
```

**Action:** Set `HAPI_USE_PROCESS_POOL=true` in environment variables.

## Usage Examples

### Monitoring Performance During Development

1. **Open Performance Dashboard**
   ```
   Navigate to http://localhost:3000/performance
   ```

2. **Run Validations**
   - Validate resources in the UI
   - Run batch validations
   - Execute API calls

3. **Observe Metrics**
   - Watch warm cache time
   - Check cache hit rate
   - Monitor aspect timing

4. **Identify Bottlenecks**
   - Which aspect is slowest?
   - Which resource type takes longest?
   - Is cache working effectively?

### Verifying Optimization Impact

**Before Optimization:**
```
1. Note current metrics:
   - Warm cache: 3,500ms
   - Cold start: 5,200ms
   - Throughput: 0.3 res/sec
   - Hit rate: 60%
```

**Apply Optimization:**
```
2. Enable optimization (e.g., process pool)
3. Restart server
4. Clear timing data (if needed)
```

**After Optimization:**
```
5. Run same validations
6. Compare metrics:
   - Warm cache: 650ms (81% faster!)
   - Cold start: 1,200ms (77% faster!)
   - Throughput: 1.8 res/sec (6x improvement!)
   - Hit rate: 92% (32% improvement)
```

### Troubleshooting Performance Issues

**Symptom:** High cold start time (>3,000ms)

**Check:**
1. Is HAPI process pool enabled?
2. Are common profiles preloaded?
3. Is first validation downloading profiles?

**Action:**
- Enable process pool
- Enable profile preloading
- Check network connectivity

---

**Symptom:** High warm cache time (>2,000ms)

**Check:**
1. Which aspect is slowest? (Aspects tab)
2. Is cache hit rate high? (>80%)
3. Is parallel validation enabled?

**Action:**
- Optimize slowest aspect
- Increase cache size/TTL
- Enable parallel validation

---

**Symptom:** Low cache hit rate (<60%)

**Check:**
1. Cache size (Optimizations tab)
2. Cache TTL settings
3. Are resources changing frequently?

**Action:**
- Increase cache size
- Increase TTL
- Check for unnecessary cache invalidation

---

**Symptom:** High memory usage (>500 MB)

**Check:**
1. Heap used vs total (System tab)
2. Number of active validations
3. Cache size

**Action:**
- Reduce cache size
- Limit concurrent validations
- Check for memory leaks

## API Integration

The dashboard consumes these API endpoints:

### Current Baseline
```http
GET /api/performance/baseline/current
```

**Response:**
```json
{
  "timestamp": "2024-10-16T11:00:00.000Z",
  "coldStartTimeMs": 1250,
  "warmCacheTimeMs": 485,
  "throughputResourcesPerSecond": 2.5,
  "byResourceType": {...},
  "byAspect": {...},
  "memoryUsageMB": {...},
  "cacheEffectiveness": {...}
}
```

### Timing Stats
```http
GET /api/performance/timing/stats
```

**Response:**
```json
{
  "count": 1523,
  "avgTotalMs": 512,
  "minTotalMs": 245,
  "maxTotalMs": 3250,
  "byPhase": {...},
  "byResourceType": {...},
  "byAspect": {...}
}
```

### Pool Stats
```http
GET /api/performance/pool/stats
```

**Response:**
```json
{
  "enabled": true,
  "poolSize": 5,
  "idleProcesses": 3,
  "busyProcesses": 2,
  "totalValidations": 1234,
  "avgValidationTimeMs": 450
}
```

### Terminology Cache Stats
```http
GET /api/performance/terminology/cache-stats
```

**Response:**
```json
{
  "size": 45230,
  "hits": 123456,
  "misses": 5432,
  "hitRate": 95.8,
  "evictions": 234
}
```

### Validation Mode
```http
GET /api/performance/validation/mode
```

**Response:**
```json
{
  "parallel": true,
  "description": "Aspects run concurrently",
  "expectedSpeedup": "40-60% faster than sequential"
}
```

## Performance Targets

### Interactive Validation (<2s)

**Achieved when:**
- Warm cache time < 2,000ms
- Cache hit rate > 80%
- Process pool enabled
- Parallel validation enabled

**Impact:**
- Users can validate resources in real-time
- No perceptible delay
- Excellent user experience

### Batch Validation (>1 resource/sec)

**Achieved when:**
- Throughput > 1.0 resources/second
- Optimizations enabled
- Parallel processing configured

**Impact:**
- Fast import of bulk data
- Quick batch revalidation
- Efficient data migration

### System Health

**Targets:**
- Memory usage < 500 MB under normal load
- Heap growth stable (not constantly increasing)
- Cache hit rate > 80%
- No error spikes

**Impact:**
- Stable long-running server
- Consistent performance
- No memory leaks

## Dashboard Configuration

### Auto-Refresh Interval

**Default:** 10 seconds (10,000ms)

**Change:** Click "Auto-Refresh ON" button to toggle on/off

**Recommended:**
- Development: 5-10 seconds
- Production: 30-60 seconds
- Testing: Manual refresh only

### Query Refetch

The dashboard uses React Query with:
```typescript
refetchInterval: refreshInterval  // 10000 or false
```

**Disable auto-refresh** to reduce server load when not actively monitoring.

## Best Practices

1. **Monitor During Load Testing**
   - Enable auto-refresh
   - Run realistic workload
   - Watch for performance degradation

2. **Compare Before/After**
   - Record baseline metrics
   - Apply optimization
   - Measure improvement

3. **Track Over Time**
   - Check dashboard regularly
   - Look for trends
   - Identify regressions early

4. **Use in CI/CD**
   - Automated performance tests
   - Compare PR performance impact
   - Block regressions

5. **Optimize Based on Data**
   - Identify slowest aspect
   - Focus optimization efforts
   - Measure impact

## Troubleshooting Dashboard Issues

### Dashboard Not Loading

**Symptom:** Blank page or error

**Causes:**
1. Server not running
2. API endpoints not accessible
3. JavaScript error

**Solutions:**
```bash
# Check server status
curl http://localhost:3000/api/health

# Check browser console for errors
# Open DevTools → Console

# Restart development server
npm run dev
```

### No Data Showing

**Symptom:** Dashboard loads but shows "—" or "No data available"

**Causes:**
1. No validations run yet
2. Performance tracking not started
3. API returning empty data

**Solutions:**
```bash
# Run a validation to generate data
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"resource": {...}}'

# Check API directly
curl http://localhost:3000/api/performance/baseline/current
```

### Metrics Not Updating

**Symptom:** Dashboard shows old data

**Causes:**
1. Auto-refresh disabled
2. API caching issue
3. Browser cache

**Solutions:**
- Click "Refresh" button
- Enable auto-refresh
- Hard refresh browser (Ctrl+Shift+R)

## Future Enhancements

Planned features for future versions:

1. **Historical Trends**
   - Charts showing performance over time
   - Week/month comparison
   - Regression detection

2. **Alerting**
   - Performance threshold alerts
   - Email/Slack notifications
   - Automatic issue creation

3. **Comparison View**
   - Compare two time periods
   - A/B test results
   - Release comparison

4. **Export**
   - Export metrics as CSV
   - Generate PDF reports
   - Share snapshots

5. **Custom Dashboards**
   - Create custom views
   - Save dashboard layouts
   - Team-specific dashboards

## Related Documentation

- [Performance Baseline Tracking](./performance-baseline-guide.md) - Baseline metrics
- [Detailed Timing Breakdowns](./detailed-timing-guide.md) - Phase-level timing
- [HAPI Process Pool](./hapi-process-pool-guide.md) - Structural validation optimization
- [Terminology Optimization](./terminology-optimization-guide.md) - Terminology caching
- [Profile Preloading](./profile-preloading-guide.md) - Profile optimization
- [Reference Optimization](./reference-validation-optimization-guide.md) - Reference checking
- [Parallel Validation](./parallel-validation-guide.md) - Concurrent aspects

## Conclusion

The Performance Dashboard is your window into validation performance. Use it to:
- Monitor real-time performance
- Verify optimization impact
- Identify bottlenecks
- Track improvements over time
- Ensure targets are met

**Remember:** The goal is warm cache validation under 2 seconds for an excellent interactive user experience. The dashboard makes it easy to see if you're achieving this target! 🎯


