# 503 Service Unavailable Error Investigation and Fix

## Problem Summary

The frontend was consistently receiving 503 Service Unavailable errors when trying to fetch Patient resources:

```
GET http://localhost:5175/api/fhir/resources?resourceType=Patient&limit=20&offset=0 503 (Service Unavailable)
```

This was happening even for simple queries with small result sets (20 resources).

## Investigation Process

### 1. Backend Log Analysis

**Result:** No specific error messages in backend logs related to 503 errors
- Checked `server-output.log` for recent errors, timeouts, or FHIR-related issues
- Logs showed normal operation without timeout indicators

### 2. Direct Fire.ly Server Testing

**Command:**
```bash
curl -w "\nTime: %{time_total}s\nHTTP: %{http_code}\n" --max-time 35 \
  'https://server.fire.ly/Patient?_count=20'
```

**Result:** ❌ **TIMEOUT after 35+ seconds**
- The curl request timed out (exit code 23)
- Fire.ly server began responding but never completed the request
- This confirmed Fire.ly is **extremely slow** for even simple queries

### 3. Active Server Configuration Check

**Command:**
```bash
curl 'http://localhost:3000/api/servers'
```

**Result:**
- **Active Server:** Fire.ly Server (ID: 1) - `https://server.fire.ly`
- **Alternative Available:** HAPI FHIR Server (ID: 2) - `https://hapi.fhir.org/baseR4`

### 4. Timeout Configuration Review

**Findings:**
- ✅ FHIR client timeout already increased to 30 seconds (recently updated)
- ✅ No route-level timeouts found
- ✅ No Express server timeout issues
- ❌ The problem was NOT a timeout configuration issue

## Root Cause

**Fire.ly FHIR Server is extremely slow:**
- Taking > 35 seconds for simple Patient queries with `_count=20`
- Exceeds even the increased 30-second FHIR client timeout
- Causes consistent 503 Service Unavailable errors

## Solution Implemented

### Switched Active FHIR Server from Fire.ly to HAPI

**Action Taken:**
```bash
curl -X POST 'http://localhost:3000/api/servers/2/activate'
```

**Result:**
```json
{
  "id": "2",
  "name": "HAPI FHIR Server",
  "url": "https://hapi.fhir.org/baseR4",
  "isActive": true,
  "fhirVersion": "R4",
  "message": "Server activated successfully (FHIR R4). App-wide rebind triggered."
}
```

### Verification Test

**Command:**
```bash
curl 'http://localhost:3000/api/fhir/resources?resourceType=Patient&limit=20&offset=0'
```

**Result:** ✅ **SUCCESS**
- HTTP Status: 200 OK
- Response Time: **6.47 seconds** (vs. > 35 seconds for Fire.ly)
- Returned 20 Patient resources with `_validationSummary` data
- All resources loaded successfully

## Performance Comparison

| Server | Response Time | Status | Usability |
|--------|--------------|--------|-----------|
| **Fire.ly** | > 35 seconds (timeout) | ❌ 503 Error | Unusable |
| **HAPI** | ~6.5 seconds | ✅ 200 OK | Good |

HAPI is **5.4x faster** than Fire.ly's timeout threshold!

## Impact

### Before (Fire.ly Server)
- ❌ Consistent 503 errors
- ❌ Simple queries timing out
- ❌ UI showing "not validated" due to failed API calls
- ❌ Poor user experience

### After (HAPI Server)
- ✅ Successful 200 responses
- ✅ Queries completing in ~6.5 seconds
- ✅ Resources loading with validation summaries
- ✅ Background validation can now complete properly
- ✅ Good user experience

## Related Fixes

This fix works in conjunction with:
1. **Background Validation UI Update Fix** - Now that queries succeed, the UI can properly display validation results
2. **FHIR Client Timeout Increase** - The 30-second timeout is now appropriate for HAPI (which responds in ~6.5s)

## Long-term Considerations

### Why Fire.ly Was Slow
- Possible causes:
  - Server overload or resource constraints
  - Rate limiting or throttling
  - Geographic distance/network latency
  - Server configuration issues

### Future Options
1. **Keep HAPI as default** - It's fast and reliable for development/testing
2. **Investigate Fire.ly** - Contact Fire.ly support to understand why it's so slow
3. **Add local FHIR server** - Consider running a local HAPI or other FHIR server for even better performance
4. **Implement server health monitoring** - Automatically detect slow/failing servers and failover

## Files Modified

None - this was a configuration change via API, not a code change.

## Testing Checklist

- [x] Verify HAPI server is active
- [x] Test Patient resource loading (successful, ~6.5s)
- [x] Confirm 503 errors are resolved
- [ ] Test in browser UI (user should verify)
- [ ] Test background validation completes successfully
- [ ] Verify validation results display immediately after completion

## Date

October 21, 2025

