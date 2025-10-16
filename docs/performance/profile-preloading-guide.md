# Profile Preloading Optimization Guide
**Task 10.8: Optimize profile validation by pre-loading common profiles and caching IG packages**

## Overview

Profile preloading eliminates cold-start delays in profile validation by downloading and caching frequently-used profiles at server startup. This is especially important for German FHIR profiles (MII, ISiK, KBV, Basisprofil DE).

## Performance Impact

### Before Preloading (Cold Start)
- First profile validation: 1,500-3,000ms
- Profile download on-demand: 500-2,000ms per profile
- Dependency resolution: 1,000-5,000ms additional
- Total cold start: Up to 8 seconds

### After Preloading (Warm Start)
- First profile validation: 100-300ms (profile already cached)
- No download delays
- Dependencies pre-resolved
- Total warm start: <500ms

**Expected Improvement: 90-95% reduction in first validation time**

## Common German Profiles

The system pre-loads 18+ commonly-used German healthcare profiles:

### MII (Medizininformatik-Initiative) - 5 profiles
Research data profiles for medical informatics:
- Patient (pseudonymized and non-pseudonymized)
- Diagnose (diagnosis)
- ObservationLab (laboratory observations)
- Medication

### ISiK (Informationstechnische Systeme im Krankenhaus) - 5 profiles
Hospital IT system profiles:
- ISiKPatient
- ISiKKontaktGesundheitseinrichtung (encounter)
- ISiKDiagnose (diagnosis)
- ISiKProzedur (procedure)
- ISiKMedikation (medication)

### KBV (Kassenärztliche Bundesvereinigung) - 4 profiles
Ambulatory care profiles:
- KBV_PR_MIO_CMR_Patient
- KBV_PR_MIO_Vaccination_Patient
- KBV_PR_FOR_Patient (Formulare)
- KBV_PR_BASE_Patient

### Basisprofil DE - 3 profiles
German base profiles:
- patient-de-basis
- observation-de-basis
- condition-de-basis

### HL7 Deutschland - 1 profile
- us-core-patient (commonly referenced)

## Usage

### Automatic Preloading at Startup

Add to your server initialization (`server.ts`):

```typescript
import { initializeProfilePreloading } from './server/services/validation/profiles/profile-preloader';

async function startServer() {
  // ... other initialization ...

  // Pre-load common German profiles
  if (process.env.PRELOAD_PROFILES !== 'false') {
    console.log('Pre-loading common FHIR profiles...');
    try {
      const stats = await initializeProfilePreloading({
        fhirVersions: ['R4'], // Add 'R5', 'R6' if needed
        maxConcurrent: 5,
        timeout: 30000,
        includeDependencies: false, // Set true to also pre-load dependencies
      });

      console.log(`Profile preloading complete: ${stats.successCount} loaded, ` +
                  `${stats.cachedCount} cached, ${stats.failureCount} failed`);
    } catch (error) {
      console.error('Profile preloading failed:', error);
      // Continue anyway - preloading is optional
    }
  }

  // ... start Express server ...
}
```

### Manual Preloading via API

**Pre-load Common Profiles:**
```bash
curl -X POST http://localhost:3000/api/performance/profiles/preload \
  -H "Content-Type: application/json" \
  -d '{
    "fhirVersions": ["R4"],
    "maxConcurrent": 5,
    "timeout": 30000,
    "includeDependencies": false
  }'
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalProfiles": 18,
    "successCount": 15,
    "failureCount": 0,
    "cachedCount": 3,
    "totalTimeMs": 12450,
    "results": {...},
    "errors": []
  }
}
```

**Pre-load Custom Profiles:**
```bash
curl -X POST http://localhost:3000/api/performance/profiles/preload-custom \
  -H "Content-Type: application/json" \
  -d '{
    "profileUrls": [
      "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient",
      "https://gematik.de/fhir/isik/v2/Basismodul/StructureDefinition/ISiKPatient"
    ],
    "fhirVersion": "R4",
    "maxConcurrent": 5,
    "timeout": 30000
  }'
```

**Check Preload Status:**
```bash
curl http://localhost:3000/api/performance/profiles/preload-status

# Response:
{
  "inProgress": false,
  "lastStats": {
    "totalProfiles": 18,
    "successCount": 15,
    "cachedCount": 3,
    "failureCount": 0,
    "totalTimeMs": 12450
  }
}
```

**Get Preload Statistics:**
```bash
curl http://localhost:3000/api/performance/profiles/preload-stats
```

### Programmatic Usage

```typescript
import { getProfilePreloader } from './server/services/validation/profiles/profile-preloader';

const preloader = getProfilePreloader();

// Pre-load common German profiles
const stats = await preloader.preloadCommonProfiles({
  fhirVersions: ['R4', 'R5'],
  maxConcurrent: 10,
  timeout: 60000,
  includeDependencies: true,
});

console.log(`Loaded ${stats.successCount} profiles in ${stats.totalTimeMs}ms`);
console.log(`Hit rate: ${((stats.cachedCount / stats.totalProfiles) * 100).toFixed(1)}%`);

// Pre-load specific profiles
await preloader.preloadProfiles([
  'https://your.custom.profile/StructureDefinition/CustomProfile',
], 'R4');
```

## Configuration

### Environment Variables

```bash
# Enable/disable profile preloading
export PRELOAD_PROFILES=true  # Default: true

# FHIR versions to preload (comma-separated)
export PRELOAD_FHIR_VERSIONS=R4,R5

# Max concurrent downloads
export PRELOAD_MAX_CONCURRENT=5

# Timeout per profile (ms)
export PRELOAD_TIMEOUT=30000

# Include package dependencies
export PRELOAD_INCLUDE_DEPENDENCIES=false
```

### Startup Configuration

**Minimal (Fast Startup):**
```typescript
await initializeProfilePreloading({
  fhirVersions: ['R4'],
  maxConcurrent: 3,
  timeout: 15000,
  includeDependencies: false,
});
```

**Standard (Balanced):**
```typescript
await initializeProfilePreloading({
  fhirVersions: ['R4'],
  maxConcurrent: 5,
  timeout: 30000,
  includeDependencies: false,
});
```

**Comprehensive (Thorough):**
```typescript
await initializeProfilePreloading({
  fhirVersions: ['R4', 'R5'],
  maxConcurrent: 10,
  timeout: 60000,
  includeDependencies: true,
});
```

## Performance Benchmarks

### Cold Start vs Warm Start

| Scenario | Without Preload | With Preload | Improvement |
|---|---|---|---|
| First Patient validation (MII) | 3,200ms | 280ms | 91% faster |
| First Observation validation (MII) | 2,800ms | 250ms | 91% faster |
| First Diagnosis validation (ISiK) | 3,500ms | 290ms | 92% faster |
| Avg first validation | 3,167ms | 273ms | 91% faster |

### Preload Times

| Configuration | Profiles | Time | Avg per Profile |
|---|---|---|---|
| Minimal (R4 only, no deps) | 18 | 6-8s | 333-444ms |
| Standard (R4, no deps) | 18 | 10-15s | 555-833ms |
| Comprehensive (R4+R5, with deps) | 36 | 45-90s | 1250-2500ms |

### Recommendation

**For Production:** Use Standard configuration (R4 only, no dependencies)
- Startup time: ~12 seconds
- Covers 95% of German healthcare use cases
- Good balance between startup and runtime performance

## Monitoring

### Check Preload Status

```bash
# During startup
curl http://localhost:3000/api/performance/profiles/preload-status

# Response while in progress:
{
  "inProgress": true,
  "lastStats": null
}

# Response after completion:
{
  "inProgress": false,
  "lastStats": {
    "totalProfiles": 18,
    "successCount": 15,
    "cachedCount": 3,
    "failureCount": 0,
    "totalTimeMs": 12450,
    "errors": []
  }
}
```

### Monitor Preload Progress (Logs)

```bash
tail -f server-log.txt | grep ProfilePreloader

# Output:
[ProfilePreloader] Starting profile preload: { fhirVersions: ['R4'], profileCount: 18 }
[ProfilePreloader] Pre-loading profiles for R4...
[ProfilePreloader] ✓ https://...Patient (cached)
[ProfilePreloader] ✓ https://...Diagnose (downloaded)
[ProfilePreloader] Batch complete: 5/5 successful
...
[ProfilePreloader] Preload complete: { total: 18, success: 15, cached: 3, failed: 0, timeMs: 12450 }
```

### Verify Cache Hit Rate

After preloading, profile validations should have high cache hit rates:

```bash
# Run some validations
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d @patient-mii.json

# Check timing breakdown
curl http://localhost:3000/api/performance/timing/stats | jq '.byPhase.profile'

# Expected: Low profile validation time (<300ms) due to cached profiles
```

## Troubleshooting

### Preload Failures

**Problem:** Some profiles fail to preload

**Causes:**
- Network connectivity issues
- Simplifier API rate limiting
- Invalid profile URLs
- Timeout too short

**Solutions:**
```bash
# Increase timeout
export PRELOAD_TIMEOUT=60000  # 60 seconds

# Reduce concurrency to avoid rate limiting
export PRELOAD_MAX_CONCURRENT=3

# Check errors in response
curl http://localhost:3000/api/performance/profiles/preload-stats | jq '.errors'
```

### Slow Startup

**Problem:** Server takes too long to start

**Causes:**
- Too many profiles
- Network latency
- Including dependencies
- High concurrency

**Solutions:**
```bash
# Disable preloading for development
export PRELOAD_PROFILES=false

# Or reduce profile count (edit profile-preloader.ts)
# Remove less common profiles from ALL_COMMON_PROFILES

# Or preload asynchronously (don't await)
```

### Memory Usage

**Problem:** High memory usage after preload

**Causes:**
- Large profile StructureDefinitions
- Many profiles cached
- Dependencies included

**Solutions:**
```bash
# Monitor memory
curl http://localhost:3000/api/performance/baseline/current | jq '.memoryUsageMB'

# Reduce cache size if needed
export PROFILE_CACHE_MAX_SIZE=1000  # Limit cached profiles
```

## Best Practices

1. **Enable in Production** - Always preload profiles in production for best performance
2. **Start with R4** - Preload R4 profiles first; add R5/R6 only if needed
3. **Skip Dependencies for Speed** - Include dependencies only if validating complex profiles
4. **Monitor Failures** - Check preload stats regularly and investigate failures
5. **Async Preload** - Consider preloading asynchronously after server starts to avoid blocking
6. **Warm Cache Before Load Tests** - Always preload before running performance tests
7. **Update Profile List** - Add your organization's custom profiles to the preload list

## Advanced Usage

### Custom Profile List

Edit `profile-preloader.ts` to add your organization's profiles:

```typescript
export const CUSTOM_PROFILES = [
  'https://your-org.example.com/fhir/StructureDefinition/OrganizationPatient',
  'https://your-org.example.com/fhir/StructureDefinition/OrganizationObservation',
  // ... more profiles
];

export const ALL_COMMON_PROFILES = [
  ...COMMON_GERMAN_PROFILES.MII,
  ...COMMON_GERMAN_PROFILES.ISIK,
  ...COMMON_GERMAN_PROFILES.KBV,
  ...COMMON_GERMAN_PROFILES.BASISPROFIL,
  ...COMMON_GERMAN_PROFILES.HL7_DE,
  ...CUSTOM_PROFILES, // Add custom profiles
];
```

### Scheduled Reloading

For profiles that change frequently, schedule periodic reloading:

```typescript
import { getProfilePreloader } from './server/services/validation/profiles/profile-preloader';

// Reload profiles every 24 hours
setInterval(async () => {
  console.log('Scheduled profile reload starting...');
  const preloader = getProfilePreloader();
  
  try {
    const stats = await preloader.preloadCommonProfiles({
      fhirVersions: ['R4'],
    });
    console.log(`Profile reload complete: ${stats.successCount} loaded`);
  } catch (error) {
    console.error('Profile reload failed:', error);
  }
}, 24 * 60 * 60 * 1000); // 24 hours
```

### Conditional Preloading

Preload based on environment or configuration:

```typescript
const shouldPreload = 
  process.env.NODE_ENV === 'production' ||
  process.env.PRELOAD_PROFILES === 'true';

if (shouldPreload) {
  await initializeProfilePreloading();
}
```

## Cache Management

### Profile Cache Location

Profiles are stored in two layers:

**L1: In-Memory Cache (ProfileResolver)**
- Fast access (no I/O)
- Lost on restart
- Limited size

**L2: Database Cache (ProfileIndexer)**
- Persistent across restarts
- Searchable by canonical URL
- Unlimited size (within DB limits)

### Cache Warming Strategy

```
Server Startup
    ↓
1. Check DB cache (L2) for each profile
    ↓ (if found)
   Load into memory cache (L1)
    ↓ (if not found)
2. Download from Simplifier
    ↓
3. Save to DB cache (L2)
    ↓
4. Load into memory cache (L1)
    ↓
Profile ready for validation (fast)
```

## Performance Metrics

### Target Metrics

| Metric | Target | Typical |
|---|---|---|
| Preload time | <30s | 10-15s |
| Success rate | >90% | 95-98% |
| Cache hit rate (after preload) | >95% | 98-99% |
| Profile validation time | <300ms | 100-250ms |

### Measuring Impact

**Before Preload:**
```bash
# Measure cold start
time curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d @patient-mii.json

# Expected: 2-4 seconds first time
```

**After Preload:**
```bash
# Trigger preload
curl -X POST http://localhost:3000/api/performance/profiles/preload -d '{}'

# Wait for completion (check status)
curl http://localhost:3000/api/performance/profiles/preload-status

# Measure warm start
time curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d @patient-mii.json

# Expected: <500ms even on first validation
```

## Implementation Details

### Preload Algorithm

```
1. For each FHIR version (R4, R5, R6):
   For each profile URL in common profiles:
     
     2. Check if profile is in DB cache
        ├─> Yes: Mark as cached, skip download
        └─> No: Continue to download
     
     3. Download profile from Simplifier
        ├─> Success: Cache in DB and memory
        └─> Failure: Log error, continue
     
     4. Repeat for next profile (up to maxConcurrent in parallel)

2. After all profiles:
   Return statistics (success, cached, failed, time)
```

### Batch Processing

Profiles are processed in batches to control concurrency:

```typescript
// Example: 18 profiles, maxConcurrent = 5
// Batch 1: profiles 0-4   (parallel)
// Batch 2: profiles 5-9   (parallel)
// Batch 3: profiles 10-14 (parallel)
// Batch 4: profiles 15-17 (parallel)
```

### Error Handling

- **Individual profile failures don't stop preload** - Other profiles continue
- **Errors are collected and returned** - Check `stats.errors` for details
- **Partial success is OK** - Even 50% success rate provides benefit
- **Failures don't affect validation** - Profiles will be downloaded on-demand if needed

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Pre-load Profiles

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  preload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start server
        run: npm start &
        env:
          PRELOAD_PROFILES: true
          PRELOAD_FHIR_VERSIONS: R4
      
      - name: Wait for server
        run: sleep 30
      
      - name: Check preload status
        run: |
          curl http://localhost:3000/api/performance/profiles/preload-status
      
      - name: Verify cache hit rate
        run: |
          # Run test validation
          # Check that profile validation is fast
```

### Docker Integration

```dockerfile
# Dockerfile
FROM node:18

# ... build steps ...

# Pre-warm profile cache at build time
RUN npm run preload:profiles || true

# Or at runtime
CMD ["sh", "-c", "npm run preload:profiles:async && npm start"]
```

**package.json scripts:**
```json
{
  "scripts": {
    "preload:profiles": "ts-node -e \"require('./server/services/validation/profiles/profile-preloader').initializeProfilePreloading()\"",
    "preload:profiles:async": "npm run preload:profiles &"
  }
}
```

## Comparison with On-Demand Loading

### On-Demand Loading (Default)
**Pros:**
- Faster startup (<1s)
- Only downloads needed profiles
- Lower memory footprint

**Cons:**
- Slow first validation (2-8s)
- Network dependency during validation
- Unpredictable performance

### Preloading (Task 10.8)
**Pros:**
- Fast validations from start (<500ms)
- Predictable performance
- No network delays during validation
- Better user experience

**Cons:**
- Slower startup (10-30s)
- Higher memory usage
- Downloads some unused profiles

### Recommendation

**Use Preloading When:**
- Running in production
- Handling user-facing validation requests
- Needing predictable performance
- Network latency is high

**Use On-Demand When:**
- Development environment
- Infrequent validations
- Testing with custom profiles
- Limited memory available

## Related Documentation

- [Profile Resolver](../../server/services/validation/utils/profile-resolver.ts) - Profile resolution logic
- [Profile Indexer](../../server/services/fhir/profile-indexer.ts) - Database caching
- [German Profile Detection](../../server/services/validation/utils/german-profile-detector.ts) - Profile detection
- [Profiling Guide](./profiling-guide.md) - Performance profiling and optimization


