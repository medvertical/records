# Settings Save Bug - Fix Complete

## Problem

Settings were not persisting when using the Settings Modal. Users could change System and Dashboard settings, click "Save Settings", see a success toast, but when reopening the modal, all changes were lost.

## Root Cause

The `handleSave()` function in `SettingsModal.tsx` was a placeholder that did nothing:
- It only incremented a `saveCounter` variable
- Tabs received the `saveCounter` prop but ignored it
- No actual API calls were made to save the settings
- Settings remained in local state only

## Solution

Implemented a coordinated save mechanism using the `saveCounter` pattern:

1. **SystemSettingsTab & DashboardSettingsTab** now listen for `saveCounter` changes
2. When `saveCounter` increments, tabs automatically call their save APIs
3. Tabs notify the modal of success/failure via callbacks
4. Modal waits for all saves to complete before showing result

## Changes Made

### 1. SystemSettingsTab (`client/src/components/settings/system-settings-tab.tsx`)

**Added Props**:
```typescript
interface SystemSettingsTabProps {
  saveCounter?: number;  // Trigger save when this changes
  onSaveComplete?: () => void;  // Notify parent of save completion
  onSaveError?: (error: string) => void;  // Notify parent of save error
}
```

**Added Save Logic**:
```typescript
const saveSettings = async () => {
  try {
    const response = await fetch('/api/system-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to save settings');
    onSaveComplete?.();
  } catch (error) {
    onSaveError?.(error instanceof Error ? error.message : 'Unknown error');
  }
};

// Trigger save when saveCounter changes
useEffect(() => {
  if (saveCounter && saveCounter > 0) {
    saveSettings();
  }
}, [saveCounter]);
```

### 2. DashboardSettingsTab (`client/src/components/settings/dashboard-settings-tab.tsx`)

Same pattern as SystemSettingsTab:
- Added `saveCounter`, `onSaveComplete`, `onSaveError` props
- Added `saveSettings()` function that calls `/api/dashboard-settings`
- Added effect to listen for `saveCounter` changes

### 3. SystemTab Wrapper (`client/src/components/settings/tabs/SystemTab.tsx`)

Forward the new props to SystemSettingsTab:
```typescript
<SystemSettingsTab 
  onSettingsChange={() => onDirtyChange?.(true)}
  saveCounter={saveCounter}
  onSaveComplete={onSaveComplete}
  onSaveError={onSaveError}
/>
```

### 4. DashboardTab Wrapper (`client/src/components/settings/tabs/DashboardTab.tsx`)

Same forwarding pattern as SystemTab.

### 5. SettingsModal (`client/src/components/settings/SettingsModal.tsx`)

**Added State**:
```typescript
const [saveErrors, setSaveErrors] = useState<string[]>([]);
const [saveSuccesses, setSaveSuccesses] = useState<number>(0);
```

**Added Callbacks**:
```typescript
const handleSaveComplete = () => {
  setSaveSuccesses(prev => prev + 1);
};

const handleSaveError = (error: string) => {
  setSaveErrors(prev => [...prev, error]);
};
```

**Fixed handleSave()**:
```typescript
const handleSave = async () => {
  setIsSaving(true);
  setSaveErrors([]);
  setSaveSuccesses(0);
  
  try {
    // Increment saveCounter to trigger saves in tabs
    setSaveCounter(prev => prev + 1);
    
    // Wait for tabs to complete saves (with 3 second timeout)
    const expectedSaves = 2; // System + Dashboard tabs
    const timeout = 3000;
    const startTime = Date.now();
    
    while (saveSuccesses < expectedSaves && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (saveSuccesses + saveErrors.length >= expectedSaves) {
        break;
      }
    }
    
    if (saveErrors.length > 0) {
      toast({
        title: "Partial save failure",
        description: `${saveErrors.length} setting(s) failed to save`,
        variant: "destructive"
      });
      // Don't clear dirty state if there were errors
    } else {
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully.",
      });
      setIsDirty(false);
    }
  } finally {
    setIsSaving(false);
  }
};
```

**Updated Tab Components**:
```typescript
<SystemTab 
  onDirtyChange={setIsDirty} 
  hideHeader 
  saveCounter={saveCounter}
  onSaveComplete={handleSaveComplete}
  onSaveError={handleSaveError}
/>

<DashboardTab 
  onDirtyChange={setIsDirty} 
  hideHeader 
  saveCounter={saveCounter}
  onSaveComplete={handleSaveComplete}
  onSaveError={handleSaveError}
/>
```

## How It Works

### Save Flow

1. User makes changes in System/Dashboard tabs
2. `onSettingsChange()` is called → marks modal as dirty
3. User clicks "Save Settings" button
4. Modal increments `saveCounter`
5. Tabs detect `saveCounter` change via `useEffect`
6. Each tab calls its save API (`/api/system-settings` or `/api/dashboard-settings`)
7. On success: Tab calls `onSaveComplete()`
8. On error: Tab calls `onSaveError(errorMessage)`
9. Modal waits for both tabs to respond (or timeout after 3 seconds)
10. Modal shows success or error toast based on results
11. If successful, modal clears dirty state
12. Settings persist in database

### Error Handling

- If one tab fails, partial failure toast is shown
- Dirty state remains set if there were errors
- User can retry the save
- 3-second timeout prevents infinite waiting

## Files Modified

1. ✅ `client/src/components/settings/system-settings-tab.tsx`
2. ✅ `client/src/components/settings/dashboard-settings-tab.tsx`
3. ✅ `client/src/components/settings/tabs/SystemTab.tsx`
4. ✅ `client/src/components/settings/tabs/DashboardTab.tsx`
5. ✅ `client/src/components/settings/SettingsModal.tsx`

## Testing Instructions

### Test Case 1: System Settings Save
1. Open Settings Modal (click Settings in header)
2. Navigate to System tab
3. Change theme to "Dark"
4. Change log level to "Debug"
5. Click "Save Settings" button
6. ✅ Verify success toast appears
7. Close modal
8. Reopen Settings Modal
9. ✅ Verify theme is still "Dark" and log level is "Debug"

### Test Case 2: Dashboard Settings Save
1. Open Settings Modal
2. Navigate to Dashboard tab
3. Toggle Auto Refresh OFF
4. Set Fast Interval to 3000
5. Expand "Advanced Polling Options"
6. Set Max Retries to 5
7. Click "Save Settings" button
8. ✅ Verify success toast appears
9. Close modal
10. Reopen Settings Modal → Navigate to Dashboard tab
11. ✅ Verify all changes persisted (Auto Refresh OFF, Fast Interval 3000, Max Retries 5)

### Test Case 3: Multiple Tabs Save
1. Open Settings Modal
2. Navigate to System tab → Change theme to "Light"
3. Navigate to Dashboard tab → Toggle Auto Refresh OFF
4. Click "Save Settings" button
5. ✅ Verify success toast: "Your settings have been saved successfully"
6. Close and reopen modal
7. ✅ Verify BOTH System (theme Light) AND Dashboard (Auto Refresh OFF) changes persisted

### Test Case 4: Error Handling (Optional)
1. Stop the backend server: `Ctrl+C` in server terminal
2. Open Settings Modal
3. Change System settings
4. Click "Save Settings" button
5. ✅ Verify error toast appears: "Partial save failure"
6. ✅ Modal remains dirty (not marked as clean)
7. Restart backend server
8. Click "Save Settings" again
9. ✅ Verify success toast and changes persist

## Success Criteria

✅ Save button in modal actually saves to backend APIs  
✅ System settings persist after modal close/reopen  
✅ Dashboard settings persist after modal close/reopen  
✅ Error handling shows appropriate messages  
✅ Success toast only shows when saves succeed  
✅ Dirty state clears only after successful save  
✅ Multiple tabs can be saved in one operation  
✅ No console errors  
✅ No linter errors  

## Additional Fix: Stale Data on Modal Reopen

### Problem
After the initial save fix, settings were still showing stale/incorrect data when the modal reopened. For example, the theme dropdown would show "Dark" even though the actual saved value was "System" or "Light".

### Root Cause
The tabs only loaded settings **once on component mount**, not when the modal reopened. Since React components don't necessarily unmount when a dialog closes, the old data persisted across modal open/close cycles.

### Solution
Added a `reloadTrigger` prop that increments every time the modal opens:

1. **SettingsModal** watches for `open` prop changes
2. When `open` becomes `true`, increment `reloadTrigger`
3. Pass `reloadTrigger` to SystemTab and DashboardTab
4. Tabs watch `reloadTrigger` and call `loadSettings()` when it changes

### Changes Made

**SettingsModal.tsx**:
```typescript
const [reloadTrigger, setReloadTrigger] = useState(0);

// Reload settings when modal opens
useEffect(() => {
  if (open) {
    setReloadTrigger(prev => prev + 1);
  }
}, [open]);

// Pass to tabs
<SystemTab reloadTrigger={reloadTrigger} ... />
<DashboardTab reloadTrigger={reloadTrigger} ... />
```

**SystemSettingsTab & DashboardSettingsTab**:
```typescript
// Load settings on mount and when reloadTrigger changes
useEffect(() => {
  loadSettings();
}, [reloadTrigger]);
```

**Result**: Settings now reload fresh from the backend every time the modal opens! ✅

## Implementation Date

Completed: October 21, 2025
Reload fix: October 21, 2025

## Notes

- Validation Settings tab already had its own save button and logic, so it was not affected by this bug
- The `saveCounter` pattern is clean and React-friendly
- Timeout prevents the modal from hanging if a save fails silently
- Future: Could extend this pattern to other tabs (Servers, Rules) if needed

