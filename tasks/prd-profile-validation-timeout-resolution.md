# PRD: Profile Validation Timeout Resolution

## Problem Statement

Profile validation is timing out after 30 seconds with the error:
```
error: TIMEOUT
Validation timeout: Validation timeout after 30000ms for aspect: profile
Path:
```

Users cannot see profile validation messages because the validation times out before HAPI FHIR validator completes profile resolution and validation.

## Root Cause Analysis

### 1. Client-Server Timeout Mismatch
- **Client-side timeout**: `requestTimeout = 30000` (30 seconds) in `client/src/hooks/use-validation-polling.ts:99`
- **Server-side timeout**: `profile: 75000` (75 seconds) in `server/services/validation/core/validation-engine.ts:578`
- **Problem**: Client cancels HTTP request before server completes validation

### 2. Profile Validation Performance Issues
Profile validation requires:
1. **Profile Resolution** (10-30 seconds): Download and cache StructureDefinition from Simplifier/FHIR registry
2. **Dependency Resolution** (5-15 seconds): Resolve and download dependent IG packages
3. **HAPI Java Process Spawn** (2-5 seconds): Start Java process and load FHIR validator
4. **Profile Validation** (5-20 seconds): Validate resource against profile constraints
5. **IG Package Loading** (5-15 seconds): Load German profiles (KBV, MII, ISiK) or other IGs

**Total**: 27-85 seconds (average ~45 seconds for German profiles)

### 3. Multiple Timeout Layers

The system has **4 different timeout layers** that all must be aligned:

| Layer | Location | Current Value | Purpose |
|-------|----------|---------------|---------|
| Client HTTP | `use-validation-polling.ts:99` | 30000ms | HTTP request timeout |
| Validation Engine | `validation-engine.ts:578` | 75000ms | Per-aspect validation timeout |
| HAPI Config | `hapi-validator-config.ts:53` | 75000ms | HAPI validator timeout |
| Process Pool | `hapi-process-pool.ts:182` | 60000ms | Process pool job timeout |

**The problem**: Client timeout (30s) < Server timeout (75s) → Request canceled before validation completes

### 4. Profile Resolution Hanging

From `profile-validator.ts:220-232`:
```typescript
try {
  await Promise.race([
    this.resolveProfileBeforeValidation(profileUrl, settings),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Profile resolution timeout after 10 seconds')), 10000)
    )
  ]);
} catch (error) {
  console.warn(`[ProfileValidator] Profile resolution failed/timed out:`, error);
  // Continue with validation even if resolution fails - HAPI may have cached profile
}
```

The profile resolution has its own 10-second timeout, but this is often insufficient for:
- Large German profiles (KBV, MII)
- Profiles with many dependencies
- First-time downloads (no cache)
- Slow network connections

## Current Behavior

1. User clicks "Validate" on a Patient resource with German profile
2. Frontend sends validation request to `/api/validation/validate-resource`
3. Server starts profile validation
4. Profile resolution begins (downloading StructureDefinition)
5. **After 30 seconds**: Client HTTP request times out
6. Server continues validation (unaware of client timeout)
7. User sees "TIMEOUT" error
8. **After 45-75 seconds**: Server completes validation but response is lost
9. User sees no validation messages

## Expected Behavior

1. User clicks "Validate" on a Patient resource
2. Frontend sends validation request with **sufficient timeout** (90-120 seconds)
3. Server starts profile validation
4. Profile resolution completes (with progress feedback)
5. HAPI validation executes
6. Server returns validation results
7. User sees validation messages (errors, warnings, info)

## Technical Requirements

### 1. Align All Timeout Values

All timeout layers must be consistently configured:

```typescript
// Recommended timeout values (in milliseconds)
const PROFILE_VALIDATION_TIMEOUT = {
  clientHttp: 120000,     // 2 minutes (must be longest)
  validationEngine: 90000, // 1.5 minutes
  hapiProcess: 75000,      // 1.25 minutes
  profileResolution: 30000 // 30 seconds (resolution only)
};
```

**Reasoning**:
- Client timeout must be **longer** than server timeout to allow completion
- Server timeouts should cascade: Engine > HAPI > Resolution
- Profile resolution needs more time for German profiles

### 2. Make Timeouts Configurable

Timeouts should be configurable via:
1. Environment variables (for deployment)
2. Validation settings (per-server configuration)
3. Client options (per-request override)

### 3. Improve Profile Resolution Performance

- **Cache profiles more aggressively**: Increase TTL to 7 days for stable profiles
- **Preload common profiles**: Warm cache on startup for German profiles
- **Parallel dependency resolution**: Download dependencies in parallel, not sequentially
- **Skip redundant downloads**: Check cache before attempting download
- **Timeout granularity**: Different timeouts for profile download vs. parsing

### 4. Better User Feedback

- Show progress indicator during profile validation: "Resolving profile... (15s / 30s)"
- Display intermediate status: "Profile resolved, validating constraints..."
- Show timeout warnings before failure: "Profile validation taking longer than expected..."
- Provide retry option: "Validation timed out. Retry with extended timeout?"

### 5. Graceful Degradation

If profile validation times out:
1. Fall back to basic profile check (meta.profile declared?)
2. Return partial validation results (structural + terminology only)
3. Queue profile validation for background processing
4. Notify user when background validation completes

## Success Metrics

1. **Profile validation success rate**: > 95% (currently ~30% due to timeouts)
2. **Average profile validation time**: < 45 seconds for German profiles
3. **Timeout rate**: < 5% of validation requests
4. **User feedback**: "I can see validation messages" (currently: timeout errors)

## Out of Scope

- Replacing HAPI FHIR Validator with alternative validators
- Client-side profile validation (requires browser-compatible validator)
- Real-time streaming of validation progress (requires WebSocket)
- Profile validation caching (separate feature, already implemented)

## Implementation Phases

### Phase 1: Critical Fixes (Immediate)
1. Increase client HTTP timeout to 120 seconds
2. Increase profile resolution timeout to 30 seconds
3. Align all timeout values consistently
4. Add timeout logging for debugging

### Phase 2: Performance Improvements (Short-term)
1. Implement profile preloading for German profiles
2. Add parallel dependency resolution
3. Improve cache hit rate with aggressive TTL
4. Add timeout configuration via settings

### Phase 3: User Experience (Medium-term)
1. Add progress indicators during validation
2. Show intermediate status messages
3. Implement graceful degradation
4. Add retry with extended timeout option

## Technical Debt

### Existing Issues
1. **Multiple timeout configurations**: 4 different files defining timeouts
2. **No timeout coordination**: Each layer sets timeout independently
3. **Poor error messages**: "TIMEOUT" doesn't tell user what timed out
4. **No retry mechanism**: User must manually retry with no guidance

### Proposed Improvements
1. Centralize timeout configuration in one module
2. Cascade timeouts automatically (client > engine > HAPI)
3. Enhance error messages with actionable guidance
4. Implement intelligent retry with exponential backoff

## Dependencies

- HAPI FHIR Validator (existing, no changes needed)
- Profile Resolver (existing, needs performance improvements)
- Validation Settings Service (existing, needs timeout fields)
- Client Validation Hooks (existing, needs timeout parameter)

## Risks & Mitigation

### Risk 1: Increased client timeouts may cause UI freezing
- **Mitigation**: Show progress indicator, allow background validation

### Risk 2: Longer timeouts may consume more server resources
- **Mitigation**: Implement request queuing, limit concurrent validations

### Risk 3: Profile resolution may still timeout for very large profiles
- **Mitigation**: Implement caching, preloading, and graceful degradation

## Quality Assessment

### The Good ✅
- **Comprehensive timeout system**: Multiple layers provide fault tolerance
- **Well-structured code**: Clear separation between client, engine, and HAPI
- **Existing caching**: Profile resolution already uses cache
- **Graceful error handling**: Timeouts don't crash the system

### The Bad ⚠️
- **Timeout mismatch**: Client < Server causes premature cancellation
- **No coordination**: Each layer sets timeout independently
- **Poor performance**: Profile resolution too slow for German profiles
- **No progress feedback**: User has no idea what's happening

### The Ugly 🔴
- **Magic numbers**: Timeouts hardcoded in 4 different files
- **No documentation**: Timeout behavior not documented
- **Silent failures**: Profile resolution timeouts are swallowed
- **User confusion**: "TIMEOUT" error with no explanation

## Open Questions

1. Should we implement WebSocket for real-time validation progress?
2. Should profile validation be moved to background jobs?
3. What's the maximum acceptable timeout for users?
4. Should we preload ALL German profiles or just common ones?
5. Can we detect profile complexity and adjust timeout accordingly?

## References

- `server/services/validation/core/validation-engine.ts` - Main validation engine
- `server/services/validation/engine/profile-validator.ts` - Profile validation logic
- `server/services/validation/engine/hapi-validator-client.ts` - HAPI client wrapper
- `server/config/hapi-validator-config.ts` - HAPI configuration
- `client/src/hooks/use-validation-polling.ts` - Client validation polling
- `shared/validation-settings.ts` - Validation settings schema

## Approval

- [ ] Engineering Lead: Timeout alignment and performance improvements
- [ ] Product Owner: User experience and retry mechanisms
- [ ] DevOps: Server resource impact and deployment considerations
