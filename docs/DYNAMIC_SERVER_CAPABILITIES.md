# Dynamic Server Capabilities Detection

## Overview

The Dynamic Server Capabilities Detection system automatically detects which FHIR search modifiers each server supports and dynamically adjusts the UI to show only compatible operators. This eliminates errors from using unsupported modifiers and ensures optimal filtering strategy per server.

## Problem Statement

Different FHIR servers support different search modifiers:

- **HAPI FHIR**: Supports `:missing=true/false` (FHIR R4 standard) but NOT `:exists`
- **Fire.ly**: Supports `:exists=true/false` (custom extension) but may not support `:missing`
- **Other servers**: May have varying support for `:contains`, `:exact`, `:not`, etc.

Previously, the application showed all operators regardless of server support, leading to:
- 503 errors when using unsupported modifiers
- Infinite loops during client-side fallback filtering
- Poor user experience

## Solution Architecture

### Backend Components

#### 1. Capability Detector Service
**File**: `server/services/fhir/server-capability-detector.ts`

Tests each search modifier with lightweight requests to determine support:

```typescript
// Test example: Patient?gender:missing=true
// HTTP 200 = supported
// HTTP 400/422 = not supported

interface SearchModifierCapabilities {
  missing: boolean;      // :missing modifier (FHIR R4 standard)
  exists: boolean;       // :exists modifier (Fire.ly extension)
  contains: boolean;     // :contains (string search)
  exact: boolean;        // :exact (exact match)
  not: boolean;          // :not (negation)
}
```

#### 2. Capability Storage
**Files**: 
- `server/services/fhir/server-capabilities-cache.ts`
- `migrations/033_add_server_capabilities.sql`
- `shared/schema.ts` (serverCapabilities table)

Features:
- In-memory + database caching
- 24-hour TTL with automatic refresh
- Automatic detection on server activation

#### 3. API Endpoints
**File**: `server/routes/api/servers-capabilities.ts`

Endpoints:
- `GET /api/servers/:id/capabilities` - Get detected capabilities
- `POST /api/servers/:id/capabilities/refresh` - Force refresh
- `GET /api/servers/capabilities/cache-stats` - Debug stats

#### 4. Updated Search Params Endpoint
**File**: `server/routes/api/fhir/fhir.ts` (line ~629)

The `/api/fhir/capability/search-params/:resourceType` endpoint now:
- Fetches detected capabilities for the active server
- Only returns operators the server supports
- No more hardcoded operator lists

#### 5. Smart Filtering Fallback
**File**: `server/routes/api/fhir/fhir.ts` (line ~920)

When filtering with existence modifiers:
1. Check if server supports the modifier
2. If YES → use server-side filtering (fast)
3. If NO → use client-side with limits:
   - Max 1000 resources per type
   - Max 5000 total processed
   - Clear user feedback about limitations

### Frontend Components

#### 6. Capability Hook
**File**: `client/src/hooks/use-server-capabilities.ts`

React hooks for accessing capabilities:

```typescript
// Get capabilities for active server
const { capabilities, isLoading } = useServerCapabilities();

// Check if specific modifier supported
const supportsMissing = useSupportsModifier('missing');

// Get all supported modifiers
const supportedModifiers = useSupportedModifiers();

// Force refresh capabilities
const { refreshCapabilities } = useRefreshServerCapabilities();
```

#### 7. Dynamic Operators UI
**File**: `client/src/components/filters/FilterChip.tsx`

Updated to:
- Show only supported operators in dropdown
- Display "missing" operator with proper icon (X)
- Display "exists" operator with CheckCircle icon

### Integration Points

#### Server Activation
**File**: `server/services/server-activation-service.ts`

When a server is activated:
1. FHIR client is updated
2. Capabilities are detected in background (non-blocking)
3. Results cached for 24 hours

## Usage

### Backend

```typescript
// Get capabilities for a server
import { ServerCapabilitiesCache } from './services/fhir/server-capabilities-cache';

const capabilities = await ServerCapabilitiesCache.getCapabilities(serverId, fhirClient);

console.log(capabilities.searchModifiers.missing); // true/false
console.log(capabilities.searchModifiers.exists);  // true/false
```

### Frontend

```typescript
// In a React component
import { useServerCapabilities } from '@/hooks/use-server-capabilities';

function MyComponent() {
  const { capabilities, isLoading } = useServerCapabilities();
  
  if (isLoading) return <div>Loading capabilities...</div>;
  
  return (
    <div>
      {capabilities?.searchModifiers.missing && (
        <button>Filter by Missing</button>
      )}
      {capabilities?.searchModifiers.exists && (
        <button>Filter by Exists</button>
      )}
    </div>
  );
}
```

## API Response Format

When using client-side filtering, the API response includes filtering strategy information:

```json
{
  "success": true,
  "data": {
    "resources": [...],
    "totalCount": 50,
    "searchMethod": "client_side_filter",
    "filteringStrategy": {
      "method": "client_side",
      "reason": "Server does not support :exists modifier",
      "modifierUsed": "exists",
      "limitations": {
        "maxResourcesPerType": 1000,
        "maxTotalProcessed": 5000,
        "actualProcessed": 250
      }
    },
    "filterSummary": {
      "resourceTypes": ["Patient", "Observation"],
      "totalMatching": 50,
      "processedResources": 250,
      "progressMessage": "Found 50 resources with profiles after processing 250 resources"
    }
  }
}
```

## Database Schema

```sql
CREATE TABLE server_capabilities (
  id SERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES fhir_servers(id) ON DELETE CASCADE,
  capabilities JSONB NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  fhir_version VARCHAR(20),
  UNIQUE(server_id)
);
```

## Testing

### Manual Testing

1. **HAPI FHIR Server**:
   - Connect to HAPI server
   - Capabilities should show `missing: true, exists: false`
   - UI should only show "missing" operator, not "exists"

2. **Fire.ly Server**:
   - Connect to Fire.ly server
   - Capabilities should show `missing: false, exists: true`
   - UI should only show "exists" operator, not "missing"

3. **Switch Servers**:
   - Switch between HAPI and Fire.ly
   - UI should update operators automatically
   - No errors or 503 responses

### API Testing

```bash
# Get capabilities for server 1
curl http://localhost:5000/api/servers/1/capabilities

# Force refresh capabilities
curl -X POST http://localhost:5000/api/servers/1/capabilities/refresh

# Get cache stats
curl http://localhost:5000/api/servers/capabilities/cache-stats
```

## Benefits

✅ **Works with any FHIR server automatically** - No manual configuration needed

✅ **Fast when server supports filtering** - Uses server-side filtering when possible

✅ **Graceful degradation** - Falls back to client-side with clear limits

✅ **Clear user feedback** - API responses explain which strategy is being used

✅ **No more errors** - Eliminates 503 errors and infinite loops

✅ **Better UX** - Only shows operators that actually work

## Migration Notes

To apply the database migration:

```bash
npm run db:push
```

When prompted, confirm that `server_capabilities` is a new table (not a rename).

## Future Enhancements

1. **Server-side filtering optimization**: When a modifier is supported, use direct server-side filtering instead of client-side
2. **Capability detection UI**: Show detection progress in the UI
3. **Manual refresh button**: Allow users to manually refresh capabilities
4. **More modifiers**: Detect support for additional modifiers like `:text`, `:above`, `:below`
5. **Parameter-specific capabilities**: Detect which parameters support which modifiers (not all parameters support all modifiers)

## Troubleshooting

### Capabilities not detected
- Check server logs for detection errors
- Manually refresh: `POST /api/servers/:id/capabilities/refresh`
- Check FHIR server is accessible

### Wrong capabilities cached
- Force refresh capabilities
- Clear cache: `ServerCapabilitiesCache.clearCache()`
- Check FHIR server CapabilityStatement

### Operators not showing in UI
- Check React Query cache is invalidated
- Check `useServerCapabilities` hook is returning data
- Verify FilterChip is using capabilities correctly

## Related Files

**Backend**:
- `server/services/fhir/server-capability-detector.ts`
- `server/services/fhir/server-capabilities-cache.ts`
- `server/routes/api/servers-capabilities.ts`
- `server/routes/api/fhir/fhir.ts`
- `server/services/server-activation-service.ts`
- `migrations/033_add_server_capabilities.sql`
- `shared/schema.ts`

**Frontend**:
- `client/src/hooks/use-server-capabilities.ts`
- `client/src/components/filters/FilterChip.tsx`

**Documentation**:
- `fix-server-switch-counts.plan.md` - Original implementation plan

