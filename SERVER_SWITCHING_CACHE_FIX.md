# Server Switching Cache Fix

## Problem

When switching between FHIR servers, the cached resource counts from the previous server were not being cleared, causing stale data to display. For example:
- Switching from Fire.ly Server (4.2M Patients) to HAPI Server would still show 4.2M Patients instead of fetching the correct counts from HAPI.

## Root Cause

The `FhirClient` was being created without the `serverId` parameter, causing all servers to share the same cache namespace (default serverId=1). The cache keys looked like this:
- `server:1:resource-counts-all` for all servers (wrong!)

Instead of:
- `server:1:resource-counts-all` for Fire.ly Server
- `server:2:resource-counts-all` for HAPI Server

## Fix Applied

### 1. Pass serverId to FhirClient in routes.ts
**File:** `server/routes.ts` (line 39)

**Before:**
```typescript
fhirClient = new FhirClient(serverUrl);
```

**After:**
```typescript
const serverId = activeServer.id;
fhirClient = new FhirClient(serverUrl, undefined, serverId);
```

### 2. Pass serverId when switching servers
**File:** `server/services/server-activation-service.ts` (lines 53-63)

**Before:**
```typescript
const newFhirClient = new FhirClient(event.server.url);
```

**After:**
```typescript
// Clear cache for the previous server to prevent stale data
const oldServerId = (this.fhirClient as any).serverId;
if (oldServerId !== undefined) {
  console.log(`[ServerActivationService] Invalidating cache for previous server ${oldServerId}`);
  const cache = getFhirCache();
  cache.invalidateServer(oldServerId);
}

// Create new FHIR client with the new server URL and serverId
const newServerId = parseInt(event.serverId);
const newFhirClient = new FhirClient(event.server.url, undefined, newServerId);
```

### 3. Added cache invalidation on server switch
When switching servers, the cache for the previous server is now explicitly invalidated using:
```typescript
cache.invalidateServer(oldServerId);
```

This ensures:
- Old server's cached data is cleared
- New server gets fresh data from its API
- No stale counts or data from the previous server

## How It Works Now

### Cache Namespacing
Each server has its own cache namespace:
- Fire.ly Server (serverId=1): `server:1:resource-counts-all`
- HAPI Server (serverId=2): `server:2:resource-counts-all`

### Server Switch Flow
1. User clicks to switch servers
2. `ServerActivationService` detects the switch
3. Old server's cache is invalidated: `cache.invalidateServer(oldServerId)`
4. New `FhirClient` created with correct `serverId`
5. New server's API is queried (or its cache is used if valid)
6. Fresh counts are displayed

### Cache Lifecycle
- Each server's cache is independent
- Cache TTL: 5 minutes for resource counts
- Cache is invalidated when:
  - Server is switched
  - Cache TTL expires
  - Manual refresh is triggered

## Testing

To verify the fix works:

1. **Start on Fire.ly Server**
   - Check counts (should show Fire.ly data)
   - Check logs: `serverId: 1`

2. **Switch to HAPI Server**
   - Check logs for: `[ServerActivationService] Invalidating cache for previous server 1`
   - Check logs for: `serverId: 2`
   - Resource counts should update to HAPI data

3. **Switch back to Fire.ly**
   - Check logs for: `[ServerActivationService] Invalidating cache for previous server 2`
   - Check logs for: `serverId: 1`
   - Resource counts should show Fire.ly data again

## Expected Behavior

### Before Fix
- ❌ Counts from previous server persist after switching
- ❌ All servers share the same cache
- ❌ Stale data shown

### After Fix
- ✅ Each server has independent cache
- ✅ Cache is cleared when switching servers
- ✅ Fresh data fetched for new server
- ✅ No stale counts

## Files Modified

1. `server/routes.ts` - Pass serverId when initializing FhirClient
2. `server/services/server-activation-service.ts` - Pass serverId and invalidate cache on switch

## Date Completed
October 22, 2025

