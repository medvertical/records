# Testing Dynamic Server Capabilities

## ✅ Implementation Complete

All code has been implemented and database migration applied. Now it's time to test!

## Quick Test Plan

### 1. Start the Server

```bash
npm run dev
```

### 2. Test Capability Detection

#### Check if tables were created:
```bash
# Check server_capabilities table
echo "SELECT table_name FROM information_schema.tables WHERE table_name = 'server_capabilities';" | psql $DATABASE_URL

# Or using npm script if you have one
npm run db:studio
```

#### Test API endpoint:
```bash
# Get capabilities for server 1 (replace with your actual server ID)
curl http://localhost:5000/api/servers/1/capabilities

# Expected response:
# {
#   "success": true,
#   "data": {
#     "serverId": 1,
#     "serverUrl": "...",
#     "searchModifiers": {
#       "missing": true,
#       "exists": false,
#       "contains": true,
#       "exact": true,
#       "not": false
#     },
#     "detectedAt": "2025-10-21T...",
#     "fhirVersion": "4.0.1"
#   }
# }
```

### 3. Test in UI

#### Test HAPI FHIR:
1. Open browser to `http://localhost:5000`
2. Go to Resource Browser
3. Add a filter for `_profile` parameter
4. Check the operator dropdown:
   - ✅ Should show "missing" operator
   - ❌ Should NOT show "exists" operator
5. Apply filter with `_profile:missing=false`
6. Resources should load without 503 errors

#### Test Fire.ly (if available):
1. Switch to Fire.ly server
2. Add a filter for `_profile` parameter
3. Check the operator dropdown:
   - ❌ Should NOT show "missing" operator (or might show it)
   - ✅ Should show "exists" operator
4. Apply filter with `_profile:exists=true`
5. Resources should load

### 4. Test Server Switching

1. Connect to HAPI server
2. Wait for capability detection (check console logs)
3. Switch to Fire.ly server
4. Capabilities should update automatically
5. Check that available operators change

### 5. Check Console Logs

Look for these messages:
```
[ServerActivationService] Detecting capabilities for server 1 in background
[CapabilityDetector] Testing :missing modifier
[CapabilityDetector] :missing modifier supported ✓
[CapabilityDetector] Testing :exists modifier
[CapabilityDetector] :exists modifier not supported ✗
[CapabilitiesCache] Cached capabilities for server 1
```

### 6. Test API Response Metadata

When filtering with existence modifiers, check the response:

```bash
curl "http://localhost:5000/api/fhir/resources/filtered?resourceTypes=Patient&fhirParams=%7B%22_profile%22%3A%7B%22operator%22%3A%22exists%22%2C%22value%22%3A%22true%22%7D%7D"
```

Response should include:
```json
{
  "success": true,
  "data": {
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
    }
  }
}
```

## Expected Behaviors

### HAPI FHIR Server
- ✅ Supports `:missing` modifier
- ❌ Does NOT support `:exists` modifier
- UI shows only "missing" operator
- Client-side filtering used for `:exists` if somehow applied

### Fire.ly Server
- ❌ May not support `:missing` modifier
- ✅ Supports `:exists` modifier
- UI shows only "exists" operator (or both if Fire.ly supports both)

## Troubleshooting

### Capabilities not detected
```bash
# Force refresh
curl -X POST http://localhost:5000/api/servers/1/capabilities/refresh

# Check cache stats
curl http://localhost:5000/api/servers/capabilities/cache-stats
```

### Wrong operators showing in UI
1. Check React Query DevTools
2. Verify `useServerCapabilities` is returning data
3. Check browser console for errors
4. Clear browser cache

### 503 Errors still happening
1. Check server logs for capability detection errors
2. Verify filtering logic is checking capabilities
3. Check if client-side fallback is being triggered

## Success Criteria

✅ No 503 errors when filtering with `:exists` on HAPI
✅ No 503 errors when filtering with `:missing` on Fire.ly
✅ UI only shows supported operators
✅ Switching servers updates available operators
✅ Clear user feedback about filtering limitations
✅ Resources load within reasonable time (< 10 seconds)

## Performance Expectations

- **Capability detection**: 5-10 seconds (one-time, cached 24h)
- **Cache hit**: < 1ms
- **Client-side filtering**: 2-10 seconds (depending on dataset size)
- **Background detection**: Non-blocking, doesn't delay server activation

## Next Steps After Testing

If everything works:
1. ✅ Mark implementation complete
2. ✅ Update project documentation
3. ✅ Consider adding UI indicator showing which strategy is being used
4. ✅ Consider implementing true server-side filtering when modifier is supported

If issues found:
1. Check console logs
2. Verify API responses
3. Test with different servers
4. Report specific errors for debugging

