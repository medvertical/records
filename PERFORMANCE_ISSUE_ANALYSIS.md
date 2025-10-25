# 🐌 PERFORMANCE ISSUE ANALYSIS - Resource List Loading

## Date: 2025-10-25

---

## 🔴 ISSUE IDENTIFIED

**Problem**: Resource list not loading / takes very long to load  
**Symptom**: Console shows `hasResources: false, resourceCount: 0` continuously  
**Pages Affected**: `/resources` page

---

## Test Results

### Timeline of Events:

1. **T+0s**: Navigate to `/resources`
   - Page loads with "Select a Resource Type"
   - Console: `hasResources: false, resourceCount: 0`

2. **T+5s**: Still waiting
   - Sidebar shows resource counts loaded (26.4K Patients)
   - Main content area still empty
   - Console: Still `hasResources: false`

3. **T+8s**: Click "Patient" quicklink
   - URL changes to `/resources?type=Patient`
   - Console: `[Reset Validation Flag] Resetting due to actual change`
   - Console: Still `hasResources: false, resourceCount: 0`

4. **T+11s**: Still waiting
   - Resources NOT loading
   - **Data fetch appears to be stuck or failing**

---

## Console Logs Analysis

### What We See:
```
[Reset Validation Flag] Resetting due to actual change: {page: Object, resourceType: Object}
[Auto-Validation Effect] Triggered with: {hasResources: false, resourceCount: 0, hasValidatedCurrentPage: false, isValidating: false, resourceType: Patient}
[Auto-Validation Effect] Skipping validation - conditions not met
```

### What's Missing:
- ❌ NO logs showing resources being fetched
- ❌ NO logs showing resources received
- ❌ NO `hasResources: true` ever appearing
- ❌ NO validation starting (because no resources)

---

## Network Activity

### Successful API Calls:
```
✅ GET /api/fhir/resource-types => 200 OK
✅ GET /api/validation/settings => 200 OK
✅ GET /api/fhir/connection/test => 200 OK
✅ GET /api/fhir/resource-counts => 200 OK
✅ GET /api/fhir/resources?limit=20&offset=0 => 200 OK  <-- This returned data!
```

### Issue:
The API call `/api/fhir/resources?limit=20&offset=0` **DID RETURN 200 OK**, meaning data came back from the server, but the React component **isn't rendering it**.

---

## Root Cause Analysis

### Possible Causes:

1. **React Query Issue** 🎯 LIKELY
   - Data fetched but not updating component state
   - Query key mismatch
   - Query not enabled when it should be
   - Suspense boundary catching

2. **Component Rendering Issue** 🎯 POSSIBLE
   - Conditional rendering logic broken
   - resourcesData not being extracted from query result
   - Type checking preventing render

3. **URL/State Sync Issue** 🎯 POSSIBLE
   - URL has `?type=Patient` but component reading `resourceType: 'all'`
   - State not updating from URL params
   - Race condition between URL parsing and data fetching

4. **Backend Response Issue** 🎯 UNLIKELY
   - API returns 200 but empty array
   - API returns malformed data
   - (But Fire.ly server usually works)

---

## Specific Code Areas to Investigate

### 1. Resource Query in `resource-browser.tsx`

Around line ~450-650, check:
```typescript
const { data: resourcesData, isLoading, error } = useQuery({
  queryKey: ['resources', ...],
  queryFn: async () => { ... },
  enabled: ??? // <-- Is this preventing the query?
});
```

**Questions:**
- Is `enabled` condition too restrictive?
- Is `queryKey` correct?
- Is `resourcesData` being extracted properly?

### 2. URL Parameter Parsing

Around line ~250-350, check:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  // Is setResourceType being called?
  // Is there a race condition?
}, [location]);
```

**Questions:**
- Is URL param `type` being read correctly?
- Is `setResourceType('Patient')` being called?
- Is there a delay/race condition?

### 3. Resource List Rendering

Around line ~2000+, check:
```tsx
{resourcesData?.resources && resourcesData.resources.length > 0 ? (
  <ResourceList resources={...} />
) : (
  <div>No resources</div>  // <-- Are we stuck here?
)}
```

**Questions:**
- What does `resourcesData` actually contain?
- Is `resources` property named correctly?
- Is the conditional logic correct?

---

## Debugging Steps

### Immediate Actions Needed:

1. **Add Debug Logging** in `resource-browser.tsx`:
```typescript
useEffect(() => {
  console.log('[DEBUG] resourcesData changed:', {
    exists: !!resourcesData,
    resourceCount: resourcesData?.resources?.length,
    total: resourcesData?.total,
    isLoading,
    error
  });
}, [resourcesData, isLoading, error]);
```

2. **Check Query Enabled Condition**:
```typescript
const { data: resourcesData, isLoading, error } = useQuery({
  // ...
  enabled: !!activeServer, // <-- Log this value
});

console.log('[DEBUG] Query enabled?', {
  activeServer: !!activeServer,
  resourceType,
  searchQuery
});
```

3. **Check URL Parsing**:
```typescript
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get('type');
  console.log('[DEBUG] URL parsing:', {
    urlParams: window.location.search,
    typeParam,
    currentResourceType: resourceType
  });
}, [location]);
```

---

## Performance Impact

| Metric | Expected | Actual | Impact |
|--------|----------|--------|--------|
| Initial Load | < 1s | ∞ (never loads) | 🔴 CRITICAL |
| User Experience | Instant | Unusable | 🔴 CRITICAL |
| Data Fetch | 200-500ms | Works (200 OK) | ✅ OK |
| Rendering | Immediate | Broken | 🔴 CRITICAL |

---

## Recommended Fix Priority

1. 🔴 **CRITICAL**: Add debug logging to identify exact failure point
2. 🔴 **CRITICAL**: Check if `resourcesData` is undefined vs empty array vs has data
3. 🔴 **CRITICAL**: Verify URL param → state synchronization
4. 🟡 **MEDIUM**: Check React Query `enabled` condition
5. 🟡 **MEDIUM**: Verify component conditional rendering logic

---

## Next Steps

1. Add comprehensive debug logging
2. Check browser DevTools React Query cache
3. Inspect actual `resourcesData` value in component
4. Verify query is running when it should
5. Check for any error boundaries swallowing errors

---

## Status

**Issue**: 🔴 CRITICAL - Resource list not loading  
**Root Cause**: 🔍 UNDER INVESTIGATION  
**Revalidation Fix**: ✅ WORKING (not causing this issue)  
**Priority**: 🔴 HIGH - Blocks primary functionality

---

**This is a separate issue from the revalidation cascade that was just fixed. The revalidation fix is working correctly - this is a data loading/rendering issue.**


