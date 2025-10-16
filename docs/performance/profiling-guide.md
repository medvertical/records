# Performance Profiling Guide
**Task 10.5: Identify bottlenecks using profiling tools**

This guide explains how to profile the FHIR Validation Engine to identify performance bottlenecks.

## Table of Contents
- [Overview](#overview)
- [Profiling Tools](#profiling-tools)
- [Node.js Profiling with Clinic.js](#nodejs-profiling-with-clinicjs)
- [Chrome DevTools Profiling](#chrome-devtools-profiling)
- [Built-in Performance Tracking](#built-in-performance-tracking)
- [Common Bottlenecks](#common-bottlenecks)
- [Optimization Strategies](#optimization-strategies)

## Overview

The validation engine has multiple potential bottleneck areas:
1. **HAPI Validator Spawn** - Java process creation overhead
2. **Package Loading** - IG package download and initialization
3. **Terminology Validation** - External API calls to terminology servers
4. **Reference Validation** - HTTP requests to FHIR servers
5. **Profile Resolution** - Downloading and caching profiles
6. **Business Rules** - FHIRPath expression evaluation

## Profiling Tools

### 1. Built-in Timing Breakdowns

The validation engine includes detailed timing breakdowns (Task 10.4):

```typescript
// Enable detailed timing logs
process.env.LOG_VALIDATION_TIMING = 'true';

// Run validation
const result = await validationEngine.validateResource(request);

// Access timing data
const stats = validationEngine.getTimingStats();
console.log('Phase timings:', stats.byPhase);
console.log('Resource type timings:', stats.byResourceType);
```

**API Endpoints:**
- `GET /api/performance/timing/stats` - Aggregate statistics
- `GET /api/performance/timing/breakdowns` - Detailed breakdowns

### 2. Clinic.js (Recommended for Node.js)

Clinic.js provides comprehensive Node.js profiling:

#### Installation

```bash
npm install -g clinic
```

#### Profiling Methods

**Clinic Doctor** - Detects event loop issues, high CPU, memory leaks:

```bash
# Profile the validation server
clinic doctor -- node server.ts

# Opens a flame chart in your browser
```

**Clinic Flame** - CPU profiling with flame graphs:

```bash
# Generate flame graph
clinic flame -- node server.ts

# Run validation requests, then stop with Ctrl+C
```

**Clinic BubbleProf** - Async operations profiling:

```bash
# Profile async operations
clinic bubbleprof -- node server.ts
```

**Clinic HeapProfiler** - Memory allocation profiling:

```bash
# Profile memory allocations
clinic heapprofiler -- node server.ts
```

#### Analyzing Results

1. Run the profiler while executing validation workload
2. Open the generated HTML report
3. Look for:
   - **Hot spots** - Functions consuming most CPU time
   - **Long tasks** - Operations blocking event loop
   - **Memory spikes** - Large allocations
   - **Async delays** - Slow async operations

### 3. Chrome DevTools

Node.js can be profiled using Chrome DevTools:

#### Setup

```bash
# Start server with inspector
node --inspect server.ts

# Or attach to running process
node --inspect-brk server.ts
```

#### Steps

1. Open Chrome and navigate to `chrome://inspect`
2. Click "inspect" under your Node.js process
3. Go to "Profiler" tab
4. Click "Start" to begin profiling
5. Execute validation requests
6. Click "Stop" to end profiling
7. Analyze the flame chart

#### What to Look For

- **Self time** - Time spent in the function itself (excluding children)
- **Total time** - Time including all child function calls
- **Call counts** - How many times a function is called
- **Heavy functions** - Functions at the top of flame chart

### 4. Node.js Built-in Profiler

Node.js includes a built-in CPU profiler:

```bash
# Generate CPU profile
node --cpu-prof server.ts

# Or with sampling interval (default 1000 microseconds)
node --cpu-prof --cpu-prof-interval=500 server.ts

# Generates isolate-*.cpuprofile file
```

**Analyze with Chrome DevTools:**
1. Open Chrome DevTools
2. Go to "Profiler" tab
3. Click "Load" and select the `.cpuprofile` file

### 5. Performance Hooks API

Use Node.js Performance Hooks for custom measurements:

```typescript
import { performance, PerformanceObserver } from 'perf_hooks';

// Mark start of operation
performance.mark('validation-start');

// Perform validation
await validationEngine.validateResource(request);

// Mark end
performance.mark('validation-end');

// Measure duration
performance.measure('validation', 'validation-start', 'validation-end');

// Observe measurements
const obs = new PerformanceObserver((items) => {
  console.log(items.getEntries()[0].duration);
});
obs.observe({ entryTypes: ['measure'] });
```

## Common Bottlenecks

### 1. HAPI Validator Spawn Time

**Symptoms:**
- High `hapi-spawn` timing (>500ms)
- Slow first validation (cold start)

**Causes:**
- Java process spawn overhead
- Package loading on first run
- No process pool

**Solutions:**
- Enable HAPI process pool (Task 10.6)
- Pre-warm cache by spawning process at startup
- Use faster JVM startup options

### 2. Terminology Validation

**Symptoms:**
- High `terminology` aspect timing (>200ms per resource)
- Many external HTTP requests

**Causes:**
- Synchronous terminology lookups
- No batching
- Cache misses

**Solutions:**
- Implement batch validation (Task 10.7)
- Increase cache TTL
- Use local terminology server
- Implement request deduplication

### 3. Profile Download

**Symptoms:**
- High `profile` aspect timing (>1000ms)
- Network timeouts

**Causes:**
- Downloading profiles on-demand
- Slow Simplifier API
- No profile pre-caching

**Solutions:**
- Pre-load common profiles at startup (Task 10.8)
- Cache IG packages locally
- Use CDN for profile hosting

### 4. Reference Validation

**Symptoms:**
- High `reference` aspect timing (>500ms)
- Many HTTP GET requests

**Causes:**
- Individual reference lookups
- No batching
- Using GET instead of HEAD

**Solutions:**
- Batch HTTP requests (Task 10.9)
- Use HEAD instead of GET for existence checks
- Implement reference cache
- Skip external reference validation in offline mode

### 5. Business Rule Execution

**Symptoms:**
- High `businessRule` aspect timing (>100ms)
- Slow FHIRPath evaluation

**Causes:**
- Complex FHIRPath expressions
- No expression caching
- Parsing expression on each execution

**Solutions:**
- Pre-compile FHIRPath expressions
- Cache parsed expressions
- Limit expression complexity
- Use indexes for large collections

### 6. Database Queries

**Symptoms:**
- High `settings-load` timing (>100ms)
- Slow cache reads

**Causes:**
- Unindexed queries
- N+1 query problems
- No connection pooling

**Solutions:**
- Add database indexes
- Use connection pooling
- Implement query result caching
- Batch database operations

## Profiling Workflow

### Step 1: Establish Baseline

```bash
# Run performance test suite
npm test -- tests/performance/validation-performance.test.ts

# Capture baseline metrics
curl http://localhost:3000/api/performance/baseline/current
```

### Step 2: Profile with Clinic.js

```bash
# Start profiling
clinic doctor -- node server.ts

# In another terminal, run load test
node tests/performance/load-test.js

# Stop server (Ctrl+C)
# Clinic opens HTML report automatically
```

### Step 3: Analyze Timing Breakdowns

```bash
# Enable timing logs
export LOG_VALIDATION_TIMING=true

# Run validation
node -e "
  const { getValidationEngine } = require('./server/services/validation/core/validation-engine');
  const engine = getValidationEngine();
  // ... run validation
"

# Check timing API
curl http://localhost:3000/api/performance/timing/stats | jq
```

### Step 4: Profile Specific Operations

```typescript
// Profile specific aspect
import { createValidationTimer } from './server/services/validation/utils/validation-timing';

const timer = createValidationTimer('Patient', 'terminology');
timer.startPhase('code-extraction');
// ... extract codes
timer.endPhase();

timer.startPhase('validation');
// ... validate codes
timer.endPhase();

console.log(timer.formatBreakdown());
```

### Step 5: Identify Bottlenecks

Analyze the profiling data to find:
- **Functions with high self-time** (CPU bottlenecks)
- **Functions with many calls** (optimization opportunities)
- **Long-running async operations** (I/O bottlenecks)
- **Memory allocations** (GC pressure points)

### Step 6: Verify Improvements

After optimization:

```bash
# Re-run performance tests
npm test -- tests/performance/validation-performance.test.ts

# Compare baselines
curl http://localhost:3000/api/performance/baseline/history | jq '.baselines[-2:]'
```

## Performance Metrics to Track

### Primary Metrics
- **Cold start time**: First validation without cache (<5s target)
- **Warm cache time**: Subsequent validations (<2s target)
- **Throughput**: Resources validated per second (>10 target)
- **P95 latency**: 95th percentile response time (<3s target)

### Secondary Metrics
- **HAPI spawn time**: Java process creation (<500ms target)
- **Package load time**: IG package loading (<1s target)
- **Terminology time**: Terminology validation per resource (<100ms target)
- **Profile resolution time**: Profile download and parse (<500ms target)

### Resource Metrics
- **Memory usage**: Heap size and RSS (<512MB target)
- **CPU usage**: Percentage during validation (<80% target)
- **Network requests**: External API calls (<50 per validation target)
- **Cache hit rate**: Percentage of cache hits (>80% target)

## Automated Profiling Script

```bash
#!/bin/bash
# scripts/profile-validation.sh

echo "=== Starting Validation Profiling ==="

# 1. Baseline metrics
echo "Capturing baseline..."
npm test -- tests/performance/validation-performance.test.ts > /tmp/baseline.log

# 2. Clinic Doctor
echo "Running Clinic Doctor..."
clinic doctor --on-port 'node tests/performance/load-test.js' -- node server.ts

# 3. CPU Profile
echo "Generating CPU profile..."
node --cpu-prof server.ts &
PID=$!
sleep 5
node tests/performance/load-test.js
kill $PID

# 4. Timing breakdown
echo "Fetching timing breakdown..."
curl http://localhost:3000/api/performance/timing/stats > /tmp/timing-stats.json

echo "=== Profiling Complete ==="
echo "Results:"
echo "  - Baseline: /tmp/baseline.log"
echo "  - Clinic Report: (opened in browser)"
echo "  - CPU Profile: $(ls -t isolate-*.cpuprofile | head -1)"
echo "  - Timing Stats: /tmp/timing-stats.json"
```

## Continuous Performance Monitoring

### Integration with CI/CD

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: npm test -- tests/performance/validation-performance.test.ts
      
      - name: Check performance regression
        run: |
          node scripts/check-performance-regression.js
      
      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: performance-results
          path: performance-results.json
```

### Performance Regression Detection

```typescript
// scripts/check-performance-regression.js
import { performanceBaselineTracker } from './server/services/performance/performance-baseline';

const current = performanceBaselineTracker.getCurrentBaseline();
const previous = performanceBaselineTracker.getAllBaselines().slice(-2)[0];

if (!previous) {
  console.log('No previous baseline to compare');
  process.exit(0);
}

const comparison = performanceBaselineTracker.compareToBaseline(previous);

if (comparison.regressions.length > 0) {
  console.error('Performance regressions detected:');
  comparison.regressions.forEach(r => console.error(`  - ${r}`));
  process.exit(1);
}

console.log('No performance regressions detected');
process.exit(0);
```

## Best Practices

1. **Profile in production-like environment** - Use similar data volumes and load patterns
2. **Profile with realistic workload** - Mix of resource types and validation aspects
3. **Run multiple iterations** - Average results across several runs
4. **Profile before and after optimizations** - Measure actual improvements
5. **Focus on hot paths** - Optimize the 20% of code that uses 80% of time
6. **Consider trade-offs** - Balance performance, memory, and code complexity
7. **Monitor in production** - Track real-world performance metrics
8. **Set performance budgets** - Define acceptable limits for key metrics

## Troubleshooting

### Clinic.js Not Opening Report

```bash
# Manually open report
open .clinic/<report-id>.clinic-doctor.html
```

### Chrome DevTools Connection Issues

```bash
# Use explicit host and port
node --inspect=0.0.0.0:9229 server.ts

# Check firewall settings
# Ensure port 9229 is accessible
```

### High Memory Usage

```bash
# Profile with heap snapshots
node --inspect --expose-gc server.ts

# In Chrome DevTools > Memory tab:
# 1. Take heap snapshot before validation
# 2. Run validation
# 3. Force GC
# 4. Take another snapshot
# 5. Compare snapshots to find leaks
```

### Slow First Request

This is expected (cold start). To reduce:
- Enable process pool
- Pre-warm caches at startup
- Use serverless keep-warm strategies

## Next Steps

After identifying bottlenecks, proceed with optimization tasks:
- **Task 10.6**: Optimize structural validation (process pool)
- **Task 10.7**: Optimize terminology validation (batching, caching)
- **Task 10.8**: Optimize profile validation (pre-loading)
- **Task 10.9**: Optimize reference validation (batching, HEAD requests)
- **Task 10.10**: Parallel aspect validation

## Resources

- [Clinic.js Documentation](https://clinicjs.org/documentation/)
- [Chrome DevTools Profiling](https://developer.chrome.com/docs/devtools/performance/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
- [V8 Profiling](https://v8.dev/docs/profile)
- [Performance Timing API](https://nodejs.org/api/perf_hooks.html)


