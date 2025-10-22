# Profile Validation Timeout Fix

## Issue Summary

**Error:** "socket hang up" during profile validation  
**Aspect:** `profile`  
**Status:** `processing`  
**Root Cause:** Hardcoded 60-second timeout in ProfileValidator conflicting with centralized 150-second HAPI timeout configuration

## Problem Details

### What Was Happening

When validating FHIR resources against complex profiles (especially German profiles like KBV, MII, ISiK), the validation would fail with a "socket hang up" error after 60 seconds, even though:

1. The centralized timeout configuration allows **150 seconds** (2.5 min) for HAPI validation
2. The validation engine allows **180 seconds** (3 min) for profile validation
3. The client allows **240 seconds** (4 min) total

### Root Cause

In `server/services/validation/engine/profile-validator.ts` line 345, there was a hardcoded timeout:

```typescript
timeout: 60000, // 60 seconds for profile validation
```

This 60-second timeout was being passed to the HAPI validator, overriding the centralized configuration of 150 seconds. When profile validation took longer than 60 seconds (common for:
- First-time profile downloads
- Complex German profiles with many dependencies
- Slow network connections
- Resources with many extensions), the connection would be terminated prematurely.

## The Fix

### Changes Made

1. **Updated `profile-validator.ts`** to use centralized timeout configuration:
   - Import `getHapiTimeout()` from centralized config
   - Replace hardcoded 60-second timeout with `getHapiTimeout()` (150 seconds)
   - Added logging to show configured timeout value

```typescript
// Before:
timeout: 60000, // 60 seconds for profile validation (HAPI can be slow with profile loading)

// After:
const hapiTimeout = getHapiTimeout(); // 150 seconds from centralized config
console.log(`[ProfileValidator] Using HAPI timeout from config: ${hapiTimeout}ms`);
timeout: hapiTimeout, // Use centralized timeout (default: 150s) for complex profile validation
```

### Current Timeout Configuration

The centralized timeout configuration follows a cascade pattern to ensure proper timeout hierarchy:

```
Client HTTP: 240s (4 min)
    ↓
Profile Validation Engine: 180s (3 min)
    ↓
HAPI Process: 150s (2.5 min)
    ↓
Profile Resolution: 60s (1 min)
```

This ensures:
- Client waits for server to complete
- Server has time for validation
- HAPI has time to download and process profiles
- Profile downloads complete before validation starts

### Configuration File

All timeout values are defined in: `server/config/validation-timeouts.ts`

**Default Values:**
```typescript
{
  clientHttp: 240000,           // 4 minutes - client HTTP requests
  validationEngine: {
    structural: 20000,          // 20s - basic FHIR structure
    profile: 180000,            // 3 min - profile conformance (MAIN FIX)
    terminology: 30000,         // 30s - code validation
    reference: 15000,           // 15s - reference resolution
    businessRule: 15000,        // 15s - custom business rules
    metadata: 5000,             // 5s - metadata validation
  },
  hapiProcess: 150000,          // 2.5 min - HAPI Java process
  profileResolution: 60000,     // 1 min - profile download
  terminologyLookup: 10000,     // 10s - single terminology call
  referenceCheck: 5000,         // 5s - single reference check
}
```

## Customizing Timeouts

If you still encounter timeout issues, you can adjust timeouts using environment variables:

### Environment Variables

```bash
# Client-side timeout (should be longest)
VALIDATION_TIMEOUT_CLIENT=300000          # 5 minutes

# Profile validation timeout (main one for your issue)
VALIDATION_TIMEOUT_PROFILE=240000         # 4 minutes

# HAPI process timeout (must be less than profile timeout)
VALIDATION_TIMEOUT_HAPI=180000            # 3 minutes

# Profile resolution/download timeout
VALIDATION_TIMEOUT_PROFILE_RESOLUTION=90000  # 90 seconds
```

### Timeout Cascade Rules

When setting custom timeouts, **maintain the cascade**:

```
clientHttp > profile > hapiProcess > profileResolution
```

Example safe configuration:
```bash
VALIDATION_TIMEOUT_CLIENT=360000           # 6 min
VALIDATION_TIMEOUT_PROFILE=300000          # 5 min
VALIDATION_TIMEOUT_HAPI=240000             # 4 min
VALIDATION_TIMEOUT_PROFILE_RESOLUTION=120000  # 2 min
```

### Validation Check

The system automatically validates the timeout cascade on startup and will:
- Log warnings if timeouts are too short
- Fall back to defaults if cascade is invalid
- Show timeout configuration in console logs

## Expected Behavior After Fix

### Before Fix (60s timeout)
```
[ProfileValidator] Validating Patient resource...
[ProfileValidator] Using HAPI validator...
[30s] Downloading profile dependencies...
[60s] ❌ ERROR: socket hang up
Status: processing
```

### After Fix (150s timeout)
```
[ProfileValidator] Validating Patient resource...
[ProfileValidator] Using HAPI timeout from config: 150000ms (150.0s)
[ProfileValidator] Using HAPI validator...
[30s] Downloading profile dependencies...
[90s] Loading IG packages...
[120s] ✓ Validation complete: 3 profile issues found
Status: completed
```

## Testing the Fix

1. **Start the server** and check logs for timeout configuration:
   ```
   ⏱️  Validation Timeout Configuration:
      Client HTTP: 240000ms (240.0s)
      Validation Engine:
        - Profile: 180000ms
      HAPI Process: 150000ms (150.0s)
      Profile Resolution: 60000ms (60.0s)
      ✅ Timeout cascade is correctly configured
   ```

2. **Validate a complex German profile** (e.g., MII Patient):
   - Should complete without "socket hang up" errors
   - May take 60-120 seconds for first-time validation
   - Subsequent validations should be faster (cached profiles)

3. **Monitor logs** for timeout messages:
   ```
   [ProfileValidator] Using HAPI timeout from config: 150000ms (150.0s)
   ```

## Related Issues

This fix addresses:
- ✅ "socket hang up" errors during profile validation
- ✅ Premature timeout for complex German profiles (KBV, MII, ISiK)
- ✅ First-time profile validation failures
- ✅ Timeout inconsistency between configuration and implementation

## Additional Notes

### Why 150 Seconds?

The 150-second HAPI timeout is optimized for:
- **German FHIR profiles**: KBV, MII, ISiK profiles have many dependencies
- **First-time downloads**: Initial profile resolution can take 30-60 seconds
- **Slow networks**: Accommodates slower internet connections
- **Complex resources**: Resources with many extensions need more time
- **Terminology lookups**: Some profiles require multiple terminology server calls

### Performance Tips

1. **Pre-warm HAPI cache**: Run validation on sample resources during startup
2. **Use local profile cache**: Enable `offlineConfig.profileCachePath` in settings
3. **Monitor timeout logs**: Check if validations consistently approach timeout limits
4. **Adjust per environment**: Production may need longer timeouts than development

### Future Improvements

Consider:
- Per-profile timeout overrides for known slow profiles
- Adaptive timeouts based on profile complexity
- Progress indicators for long-running validations
- Background profile pre-caching

## Summary

**Before:** 60-second hardcoded timeout → "socket hang up" errors  
**After:** 150-second centralized timeout → successful validation  
**Impact:** Profile validation now has 2.5x more time to complete  
**Configuration:** Easily adjustable via environment variables  
**Testing:** Validated with complex German profiles (KBV, MII)

---

**Date Fixed:** October 22, 2025  
**Files Modified:** 
- `server/services/validation/engine/profile-validator.ts`
- Added import for `getHapiTimeout()`
- Replaced hardcoded 60000 with `getHapiTimeout()`

**Configuration File:** `server/config/validation-timeouts.ts`

