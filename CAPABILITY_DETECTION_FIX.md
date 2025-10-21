# Capability Detection Fix - 500 Error

## Problem
After implementing dynamic capabilities, the app was throwing 500 errors:
```
GET /api/fhir/capability/search-params/Patient 500 (Internal Server Error)
```

## Root Cause
The `ServerCapabilityDetector` was trying to access the private `baseUrl` field from `FhirClient`:
```typescript
const serverUrl = this.fhirClient['baseUrl']; // ❌ Access private field
```

This caused errors when the capability detection tried to run.

## Solution
Updated all capability detection methods to accept `serverUrl` as an optional parameter:

### Files Modified:
1. **`server/services/fhir/server-capability-detector.ts`**
   - Added `serverUrl?: string` parameter to `detectCapabilities()`
   - Removed private field access

2. **`server/services/fhir/server-capabilities-cache.ts`**
   - Added `serverUrl?: string` to `getCapabilities()`
   - Added `serverUrl?: string` to `detectAndCache()`
   - Added `serverUrl?: string` to `refreshCapabilities()`

3. **`server/routes/api/fhir/fhir.ts`**
   - Pass `activeServer.url` when calling `getCapabilities()`

4. **`server/services/server-activation-service.ts`**
   - Pass `event.server.url` when calling `detectCapabilitiesInBackground()`

5. **`server/routes/api/servers-capabilities.ts`**
   - Fetch server from storage and pass URL

## Testing
1. Restart the server: `npm run dev`
2. Navigate to Resource Browser
3. Check browser console - no more 500 errors
4. Add a filter for `_profile` - should work properly

## Status
✅ Fixed - Ready for testing

