# Testing Guide for Resource Detail 500 Error Fix

## Quick Testing Steps

1. **Start the Development Server**
   ```bash
   npm run dev
   ```

2. **Open Browser Console** (F12 → Console tab)

3. **Navigate to Resource Browser** and click on several resources quickly

4. **Watch for:**
   - Detailed server logs in terminal
   - Client-side retry attempts in browser console
   - Improved error messages if errors occur

## What to Look For

### In Server Console

**Successful Request:**
```
[FHIR API] [Patient/12345] Resource detail request started
[FHIR API] [Patient/12345] Fetching from FHIR server...
[FHIR API] [Patient/12345] FHIR fetch successful (150ms)
[FHIR API] [Patient/12345] Enhancing with validation data...
[FHIR API] Active server: 2
[FHIR API] DB lookup for Patient/12345: Found (ID: 456) (25ms)
[FHIR API] Validation summary for Patient/12345: 1 errors, 2 warnings (30ms)
[FHIR API] Enhanced 1 resources in 55ms
[FHIR API] [Patient/12345] Request completed successfully (fetch: 150ms, enhance: 55ms, total: 205ms)
```

**Race Condition (Now Handled):**
```
[FHIR API] [Patient/12345] Resource detail request started
[FHIR API] [Patient/12345] Fetching from FHIR server...
[FHIR API] [Patient/12345] FHIR fetch successful (120ms)
[FHIR API] [Patient/12345] Enhancing with validation data...
[FHIR API] DB lookup for Patient/12345: Not found (10ms)
[FHIR API] Duplicate key for Patient/12345, attempting to fetch existing (25ms)
[FHIR API] DB lookup for Patient/12345: Found (ID: 456) (15ms)
[FHIR API] Enhanced 1 resources in 50ms
[FHIR API] [Patient/12345] Request completed successfully (fetch: 120ms, enhance: 50ms, total: 170ms)
```

**Error (Now With Details):**
```
[FHIR API] [Patient/12345] Resource detail request started
[FHIR API] [Patient/12345] Fetching from FHIR server...
[FHIR API] [Patient/12345] Error during fetch/enhance (5000ms): {
  message: "Connection timeout",
  code: "ETIMEDOUT",
  statusCode: undefined,
  stack: "Error: Connection timeout\n  at FhirClient.getResource ..."
}
[FHIR API] [Patient/12345] Unhandled error (5000ms): {
  message: "Connection timeout",
  code: "ETIMEDOUT",
  name: "Error",
  stack: "..."
}
```

### In Browser Console

**Automatic Retries:**
```
Fetching resource with ID: 46532226 Type: Patient
Resource fetch failed: 500 Internal Server Error
  (React Query will automatically retry with exponential backoff)
  
Fetching resource with ID: 46532226 Type: Patient (retry 1)
Resource fetch failed: 500 Internal Server Error
  (Waiting 600ms before next retry)
  
Fetching resource with ID: 46532226 Type: Patient (retry 2)
Resource fetched successfully: {resourceType: 'Patient', id: '46532226', ...}
```

### In UI

**Error Message (If All Retries Fail):**
- Shows error message
- Shows "The system automatically retried this request" notice
- Shows Request ID (e.g., `Patient/46532226`)
- Shows Duration (e.g., `5000ms`)
- Has "Try Again" button

## Testing Scenarios

### Scenario 1: Click Resources Rapidly
1. Go to resource list
2. Click 5 resources in quick succession
3. **Expected**: All should load successfully (race condition handled)

### Scenario 2: Large Dataset
1. Connect to HAPI server with many resources
2. Click resources from the list
3. **Expected**: No timeouts, validation data loads properly

### Scenario 3: Slow Network
1. Use browser DevTools to throttle network to "Slow 3G"
2. Click a resource
3. **Expected**: Takes longer but eventually succeeds with retries

### Scenario 4: Server Restart
1. Open a resource detail page
2. Restart the HAPI FHIR server
3. Click another resource
4. **Expected**: Gets better error message with request ID

## Success Criteria

✅ **No more intermittent 500 errors** - Resources load consistently

✅ **Race conditions handled** - See "Duplicate key" logs when clicking quickly, but no errors

✅ **Detailed error logs** - When errors occur, see exact operation that failed and timing

✅ **Better retry behavior** - Client retries up to 3 times with exponential backoff

✅ **Helpful error messages** - Users see request ID and duration when errors persist

## If Issues Persist

If you still see 500 errors after the fix:

1. **Check the server logs** for the specific error details:
   - Look for `[FHIR API] [ResourceType/ID]` prefixed lines
   - Find which operation failed: "DB lookup", "DB create", "Validation summary", or "FHIR fetch"
   - Note the timing - operations taking > 1000ms indicate performance issues

2. **Check for patterns**:
   - Same resources always failing? → Might be data-specific issue
   - Random failures? → Might be database connection pool exhaustion
   - Failures after timeout? → FHIR server performance issue

3. **Collect diagnostic info**:
   - Request ID from error message
   - Full server log for that request
   - Timing information
   - Resource type and ID that failed

## Monitoring Tips

**Server-side monitoring:**
```bash
# Watch server logs with timestamps
npm run dev | ts

# Or redirect to file for analysis
npm run dev 2>&1 | tee server-debug.log
```

**Client-side monitoring:**
```javascript
// In browser console, filter by [ResourceDetail]
console.log('[ResourceDetail] logs')
```

**Database monitoring:**
```sql
-- Check for slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE query LIKE '%fhir_resources%'
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check connection pool
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;
```

## Next Steps Based on Findings

| Issue Found | Next Action |
|------------|-------------|
| Duplicate key errors (23505) common | Add unique constraint on (server_id, resource_type, resource_id) |
| DB lookup slow (> 500ms) | Add index on (resource_type, resource_id) |
| Validation summary slow | Add caching layer or optimize query |
| FHIR fetch slow | Add timeout config, check HAPI performance |
| Connection pool exhausted | Increase pool size in db.ts |


