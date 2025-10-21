# Resource Detail 500 Error Fix - Implementation Summary

## Problem

Intermittent 500 Internal Server Error when opening resource details on HAPI FHIR server. Pattern observed:
- First attempt: 500 error
- Second attempt: 500 error (sometimes)
- Third attempt: Success (often)
- Success rate: ~60-70% eventually succeed after 1-2 retries

## Root Cause Hypotheses

1. **Race condition in database operations** - Multiple simultaneous requests trying to create the same resource entry
2. **Database timeout/deadlock** - Slow queries causing timeouts
3. **Validation summary query failures** - getResourceValidationSummary() timing out
4. **FHIR server connectivity issues** - Intermittent timeouts from HAPI

## Changes Made

### 1. Enhanced `enhanceResourcesWithValidationData()` Function

**Location**: `server/routes/api/fhir/fhir.ts` lines 62-185

**Improvements**:
- ✅ **Comprehensive error handling** around every database operation
- ✅ **Race condition protection** - Double-check before insert to prevent duplicates
- ✅ **Duplicate key handling** - Gracefully handle `23505` (duplicate key) errors
- ✅ **Detailed timing logs** - Track duration of each operation
- ✅ **Granular try-catch blocks** - Isolate failures to specific operations
- ✅ **Continue on failure** - Never crash the entire request due to one failure

**Key Changes**:
```typescript
// Before: Single try-catch with generic error handling
// After: Individual try-catch for:
- Active server lookup
- Database resource lookup
- Resource creation (with duplicate check)
- Validation summary fetch
```

**Duplicate Key Protection**:
```typescript
// Check before insert to catch race conditions
dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);

if (!dbResource) {
  dbResource = await storage.createFhirResource(resourceData);
}

// If duplicate key error (23505), refetch the existing record
if (createError.code === '23505') {
  dbResource = await storage.getFhirResourceByTypeAndId(resource.resourceType, resource.id);
}
```

### 2. Enhanced Resource Detail Endpoint

**Location**: `server/routes/api/fhir/fhir.ts` lines 1834-1974

**Improvements**:
- ✅ **Request tracking** - Unique request ID for correlating logs
- ✅ **Detailed timing** - Separate timings for fetch and enhance phases
- ✅ **Comprehensive error logging** - Log error message, code, statusCode, and stack trace
- ✅ **Better error responses** - Include request ID and duration in error responses
- ✅ **Proper 404 handling** - Detect and handle 404 errors appropriately

**Log Format**:
```
[FHIR API] [Patient/12345] Resource detail request started
[FHIR API] [Patient/12345] Fetching from FHIR server...
[FHIR API] [Patient/12345] FHIR fetch successful (120ms)
[FHIR API] [Patient/12345] Enhancing with validation data...
[FHIR API] DB lookup for Patient/12345: Found (ID: 456) (25ms)
[FHIR API] Validation summary for Patient/12345: 1 errors, 2 warnings (30ms)
[FHIR API] Enhanced 1 resources in 55ms
[FHIR API] [Patient/12345] Request completed successfully (fetch: 120ms, enhance: 55ms, total: 175ms)
```

## What to Look For in Logs

When a 500 error occurs, the logs will now show:

### 1. Which Operation Failed

Look for error logs with duration and specific operation:
```
[FHIR API] DB lookup failed for Patient/12345: {error: "...", code: "...", duration: 5000ms}
[FHIR API] Failed to create DB entry for Patient/12345: {error: "...", code: "23505", ...}
[FHIR API] Failed to get validation summary for Patient/12345: {error: "...", duration: 3000ms}
```

### 2. Timing Issues

If operations are taking > 1000ms:
```
[FHIR API] [Patient/12345] FHIR fetch successful (5000ms)  <-- SLOW
[FHIR API] DB lookup for Patient/12345: Found (ID: 456) (3000ms)  <-- SLOW
```

### 3. Race Conditions

Look for duplicate key messages:
```
[FHIR API] Duplicate key for Patient/12345, attempting to fetch existing (50ms)
[FHIR API] Patient/12345 created by concurrent request, using existing (60ms)
```

### 4. Unhandled Errors

The final catch block will show the full error:
```
[FHIR API] [Patient/12345] Unhandled error (5000ms): {
  message: "...",
  code: "...",
  statusCode: 500,
  name: "Error",
  stack: "..."
}
```

## Testing Instructions

1. **Start the server** and watch the console logs
2. **Navigate to resource list** and click multiple resources quickly
3. **Observe the logs** for each request with `[FHIR API] [ResourceType/ID]` prefix
4. **When a 500 error occurs**, check the logs for:
   - Which operation failed (FHIR fetch, DB lookup, DB create, validation summary)
   - How long each operation took
   - Any error codes (especially 23505 for duplicates)
   - Full error message and stack trace

## Expected Improvements

### Before
```
[FHIR API] Error fetching individual resource: [Generic error]
```

### After
```
[FHIR API] [Patient/46532226] Resource detail request started
[FHIR API] [Patient/46532226] Fetching from FHIR server...
[FHIR API] [Patient/46532226] FHIR fetch successful (150ms)
[FHIR API] [Patient/46532226] Enhancing with validation data...
[FHIR API] DB lookup for Patient/46532226: Not found (20ms)
[FHIR API] Duplicate key for Patient/46532226, attempting to fetch existing (30ms)
[FHIR API] DB lookup for Patient/46532226: Found (ID: 12345) (15ms)
[FHIR API] Validation summary for Patient/46532226: 0 errors, 2 warnings (40ms)
[FHIR API] Enhanced 1 resources in 105ms
[FHIR API] [Patient/46532226] Request completed successfully (fetch: 150ms, enhance: 105ms, total: 255ms)
```

## Next Steps

1. **Monitor logs** during normal usage to identify the specific failure point
2. **If duplicate keys are common**: Add database constraint or unique index on (server_id, resource_type, resource_id)
3. **If timeouts are common**: Add connection pool tuning or query optimization
4. **If validation summary is slow**: Add caching or optimize the query
5. **If FHIR fetch is slow**: Add timeout configuration or investigate HAPI server performance

### 3. Improved Client-Side Error Handling

**Location**: `client/src/pages/resource-detail.tsx` lines 297-339

**Improvements**:
- ✅ **Better retry logic** - Retry up to 3 times on 500 errors (was only 1)
- ✅ **Exponential backoff** - 300ms, 600ms, 1200ms delays between retries
- ✅ **Smart retry decision** - Don't retry on 404/403 errors
- ✅ **Detailed error parsing** - Extract error details from server response
- ✅ **Error metadata** - Include status code and details in error object

**Retry Configuration**:
```typescript
retry: (failureCount, error: any) => {
  // Don't retry on 404 (not found) or 403 (forbidden)
  if (error?.status === 404 || error?.status === 403) {
    return false;
  }
  // Retry up to 3 times on 500 errors
  return failureCount < 3;
},
retryDelay: (attemptIndex) => {
  // Exponential backoff: 300ms, 600ms, 1200ms
  return Math.min(300 * Math.pow(2, attemptIndex), 3000);
}
```

### 4. Enhanced Error Display Component

**Location**: `client/src/components/resources/ResourceDetailStates.tsx` lines 99-181

**Improvements**:
- ✅ **Better 500 error detection** - Check status code, not just message
- ✅ **Helpful retry message** - Inform user about automatic retries
- ✅ **Request ID display** - Show request ID from server for debugging
- ✅ **Duration display** - Show how long the request took
- ✅ **Better user guidance** - Suggest checking server logs for persistent errors

**Error Display Features**:
```tsx
{isServerError && (
  <p className="text-sm text-gray-600">
    The system automatically retried this request. If the error persists, 
    please check the server logs for detailed error information.
  </p>
)}
{errorDetails?.requestId && (
  <p className="text-xs text-gray-500 font-mono">
    Request ID: {errorDetails.requestId}
  </p>
)}
```

## Rollback Plan

If the changes cause issues, the fix can be rolled back by reverting:

**Server-side**:
- Lines 62-185: `enhanceResourcesWithValidationData()` function
- Lines 1834-1974: Resource detail endpoint

**Client-side**:
- Lines 297-339 in `resource-detail.tsx`: useQuery configuration
- Lines 99-181 in `ResourceDetailStates.tsx`: Error display component

The changes are backward-compatible and don't modify the database schema or API contract.

## Summary of Protection Added

1. **Race Condition Protection**: Double-check before insert, handle duplicate key errors
2. **Comprehensive Error Logging**: Every operation has detailed error logging with timing
3. **Graceful Degradation**: Continue serving resources even if validation data fails
4. **Client Retry Logic**: Automatically retry 500 errors up to 3 times with exponential backoff
5. **Better User Feedback**: Show request ID and duration, inform about automatic retries

