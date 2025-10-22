# HAPI Rate Limiting Fix - Implementation Complete

## Summary

Successfully implemented request queuing, batching, retry logic, and caching to prevent overwhelming the HAPI FHIR server and eliminate zero counts in resource listings.

## Changes Implemented

### 1. Request Queue Service
**File:** `server/services/fhir/request-queue.ts` (NEW)

- Implements a queue with configurable concurrency (default: 8 concurrent requests)
- Request deduplication within a 5-second window
- Priority support for requests
- Queue statistics and monitoring
- Timeout handling (30s per request)

### 2. Retry Handler
**File:** `server/services/fhir/retry-handler.ts` (NEW)

- Exponential backoff retry logic (1s, 2s, 4s delays)
- Retries on 503, 429, 504, timeouts, and network errors
- Max 3 retry attempts per request
- Batch execution helper with retry support
- Intelligent error detection (rate limits, timeouts, network issues)

### 3. FHIR Cache Layer
**File:** `server/services/fhir/fhir-cache.ts` (NEW)

- Per-server cache namespacing
- Configurable TTLs (5 minutes for resource counts, 30 minutes for search parameters)
- Stale-while-revalidate pattern for better UX
- Background revalidation when data is stale
- Cache invalidation by server or key

### 4. FhirClient Enhancements
**File:** `server/services/fhir/fhir-client.ts` (MODIFIED)

**Added:**
- `getResourceCountsBatched()` method - processes resource types in batches of 8 with queue, retry, and caching
- `serverId` field to support per-server caching
- Imports for request queue, retry handler, and cache

**Changes:**
- Added serverId parameter to constructor (default: 1)
- Renamed duplicate `validateResource` to `validateResourceDirect` to avoid conflicts
- Removed old duplicate `getResourceCount` implementation with logger.fhir calls

### 5. Resource Counts Endpoint
**File:** `server/routes/api/fhir/routes/resource-list-routes.ts` (MODIFIED)

**Changes:**
- Replaced parallel `Promise.all` count fetching with batched method
- Now uses `getResourceCountsBatched` with:
  - batchSize: 8
  - batchDelay: 100ms
  - useCache: true
- Returns partial results instead of failing completely
- Proper error handling with fallback behavior

### 6. Client-Side Cache Optimization
**File:** `client/src/hooks/useCapabilitySearchParams.ts` (MODIFIED)

**Changes:**
- Added null check to prevent cache clear on initial load
- Only clears cache when server ID actually changes (not on every render)
- Reduced excessive cache invalidation

**File:** `client/src/hooks/use-server-reactive-queries.ts` (MODIFIED)

**Changes:**
- Changed `refetchType` from 'active' to 'none' to prevent immediate cascading refetches
- Let staleTime and component mounting handle refetching naturally
- Batched all invalidations into single predicate call
- Reduced aggressive query invalidation

### 7. Dashboard Service
**File:** `server/services/dashboard/dashboard-service.ts` (MODIFIED)

**Changes:**
- Simplified `getFhirResourceCounts()` to use new batched method
- Removed complex priority-type logic and manual batching
- Now delegates to `getResourceCountsBatched` with 10-minute cache TTL
- Better error handling with fallback values

## Configuration

### Request Queue
```typescript
{
  maxConcurrent: 8,        // Max 8 concurrent requests to HAPI
  deduplicateWindow: 5000, // 5s deduplication window
  timeout: 30000           // 30s per request
}
```

### Retry Handler
```typescript
{
  maxRetries: 3,
  delays: [1000, 2000, 4000], // Exponential backoff
  retryableStatuses: [429, 503, 504],
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
}
```

### Batch Processing
```typescript
{
  batchSize: 8,           // Process 8 resource types at a time
  batchDelay: 100         // 100ms between batches
}
```

### Cache TTLs
```typescript
{
  RESOURCE_COUNTS: 5 * 60 * 1000,      // 5 minutes
  SEARCH_PARAMETERS: 30 * 60 * 1000,   // 30 minutes
  RESOURCE_TYPES: 30 * 60 * 1000,      // 30 minutes
  CAPABILITY_STATEMENT: 60 * 60 * 1000 // 1 hour
}
```

## Expected Outcomes

### Before Fix
- 100+ parallel requests overwhelming HAPI server
- 503 "Service Unavailable" errors
- Resource counts showing zeros
- Cascading cache clears triggering request storms
- Poor user experience with failed requests

### After Fix
- Maximum 8 concurrent requests to HAPI
- Automatic retry with exponential backoff on failures
- Resource counts show actual values from HAPI
- Reduced server load (8 concurrent vs 100+ concurrent)
- Better reliability with retry logic and caching
- Improved UX with cached values during background refresh
- No more 503 errors from request storms

## How It Works

1. **Request Queuing:** All HAPI requests are queued with max 8 concurrent
2. **Batching:** Resource count requests are processed in batches of 8
3. **Deduplication:** Identical requests within 5s window return same result
4. **Retry Logic:** Failed requests automatically retry (1s, 2s, 4s delays)
5. **Caching:** Results cached for 5-10 minutes with background revalidation
6. **Graceful Degradation:** Partial results on failure, not total failure

## Request Flow

```
Client Request
    ↓
Cache Check (FhirCache)
    ↓ (miss)
Request Queue (RequestQueue)
    ↓
Batch Processor (batchExecuteWithRetry)
    ↓
Individual Request with Retry (withRetry)
    ↓
HAPI Server
    ↓
Response → Cache → Client
```

## Testing Recommendations

1. **Monitor Queue Stats:** Check `getRequestQueue().getStats()` for metrics
2. **Watch Logs:** Look for "[RequestQueue]", "[RetryHandler]", "[FhirCache]" prefixes
3. **Verify No 503s:** Should see retry attempts instead of immediate failures
4. **Check Counts:** Resource counts should show actual values, not zeros
5. **Monitor Performance:** Should see improved response times with caching

## Files Created
- `server/services/fhir/request-queue.ts`
- `server/services/fhir/retry-handler.ts`
- `server/services/fhir/fhir-cache.ts`

## Files Modified
- `server/services/fhir/fhir-client.ts`
- `server/routes/api/fhir/routes/resource-list-routes.ts`
- `server/services/dashboard/dashboard-service.ts`
- `client/src/hooks/useCapabilitySearchParams.ts`
- `client/src/hooks/use-server-reactive-queries.ts`

## Date Completed
October 22, 2025

