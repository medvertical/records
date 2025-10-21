# Dynamic Server Capability Detection Plan

## Overview
Implement a system that automatically detects which FHIR search modifiers each server supports (`:missing`, `:exists`, `:contains`, etc.) and dynamically adjusts available filter operators in the UI.

## Problem Statement
Different FHIR servers support different search modifiers:
- **HAPI FHIR**: Supports `:missing=true/false` (FHIR R4 standard)
- **Fire.ly**: Supports `:exists=true/false` (custom extension)
- Currently, the app shows all operators regardless of server support, leading to errors

## Solution Architecture

### 1. Backend: Capability Detection Service
**New File**: `server/services/fhir/server-capability-detector.ts`

**Purpose**: Test which search modifiers a FHIR server supports

**Detection Method**:
- Make lightweight test requests for each modifier
- Use simple parameters like `Patient?gender:missing=true`
- HTTP 200 = supported, HTTP 400/422 = not supported
- Test these modifiers:
  - `:missing` (FHIR R4 standard)
  - `:exists` (Fire.ly extension)
  - `:contains` (string search)
  - `:exact` (exact match)
  - `:not` (negation)

**Output Format**:
```typescript
{
  searchModifiers: {
    missing: boolean,
    exists: boolean,
    contains: boolean,
    exact: boolean,
    not: boolean
  },
  detectedAt: Date,
  fhirVersion: string
}
```

### 2. Backend: Capability Storage
**New Migration**: Add `server_capabilities` table

**Schema**:
```sql
CREATE TABLE server_capabilities (
  id SERIAL PRIMARY KEY,
  server_id INTEGER REFERENCES fhir_servers(id),
  capabilities JSONB NOT NULL,
  detected_at TIMESTAMP NOT NULL,
  fhir_version VARCHAR(10),
  UNIQUE(server_id)
);
```

**New File**: `server/services/fhir/server-capabilities-cache.ts`
- In-memory cache with 24-hour TTL
- Database persistence for durability
- Refresh on server activation or manual trigger

### 3. Backend: API Endpoints
**New**: `GET /api/servers/:id/capabilities`
- Returns cached capabilities for a server
- Triggers detection if not cached or stale

**Modify**: `GET /api/fhir/capability/search-params/:resourceType`
- Currently returns hardcoded operators
- Update to query actual server capabilities
- Return only supported operators per parameter

**Example Response**:
```json
{
  "searchParameters": [
    {
      "name": "_profile",
      "type": "uri",
      "operators": ["equals", "missing"],
      "documentation": "Profiles this resource claims to conform to"
    }
  ]
}
```

### 4. Frontend: Capability Hook
**New File**: `client/src/hooks/use-server-capabilities.ts`

```typescript
export function useServerCapabilities() {
  const { activeServer } = useServerData();
  
  return useQuery({
    queryKey: ['/api/servers', activeServer?.id, 'capabilities'],
    queryFn: () => fetch(`/api/servers/${activeServer?.id}/capabilities`).then(r => r.json()),
    enabled: !!activeServer,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
```

### 5. Frontend: Dynamic Operator UI
**Modify**: `client/src/components/filters/FilterChip.tsx`
- Filter operators based on `useServerCapabilities()`
- Show only what the server supports
- Add tooltip: "Not supported by this server" for hidden operators

**Modify**: `client/src/pages/resource-browser.tsx`
- Pass capabilities to search parameters endpoint
- Use detected operators in filter chips

### 6. Smart Fallback System
**Modify**: `server/routes/api/fhir/fhir.ts`
- When processing filters, check if server supports the modifier
- If **supported**: Pass to server (fast)
- If **not supported**: Use improved client-side filtering:
  - Max 300 resources per type (3 batches × 100)
  - Max 5000 total across all types
  - 3 consecutive empty batches = give up
  - Clear progress message to user

**User Feedback**:
```
"Searching for resources with profiles (server-side filtering not available - checking up to 5000 resources)"
```

## Implementation Steps

### Phase 1: Detection & Storage (Backend)
1. Create `ServerCapabilityDetector` class
2. Add database migration for `server_capabilities` table
3. Implement capability cache service
4. Create detection endpoint

### Phase 2: Backend Integration
5. Update search params endpoint to use capabilities
6. Modify resource filtering to check capabilities
7. Improve client-side fallback with limits
8. Add capability refresh on server activation

### Phase 3: Frontend Integration
9. Create `useServerCapabilities` hook
10. Update FilterChip to filter operators dynamically
11. Add UI indicators for unsupported features
12. Update resource browser to use capabilities

### Phase 4: Polish
13. Add capability detection progress indicator
14. Add manual refresh button for capabilities
15. Add tooltips explaining limitations
16. Update documentation

## Files to Create
- `server/services/fhir/server-capability-detector.ts`
- `server/services/fhir/server-capabilities-cache.ts`
- `server/routes/api/servers-capabilities.ts`
- `server/migrations/YYYY-add-server-capabilities-table.sql`
- `client/src/hooks/use-server-capabilities.ts`

## Files to Modify
- `server/routes/api/fhir/fhir.ts` (search params endpoint + filtering logic)
- `server/routes/api/servers.ts` (add capabilities endpoint)
- `server/services/server-activation-service.ts` (trigger detection on activation)
- `client/src/components/filters/FilterChip.tsx` (dynamic operators)
- `client/src/pages/resource-browser.tsx` (use capabilities)
- `shared/schema.ts` (add capabilities table schema)

## Benefits
✅ Automatically adapts to any FHIR server
✅ No manual configuration needed
✅ Fast server-side filtering when available
✅ Graceful degradation to client-side filtering
✅ Clear user feedback about limitations
✅ Future-proof for new servers and modifiers

## Testing Strategy
1. Test with HAPI FHIR (supports `:missing`)
2. Test with Fire.ly (supports `:exists`)
3. Test with unsupported modifiers → verify fallback
4. Test capability caching and refresh
5. Test UI hides unsupported operators

## Alternative Approaches Considered
- **CapabilityStatement parsing**: Not reliable, modifiers not exposed
- **Hardcoded per server type**: Not scalable, requires updates
- **Always client-side**: Too slow for large datasets
- **Current approach**: ✅ Dynamic detection + smart fallback

## Migration Path
- Backwards compatible: Existing hardcoded logic remains as fallback
- Capabilities detected on first use per server
- Users see gradual improvement as capabilities are detected
- No breaking changes to existing functionality

