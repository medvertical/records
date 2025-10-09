# HAPI Validator Enhancements Summary

**Tasks:** 1.9-1.11 - Retry Logic and Error Handling  
**Date:** October 9, 2025  
**Status:** ✅ ALL COMPLETE

---

## Executive Summary

Enhanced the HAPI FHIR Validator client with production-grade retry logic, timeout handling, and comprehensive error classification. These improvements make the validator more resilient to transient failures while providing clear, actionable error messages to users.

---

## Task 1.9: Version-Specific Core Package Loading ✅

**Status:** Already implemented

### What Was Already There

The version-specific core package loading was already implemented in the initial HAPI validator client:

**File:** `server/config/hapi-validator-config.ts`
```typescript
export const FHIR_VERSION_IG_MAP = {
  R4: {
    version: '4.0',
    corePackage: 'hl7.fhir.r4.core@4.0.1',
  },
  R5: {
    version: '5.0',
    corePackage: 'hl7.fhir.r5.core@5.0.0',
  },
  R6: {
    version: '6.0',
    corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2',
  },
} as const;
```

**Usage:** `hapi-validator-client.ts`
```typescript
private buildValidatorArgs(tempFilePath: string, options: HapiValidationOptions): string[] {
  const versionInfo = FHIR_VERSION_IG_MAP[options.fhirVersion];
  // ...
  args.push('-ig', versionInfo.corePackage); // ← Version-specific package
  // ...
}
```

### Verification

- ✅ R4 validation loads `hl7.fhir.r4.core@4.0.1`
- ✅ R5 validation loads `hl7.fhir.r5.core@5.0.0`
- ✅ R6 validation loads `hl7.fhir.r6.core@6.0.0-ballot2`

---

## Task 1.10: Retry Logic and Timeout Handling ✅

### Created: `retry-helper.ts` Utility (245 lines)

**File:** `server/services/validation/utils/retry-helper.ts`

### Features

1. **Exponential Backoff**
   ```typescript
   delay = initialDelay * (backoffMultiplier ^ (attempt - 1))
   ```
   - Initial delay: 1000ms (1 second)
   - Backoff multiplier: 2x
   - Maximum delay: 10000ms (10 seconds)

2. **Jitter**
   - Adds ±20% random variation to delays
   - Prevents thundering herd problem
   - Distributes retry attempts over time

3. **Configurable Retry Attempts**
   ```typescript
   interface RetryConfig {
     maxAttempts?: number;        // default: 3
     initialDelay?: number;        // default: 1000ms
     maxDelay?: number;            // default: 10000ms
     backoffMultiplier?: number;   // default: 2
     useJitter?: boolean;          // default: true
     timeout?: number;             // default: 30000ms
     isRetryable?: (error: Error) => boolean;
   }
   ```

4. **Smart Error Classification**
   ```typescript
   // Retryable errors
   - isTimeoutError()     // Timeout errors
   - isNetworkError()     // Network errors (ECONNREFUSED, ENOTFOUND, etc.)
   
   // Non-retryable errors
   - isNonRetryableHapiError()  // Validation failures, parse errors
   ```

5. **Comprehensive Result Metadata**
   ```typescript
   interface RetryResult<T> {
     result: T;
     attempts: number;      // How many attempts were made
     totalTime: number;     // Total time including retries
     hadRetries: boolean;   // Whether any retries were needed
   }
   ```

### Integration in HapiValidatorClient

**Before:**
```typescript
// Direct execution, no retries
const { stdout, stderr } = await this.executeValidator(args, options.timeout);
```

**After:**
```typescript
// Wrapped in retry logic
const result = await withRetry(
  async () => {
    // ... validation logic ...
    return mapOperationOutcomeToIssues(operationOutcome, options.fhirVersion);
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    timeout: options.timeout || this.config.timeout,
    isRetryable: (error) => {
      // Don't retry validation failures
      if (isNonRetryableHapiError(error)) return false;
      // Retry network/timeout errors
      return isRetryableError(error);
    },
  }
);
```

### Retry Scenarios

| Scenario | Attempt 1 | Delay | Attempt 2 | Delay | Attempt 3 | Result |
|----------|-----------|-------|-----------|-------|-----------|--------|
| **Network timeout** | Fail (timeout) | ~1s | Fail (timeout) | ~2s | Success | ✅ Retried successfully |
| **Validation error** | Fail (invalid) | - | - | - | - | ❌ Failed immediately (non-retryable) |
| **Transient network** | Fail (ECONNREFUSED) | ~1s | Success | - | - | ✅ Recovered |
| **Persistent failure** | Fail (timeout) | ~1s | Fail (timeout) | ~2s | Fail (timeout) | ❌ All attempts exhausted |

### Performance Impact

- **Success on first attempt:** No overhead (0ms added)
- **Success on second attempt:** ~1s delay added
- **Success on third attempt:** ~3s total delay added
- **All attempts fail:** ~3s total delay before final error

---

## Task 1.11: Comprehensive Error Handling ✅

### Enhanced `handleValidationError()` Method

**Before:** 3 error types handled
```typescript
- Java not found
- Timeout
- Generic unknown error
```

**After:** 8 error types with actionable solutions
```typescript
1. Java Runtime not found
2. Timeout errors
3. JAR not found
4. Network errors
5. Memory errors
6. Parse errors
7. Retry errors
8. Unknown errors (fallback)
```

### Error Classifications

#### 1. Java Runtime Not Found
**Detection:**
```typescript
message.includes('ENOENT') || message.includes('spawn java')
```

**User Message:**
```
Java Runtime not found. HAPI validator requires Java 11+.

Installation:
  macOS:   brew install openjdk@11
  Ubuntu:  sudo apt-get install openjdk-11-jre
  Windows: Download from https://www.oracle.com/java/technologies/downloads/

Original error: [error message]
```

#### 2. Timeout Errors
**Detection:**
```typescript
message.includes('timed out') || message.includes('timeout')
```

**User Message:**
```
HAPI validation timed out.

Possible solutions:
  1. Increase timeout: Set HAPI_TIMEOUT environment variable (default: 30000ms)
  2. Simplify resource: Remove unnecessary extensions or contained resources
  3. Check network: Ensure terminology server is accessible

Original error: [error message]
```

#### 3. JAR Not Found
**Detection:**
```typescript
message.includes('validator_cli.jar') || message.includes('JAR not found')
```

**User Message:**
```
HAPI validator JAR not found.

Setup:
  Run: bash scripts/setup-hapi-validator.sh
  Or download manually from: https://github.com/hapifhir/org.hl7.fhir.core/releases

Original error: [error message]
```

#### 4. Network Errors
**Detection:**
```typescript
message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')
```

**User Message:**
```
Network error: Cannot connect to terminology server.

Possible solutions:
  1. Check internet connection
  2. Verify terminology server URL in configuration
  3. Try offline mode with local Ontoserver

Original error: [error message]
```

#### 5. Memory Errors
**Detection:**
```typescript
message.includes('OutOfMemoryError') || message.includes('heap space')
```

**User Message:**
```
Java heap space error: HAPI validator ran out of memory.

Solutions:
  1. Set JAVA_OPTS="-Xmx2G" to increase heap size
  2. Validate smaller resources or batches
  3. Restart the validator process

Original error: [error message]
```

#### 6. Parse Errors (Non-Retryable)
**Detection:**
```typescript
message.includes('parse') || message.includes('invalid JSON')
```

**User Message:**
```
Invalid FHIR resource format.

The resource JSON could not be parsed by HAPI validator.
Please check:
  1. Resource is valid JSON
  2. Resource type is correct
  3. Required fields are present

Original error: [error message]
```

#### 7. Retry Errors
**Detection:**
```typescript
error.name === 'RetryError'
```

**User Message:**
```
HAPI validation failed after [N] attempts.

Last error: [error message]

This may indicate:
  1. Persistent network issues
  2. HAPI validator is unavailable
  3. Resource is too complex to validate

Consider using fallback validation or checking system status.
```

#### 8. Unknown Errors (Fallback)
**Handling:**
```typescript
// Return original error if no specific handling
return error;
```

---

## Benefits

### 1. Resilience
- **Transient failures automatically recovered**
- Network hiccups don't fail validation
- Temporary timeout issues are retried

### 2. User Experience
- Clear, actionable error messages
- Specific solutions for each error type
- No technical jargon in user-facing messages

### 3. Performance
- Smart retry only when beneficial
- Validation errors fail fast (no retry)
- Jitter prevents thundering herd

### 4. Debugging
- Detailed error context preserved
- Retry metadata available
- Original error included in all messages

### 5. Production Readiness
- Graceful degradation
- Comprehensive error coverage
- Fallback suggestions

---

## File Changes

### New Files Created

1. **`server/services/validation/utils/retry-helper.ts`** (245 lines)
   - Retry logic with exponential backoff
   - Error classification helpers
   - Configurable retry strategy

### Modified Files

2. **`server/services/validation/engine/hapi-validator-client.ts`** (457 lines)
   - Integrated retry logic (Task 1.10)
   - Enhanced error handling (Task 1.11)
   - Still under 500-line maximum ✅

---

## Testing Recommendations

### Unit Tests (Task 1.12)

```typescript
describe('RetryHelper', () => {
  it('should retry on timeout errors');
  it('should not retry on validation errors');
  it('should apply exponential backoff');
  it('should add jitter to delays');
  it('should respect maxAttempts');
});

describe('HapiValidatorClient Error Handling', () => {
  it('should provide Java install instructions when Java not found');
  it('should suggest timeout increase on timeout');
  it('should suggest setup script when JAR missing');
  it('should suggest offline mode on network errors');
});
```

### Integration Tests (Task 1.13)

```typescript
describe('HAPI Validator with Retry', () => {
  it('should recover from transient network errors');
  it('should fail fast on validation errors');
  it('should complete within timeout with retries');
});
```

---

## Configuration

### Environment Variables

```bash
# Retry Configuration (via code, not env vars)
# These are hardcoded in hapi-validator-client.ts but could be made configurable

# Timeout (already configurable)
HAPI_TIMEOUT=30000

# Java heap size (for memory errors)
JAVA_OPTS="-Xmx2G"
```

### Code Configuration

**In `hapi-validator-client.ts`:**
```typescript
const result = await withRetry(
  async () => { /* ... */ },
  {
    maxAttempts: 3,        // ← Configurable
    initialDelay: 1000,    // ← Configurable
    maxDelay: 10000,       // ← Configurable
    timeout: options.timeout || this.config.timeout,
  }
);
```

---

## Architecture Compliance

### retry-helper.ts
- ✅ File size: 245 lines (under 400)
- ✅ Single Responsibility: Only handles retry logic
- ✅ No linting errors
- ✅ Pure utility functions
- ✅ No external dependencies (except logger)

### hapi-validator-client.ts
- ✅ File size: 457 lines (under 500 max)
- ✅ No linting errors
- ✅ Backward compatible
- ✅ Comprehensive error handling
- ✅ Production-ready resilience

---

## What's Next?

Tasks 1.9-1.11 complete the core HAPI validator enhancements. Next steps:

- **Task 1.12-1.14:** Testing (unit, integration, performance)
- **Task 1.15:** Error mapping expansion (100+ codes)
- **Task 1.16:** Refactor ConsolidatedValidationService (1076 lines)
- **Task 1.17:** End-to-end integration test

---

**Status:** ✅ **TASKS 1.9-1.11 COMPLETE**  
**Files Created:** 1 new file (retry-helper.ts)  
**Files Modified:** 1 file (hapi-validator-client.ts)  
**Total Lines:** 245 + 457 = 702 lines  
**Next Task:** 1.12 - Create unit tests for HAPI validator wrapper

