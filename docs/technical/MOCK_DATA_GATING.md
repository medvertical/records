# Mock Data Gating Documentation

## Overview
This document tracks the status of mock data gating across the codebase to ensure no mock data leaks into production.

## Feature Flag: `DEMO_MOCKS`
- **Location**: `server/config/feature-flags.ts`
- **Default**: `false` (disabled)
- **Purpose**: Gate all mock/demo data behind this flag
- **Production Safety**: Server exits on startup if `DEMO_MOCKS=true` in production

## Gating Status

### ✅ Fully Gated
1. **FHIR Resource Search** (`server/routes/api/fhir/fhir.ts`)
   - Line ~407: `createMockBundle` only called when `FeatureFlags.DEMO_MOCKS === true`
   - Returns 503 Service Unavailable in production

2. **Validation Progress** (`server.ts`)
   - Line ~104: Uses `handleDatabaseUnavailable` helper
   - Returns 503 or mock based on flag

3. **Recent Errors** (`server.ts`)
   - Line ~115: Uses `handleDatabaseUnavailable` helper
   - Returns 503 or mock based on flag

### 🚧 Partially Gated (console.warn only, needs if-check)
The following endpoints have logging updated but still execute mock logic unconditionally:

4. **FHIR Server CRUD** (`server.ts`)
   - Create server: Line ~346
   - Update server: Line ~435
   - Delete server: Line ~506
   - Activate server: Line ~640
   - Deactivate server: Line ~765

5. **Dashboard Endpoints** (`server.ts`)
   - Dashboard stats: Line ~1042
   - FHIR server stats: Line ~1082
   - Validation stats: Line ~1164
   - Combined dashboard: Line ~1311
   - Dashboard cards: Line ~1424

6. **Duplicate Validation Endpoints** (`server.ts`)
   - Validation progress (duplicate): Line ~994
   - Recent errors (duplicate): Line ~1015

### ❌ Not Yet Gated
7. **Mock FHIR Servers Array** (`server.ts` line 43-46)
   - Still contains hardcoded demo servers
   - Should return empty array or 503 when DEMO_MOCKS=false

8. **Mock Validation Progress** (`server.ts` line 48-58)
   - Default progress object exists
   - Should be undefined or minimal when DEMO_MOCKS=false

9. **Mock Recent Errors** (`server.ts` line 60-74)
   - Array of mock errors
   - Should be empty when DEMO_MOCKS=false

## Implementation Pattern

### Recommended Pattern
```typescript
import { FeatureFlags } from './server/config/feature-flags';

app.get('/api/some-endpoint', async (req, res) => {
  try {
    const { storage } = await import('./server/storage.js');
    const data = await storage.getSomeData();
    res.json(data);
  } catch (error) {
    if (FeatureFlags.DEMO_MOCKS) {
      console.warn('[DEMO_MOCKS] Database unavailable, returning mock data');
      res.json(MOCK_DATA);
    } else {
      console.error('Database unavailable:', error.message);
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection is unavailable. Please contact support.',
        timestamp: new Date().toISOString(),
      });
    }
  }
});
```

### Helper Function (already implemented)
```typescript
function handleDatabaseUnavailable<T>(mockData: T, errorMessage: string, res: Response): void {
  if (FeatureFlags.DEMO_MOCKS) {
    console.warn(`[DEMO_MOCKS] ${errorMessage} - returning mock data`);
    res.json(mockData);
  } else {
    console.error(`Database unavailable: ${errorMessage}`);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection is unavailable. Please contact support.',
      timestamp: new Date().toISOString(),
    });
  }
}
```

## Verification

### Manual Check
```bash
# Search for ungated mock responses
grep -r "using mock\|mock data" server/ server.ts \
  --exclude="*.test.ts" \
  --exclude="*.md" | \
  grep -v "FeatureFlags.DEMO_MOCKS"
```

### Automated Check
```bash
# Run the check script
./scripts/check-no-mocks.sh
```

## CI/CD Integration
- **Pre-commit hook**: Warn on new mock data
- **CI pipeline**: Fail build if ungated mocks detected
- **Environment check**: Validate DEMO_MOCKS=false in .env.example

## TODO
- [ ] Gate FHIR server CRUD fallbacks (5 endpoints)
- [ ] Gate dashboard endpoint fallbacks (5 endpoints)
- [ ] Remove duplicate validation endpoints or gate them
- [ ] Make mock data arrays conditional on DEMO_MOCKS
- [ ] Add CI check with `check-no-mocks.sh`
- [ ] Document DEMO_MOCKS in README.md

## Status Summary
- **Total Endpoints**: ~15
- **Fully Gated**: 3 (20%)
- **Partially Gated**: 11 (73%)
- **Not Gated**: 1 (7%)

**Target**: 100% gated before production deployment
