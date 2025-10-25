# Expected Console Output - Revalidation Fix Testing

## Test Scenario 1: Initial Page Load ✅

### Expected Console Output:
```
[ValidationSettingsPolling] Initial settings loaded: {previous: null, current: {...}, timestamp: '2025-10-25T...'}
[Settings Change] lastChange detected: 2025-10-25T...
[Settings Change] Initial settings load - no revalidation needed
[Validation State] hasValidatedCurrentPage changed: false {resourceType: 'all', page: 0, resourceCount: 20}
[Reset Validation Flag] No actual change detected - keeping validation state
[Auto-Validation Effect] Triggered with: {hasResources: true, resourceCount: 20, hasValidatedCurrentPage: false, isValidating: false, resourceType: 'all', page: 0}
[Auto-Validation Effect] Starting validation timer...
[Auto-Validation Effect] Timer fired - calling validateUnvalidatedResources
[Background Validation] Starting parallel validation of 1 batches (20 total resources)
[Background Validation] Processing batch 1 with 20 resources
[Background Validation] Batch 1 completed successfully in 5009ms
[Background Validation] All batches completed: 1/1 successful in 5010ms
[Background Validation] Invalidating validation data (badges only)...
[Background Validation] Validation data invalidated
[Validation State] hasValidatedCurrentPage changed: true {resourceType: 'all', page: 0, resourceCount: 20}
```

### Key Points:
- ✅ "Initial settings load - no revalidation needed"
- ✅ Auto-validation runs once on initial load
- ✅ hasValidatedCurrentPage becomes true after validation

---

## Test Scenario 2: Navigate to Detail and Back ✅

### User Actions:
1. Click on a resource to view detail
2. Click back button to return to list

### Expected Console Output:
```
// When navigating back to list:
[Reset Validation Flag] No actual change detected - keeping validation state
[Validation State] hasValidatedCurrentPage changed: false {resourceType: 'Patient', page: 0, resourceCount: 20}
[Auto-Validation Effect] Triggered with: {hasResources: true, resourceCount: 20, hasValidatedCurrentPage: true, isValidating: false, resourceType: 'Patient', page: 0}
[Auto-Validation Effect] Skipping validation - conditions not met
```

### Key Points:
- ✅ "No actual change detected - keeping validation state"
- ✅ "Skipping validation - conditions not met" (because hasValidatedCurrentPage is true)
- ❌ NO "[Background Validation] Starting parallel validation..." message

---

## Test Scenario 3: Page Navigation (Should Revalidate) ✅

### User Actions:
1. Click "Next Page" button (page 0 → page 1)

### Expected Console Output:
```
[Reset Validation Flag] Resetting due to actual change: {page: {from: 0, to: 1, changed: true}, resourceType: {from: 'Patient', to: 'Patient', changed: false}}
[Validation State] hasValidatedCurrentPage changed: false {resourceType: 'Patient', page: 1, resourceCount: 20}
[Auto-Validation Effect] Triggered with: {hasResources: true, resourceCount: 20, hasValidatedCurrentPage: false, isValidating: false, resourceType: 'Patient', page: 1}
[Auto-Validation Effect] Starting validation timer...
[Auto-Validation Effect] Timer fired - calling validateUnvalidatedResources
[Background Validation] Starting parallel validation of 1 batches (20 total resources)
```

### Key Points:
- ✅ "Resetting due to actual change" shows page changed: true
- ✅ hasValidatedCurrentPage becomes false
- ✅ Validation runs for new page resources

---

## Test Scenario 4: Resource Type Change (Should Revalidate) ✅

### User Actions:
1. Change resource type dropdown from "Patient" to "Observation"

### Expected Console Output:
```
[Reset Validation Flag] Resetting due to actual change: {page: {from: 0, to: 0, changed: false}, resourceType: {from: 'Patient', to: 'Observation', changed: true}}
[Validation State] hasValidatedCurrentPage changed: false {resourceType: 'Observation', page: 0, resourceCount: 15}
[Auto-Validation Effect] Triggered with: {hasResources: true, resourceCount: 15, hasValidatedCurrentPage: false, isValidating: false, resourceType: 'Observation', page: 0}
[Auto-Validation Effect] Starting validation timer...
[Background Validation] Starting parallel validation of 1 batches (15 total resources)
```

### Key Points:
- ✅ "Resetting due to actual change" shows resourceType changed: true
- ✅ Validation runs for new resource type

---

## Test Scenario 5: Settings Modal Open/Close (No Changes) ✅

### User Actions:
1. Open settings modal (click gear icon)
2. Close settings modal without making changes (click X or Cancel)

### Expected Console Output:
```
[SettingsModal] Modal open state changed: true
// ... modal opens, no settings change ...
[SettingsModal] Modal open state changed: false
[SettingsModal] Modal closed, resetting saveCounter
// NO [Settings Change] logs
// NO [Background Validation] logs
```

### Key Points:
- ❌ NO "[Settings Change] lastChange detected" message
- ❌ NO revalidation triggered
- ✅ Modal just opens and closes

---

## Test Scenario 6: Settings Change (Non-Validation) ✅

### User Actions:
1. Open settings modal
2. Change a non-validation setting (e.g., theme, display preference)
3. Click Save

### Expected Console Output:
```
[SettingsModal] Modal open state changed: true
// ... make changes ...
[SettingsModal] Save completed, count: 1
[Settings Change] lastChange detected: 2025-10-25T...
[Settings Change] Non-validation settings changed - no revalidation needed
[SettingsModal] Modal open state changed: false
```

### Key Points:
- ✅ "Non-validation settings changed - no revalidation needed"
- ❌ NO cache clearing
- ❌ NO revalidation

---

## Test Scenario 7: Settings Change (Validation Aspects) ✅

### User Actions:
1. Open settings modal
2. Disable "Structural Validation" aspect
3. Click Save

### Expected Console Output:
```
[SettingsModal] Modal open state changed: true
// ... make changes ...
[SettingsModal] Save completed, count: 1
[Settings Change] lastChange detected: 2025-10-25T...
[Settings Change] Validation aspects changed - triggering revalidation {previous: {structural: {enabled: true, ...}}, current: {structural: {enabled: false, ...}}}
[Validation State] hasValidatedCurrentPage changed: false {resourceType: 'Patient', page: 0, resourceCount: 20}
[Auto-Validation Effect] Starting validation timer...
[Background Validation] Starting parallel validation of 1 batches (20 total resources)
```

### Key Points:
- ✅ "Validation aspects changed - triggering revalidation"
- ✅ Shows previous vs current aspects
- ✅ Cache cleared
- ✅ Revalidation runs

---

## Test Scenario 8: Rapid Navigation (Cleanup Test) ✅

### User Actions:
1. Quickly click to detail and back multiple times

### Expected Console Output:
```
// First navigation to detail:
[Auto-Validation Effect] Cleanup - clearing timer

// Navigation back:
[Reset Validation Flag] No actual change detected - keeping validation state
[Auto-Validation Effect] Skipping validation - conditions not met

// Second navigation to detail:
[Auto-Validation Effect] Cleanup - clearing timer

// Navigation back again:
[Reset Validation Flag] No actual change detected - keeping validation state
[Auto-Validation Effect] Skipping validation - conditions not met
```

### Key Points:
- ✅ Timers are cleaned up properly
- ✅ No validation runs on rapid back/forth navigation
- ✅ No memory leaks or duplicate validations

---

## Anti-Patterns (Should NOT See)

### ❌ WRONG: Revalidation on Navigation Back
```
// BAD - This should NOT happen:
[Background Validation] Starting parallel validation...  // <-- Wrong!
```

### ❌ WRONG: Initial Load Triggers Revalidation
```
// BAD - This should NOT happen:
[Settings Change] Validation aspects changed - triggering revalidation  // <-- Wrong on initial load!
[Settings Change] lastChange detected: ...
```

### ❌ WRONG: Settings Modal Close Triggers Revalidation
```
// BAD - This should NOT happen:
[SettingsModal] Modal closed
[Background Validation] Starting parallel validation...  // <-- Wrong!
```

---

## Success Metrics

### ✅ Fixed Scenarios (Should NOT revalidate):
1. Initial settings load
2. Navigate to detail and back (same page/type)
3. Settings modal open/close (no changes)
4. Non-validation settings changes

### ✅ Working Scenarios (Should revalidate):
1. Initial page load
2. Page navigation
3. Resource type change
4. Validation aspect changes
5. Manual revalidation button

---

## Quick Test Commands

```bash
# Watch console logs with specific filters:
# In browser console:

// Filter for validation triggers:
console.log = (function(originalLog) {
  return function(...args) {
    if (args[0]?.includes?.('[Background Validation]') || 
        args[0]?.includes?.('[Settings Change]') ||
        args[0]?.includes?.('[Reset Validation Flag]')) {
      originalLog.apply(console, args);
    }
  };
})(console.log);

// Or use browser console filter: "Background|Settings|Reset"
```

---

**Last Updated**: 2025-10-25
**Status**: Ready for manual testing

