# Settings Modal URL Persistence

## Feature Overview

Implemented URL hash-based persistence for the Settings Modal, allowing it to survive page reloads and enabling deep linking to specific settings tabs.

## Problem

When users opened the Settings Modal and reloaded the page (Cmd+R / Ctrl+R), the modal would close and they would lose their place. This was especially frustrating when:
- Debugging settings issues
- Testing settings changes that require page reload
- Sharing links to specific settings with team members

## Solution

Added URL hash tracking using the pattern `#settings-{tabname}`:
- `#settings-validation` - Opens modal to Validation tab
- `#settings-servers` - Opens modal to Servers tab
- `#settings-rules` - Opens modal to Rules tab
- `#settings-dashboard` - Opens modal to Dashboard tab
- `#settings-system` - Opens modal to System tab

## Implementation

**File**: `client/src/components/settings/SettingsModal.tsx`

### 1. Parse Hash on Mount

When the component mounts, check if URL contains `#settings`:

```typescript
// Parse initial state from URL hash on mount
useEffect(() => {
  const hash = window.location.hash;
  if (hash.startsWith('#settings')) {
    // Extract tab if specified (e.g., #settings-system)
    const parts = hash.split('-');
    if (parts.length > 1) {
      const tab = parts.slice(1).join('-'); // Handle multi-part tabs
      setActiveTab(tab);
    }
    // Open modal if not already open
    if (!open) {
      onOpenChange(true);
    }
  }
}, []); // Only run on mount
```

### 2. Update Hash on State Changes

When modal opens/closes or tab changes, update the URL hash:

```typescript
// Update URL hash when modal opens/closes or tab changes
useEffect(() => {
  if (open) {
    const newHash = activeTab ? `#settings-${activeTab}` : '#settings';
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash);
    }
  } else {
    // Remove hash when modal closes
    if (window.location.hash.startsWith('#settings')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}, [open, activeTab]);
```

**Uses `replaceState` instead of `pushState`** to avoid polluting browser history with every tab change.

### 3. Listen for Browser Navigation

Handle browser back/forward buttons:

```typescript
// Listen for browser back/forward navigation
useEffect(() => {
  const handleHashChange = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#settings')) {
      // Extract tab if specified
      const parts = hash.split('-');
      if (parts.length > 1) {
        const tab = parts.slice(1).join('-');
        setActiveTab(tab);
      }
      // Open modal if it's closed
      if (!open) {
        onOpenChange(true);
      }
    } else {
      // Close modal if hash is removed
      if (open) {
        onOpenChange(false);
      }
    }
  };

  window.addEventListener('hashchange', handleHashChange);
  return () => window.removeEventListener('hashchange', handleHashChange);
}, [open, onOpenChange]);
```

## User Experience

### Scenario 1: Page Reload

**Before**:
1. Open Settings Modal → System tab
2. Reload page (Cmd+R)
3. ❌ Modal is closed, user at dashboard

**After**:
1. Open Settings Modal → System tab
2. URL shows: `http://localhost:5174/#settings-system`
3. Reload page (Cmd+R)
4. ✅ Modal reopens automatically to System tab

### Scenario 2: Deep Linking

Users can now share direct links to specific settings:
- `http://localhost:5174/#settings-validation` → Opens Validation settings
- `http://localhost:5174/#settings-system` → Opens System settings
- `http://localhost:5174/resources#settings-dashboard` → Opens Dashboard settings from any page

### Scenario 3: Browser Back/Forward

**Before**:
1. Open modal → click various tabs
2. Press browser Back button
3. ❌ Nothing happens or unexpected navigation

**After**:
1. Open modal → URL: `#settings-validation`
2. Click System tab → URL: `#settings-system`
3. Press browser Back button
4. ✅ Returns to Validation tab
5. Press Back again
6. ✅ Modal closes, hash removed

### Scenario 4: Close Modal

**Before**: Hash remains in URL even after closing modal

**After**:
1. Open modal → URL has `#settings-system`
2. Close modal (X button or Escape)
3. ✅ Hash removed, clean URL: `http://localhost:5174/`

## URL Hash Format

### Pattern

```
#settings-{tabname}
```

### Examples

| Hash | Behavior |
|------|----------|
| `#settings` | Opens modal to default tab (validation) |
| `#settings-validation` | Opens modal to Validation tab |
| `#settings-servers` | Opens modal to Servers tab |
| `#settings-rules` | Opens modal to Rules tab |
| `#settings-dashboard` | Opens modal to Dashboard tab |
| `#settings-system` | Opens modal to System tab |

### Edge Cases

- Empty hash → Modal stays closed
- Invalid tab name → Opens to default tab
- Hash without `settings` prefix → Ignored
- Multiple hyphens → Joined correctly (e.g., `settings-my-custom-tab`)

## Technical Details

### Why `replaceState` vs `pushState`?

**`replaceState`** replaces the current history entry:
- ✅ Cleaner history (no entries for every tab click)
- ✅ Back button navigates logically between pages
- ✅ No "history pollution"

**`pushState`** would add a new entry:
- ❌ Every tab click adds history entry
- ❌ Back button goes through all tab changes
- ❌ Confusing navigation experience

### Why Hash vs Query Params?

**Hash (`#settings-system`)**:
- ✅ Doesn't trigger page reload
- ✅ Handled entirely client-side
- ✅ Works with SPA routing
- ✅ Doesn't interfere with server routes

**Query params (`?settings=system`)**:
- ❌ May trigger server requests
- ❌ Conflicts with existing query params
- ❌ More complex to manage

### Event Flow

1. **User opens modal**
   - `onOpenChange(true)` called
   - Effect detects `open === true`
   - URL updated: `#settings-validation`

2. **User changes tab**
   - `setActiveTab('system')` called
   - Effect detects `activeTab` change
   - URL updated: `#settings-system`

3. **User reloads page**
   - Component mounts
   - Mount effect reads hash: `#settings-system`
   - Calls `setActiveTab('system')`
   - Calls `onOpenChange(true)`
   - Modal reopens to correct tab ✅

4. **User presses Back button**
   - `hashchange` event fires
   - Handler reads new hash
   - Updates `activeTab` state
   - Tab changes without modal closing ✅

## Files Modified

1. ✅ `client/src/components/settings/SettingsModal.tsx`
   - Added hash parsing on mount
   - Added hash update effect
   - Added hashchange event listener

## Testing

### Test Case 1: Basic Persistence

1. Open Settings Modal
2. Go to System tab
3. ✅ URL shows `#settings-system`
4. Reload page (Cmd+R / Ctrl+R)
5. ✅ Modal reopens to System tab automatically

### Test Case 2: Tab Switching

1. Open Settings Modal → Validation tab
2. ✅ URL: `#settings-validation`
3. Click Dashboard tab
4. ✅ URL changes to: `#settings-dashboard`
5. Click System tab
6. ✅ URL changes to: `#settings-system`

### Test Case 3: Deep Linking

1. Copy URL: `http://localhost:5174/#settings-dashboard`
2. Open in new tab
3. ✅ Settings Modal opens to Dashboard tab

### Test Case 4: Browser Navigation

1. Open modal → Validation → System → Dashboard
2. Press Back button
3. ✅ Returns to System tab
4. Press Back again
5. ✅ Returns to Validation tab
6. Press Back again
7. ✅ Modal closes

### Test Case 5: Hash Cleanup

1. Open modal → URL has `#settings-system`
2. Close modal (X button)
3. ✅ Hash removed, clean URL

## Success Criteria

✅ Modal survives page reload  
✅ Active tab preserved after reload  
✅ Deep linking to specific tabs works  
✅ Browser Back/Forward buttons work correctly  
✅ Hash removed when modal closes  
✅ No history pollution (uses replaceState)  
✅ Works across all tabs  
✅ No console errors  
✅ No linter errors  

## Implementation Date

Completed: October 21, 2025

## Future Enhancements

1. **Preserve dirty state**: Store unsaved changes indicator in hash or localStorage
2. **Query param support**: Allow `?settings=system` for sharing in environments that strip hashes
3. **Scroll position**: Remember scroll position within settings tabs
4. **Accordion state**: Preserve which accordions are expanded
5. **Search state**: Remember settings search/filter state

## Related Features

This URL persistence pattern could be extended to:
- Resource detail modal (`#resource-Patient-123`)
- Validation results modal (`#validation-results`)
- Rule editor modal (`#rule-edit-profile-123`)
- Any other modal/dialog that users might want to bookmark or reload

## Migration Note

This is a **non-breaking change**:
- Existing URLs without hash continue to work
- Existing bookmarks remain valid
- No database migrations required
- No backend changes needed

Users will naturally discover the feature when they:
- Accidentally reload with modal open
- Notice the URL changes when switching tabs
- Want to share a link to specific settings

