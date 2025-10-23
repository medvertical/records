# Dark Mode Implementation with Experimental Badge

## Overview

Implemented dark mode functionality with experimental badge marking for the Dark theme option in System Settings.

## Changes Made

### 1. Added Experimental Badge to Dark Theme Option

**File**: `client/src/components/settings/system-settings-tab.tsx`

**Changes**:

1. **Added Badge Import**:
```typescript
import { Badge } from '@/components/ui/badge';
```

2. **Updated Theme Selector UI**:
```typescript
<div className="flex items-center gap-2">
  <Select
    value={settings.theme}
    onValueChange={(v) => update('theme', v)}
  >
    <SelectTrigger id="theme" className="flex-1">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="light">Light</SelectItem>
      <SelectItem value="dark">
        <div className="flex items-center gap-2">
          <span>Dark</span>
          <Badge variant="secondary" className="text-xs">Experimental</Badge>
        </div>
      </SelectItem>
      <SelectItem value="system">System Default</SelectItem>
    </SelectContent>
  </Select>
  {settings.theme === 'dark' && (
    <Badge variant="secondary" className="text-xs">Experimental</Badge>
  )}
</div>
```

**Features**:
- Experimental badge shown inside dropdown next to "Dark" option
- Experimental badge shown next to select trigger when Dark is selected
- Uses secondary variant badge with small text size

### 2. Implemented Dark Mode Switching

**File**: `client/src/components/settings/system-settings-tab.tsx`

**Added Effect**:
```typescript
// Apply theme to document root
useEffect(() => {
  const root = document.documentElement;
  
  if (settings.theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else if (settings.theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    // System theme - check system preference
    root.classList.remove('dark', 'light');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    }
  }
}, [settings.theme]);
```

**Behavior**:
- **Dark theme**: Applies `dark` class to `<html>` element
- **Light theme**: Applies `light` class to `<html>` element
- **System theme**: Removes manual classes and respects system preference via CSS media query
- Automatically updates when theme setting changes

## How It Works

### Theme Application Flow

1. **User selects theme** in Settings Modal → System tab
2. `update('theme', value)` called → updates local state
3. `useEffect` detects `settings.theme` change
4. Applies appropriate class to `document.documentElement`
5. CSS variables in `index.css` switch based on class:
   - `.dark { --background: hsl(240, 10%, 3.9%); ... }`
   - `:root { --background: hsl(0, 0%, 100%); ... }`

### System Theme Handling

When "System Default" is selected:
1. Removes `dark` and `light` classes
2. Checks `window.matchMedia('(prefers-color-scheme: dark)')`
3. If system prefers dark → adds `dark` class
4. Otherwise → uses default light theme

## CSS Foundation

The dark mode CSS is already defined in `client/src/index.css`:

**Light Mode (default)**:
```css
:root {
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(20, 14.3%, 4.1%);
  /* ... other light theme variables ... */
}
```

**Dark Mode**:
```css
.dark {
  --background: hsl(240, 10%, 3.9%);
  --foreground: hsl(0, 0%, 98%);
  /* ... other dark theme variables ... */
}
```

All UI components use these CSS variables via Tailwind classes:
- `bg-background`
- `text-foreground`
- `bg-card`, `text-card-foreground`
- etc.

## User Experience

### In Settings Modal

1. **Dropdown closed**:
   - Shows current selection (e.g., "System Default")
   - If "Dark" selected → shows "Dark" with Experimental badge

2. **Dropdown open**:
   - Light: plain text
   - Dark: text + "Experimental" badge (inline)
   - System Default: plain text

3. **After selection**:
   - Dark mode → UI immediately switches to dark theme
   - Badge remains visible next to dropdown
   - Setting is saved when user clicks "Save Settings"

### Visual Feedback

- **Immediate preview**: Theme applies in real-time as user selects it
- **Persistent indicator**: Experimental badge stays visible while Dark is selected
- **Clear labeling**: Users understand Dark mode is experimental/in-progress

## Testing

### Test Case 1: Dark Mode Selection

1. Open Settings Modal → System tab
2. Change Theme to "Dark"
3. ✅ Experimental badge appears next to "Dark" in dropdown
4. ✅ Experimental badge appears next to select trigger
5. ✅ UI switches to dark mode immediately
6. Click "Save Settings"
7. Close and reopen modal
8. ✅ Dark theme is still active
9. ✅ Badge still shows

### Test Case 2: Theme Switching

1. Set theme to "Dark" → ✅ Dark UI
2. Set theme to "Light" → ✅ Light UI
3. Set theme to "System Default" → ✅ Matches OS preference
4. Each change applies immediately ✅

### Test Case 3: System Theme Detection

1. Set theme to "System Default"
2. Check your OS theme:
   - If OS is dark → ✅ App shows dark theme
   - If OS is light → ✅ App shows light theme
3. Change OS theme (Mac: System Preferences → Appearance)
4. Reload app → ✅ Theme updates to match OS

## Implementation Details

### Why Apply to `document.documentElement`?

- `document.documentElement` === `<html>` element
- Root element for all CSS cascade
- Tailwind's dark mode utilities look for `.dark` on root
- Matches standard Tailwind dark mode implementation

### Why `useEffect` Instead of Event Handler?

- `useEffect` runs automatically on state change
- Ensures theme applies even on initial load
- Handles theme persistence from database
- Decouples theme application from user interaction

### Badge Placement Strategy

**In dropdown**: Users see it when making selection
**Next to trigger**: Constant reminder that feature is experimental

Both placements ensure users are aware of the experimental status.

## Future Improvements

1. **Persist theme separately**: Store theme preference in localStorage for instant application before settings load
2. **System theme listener**: Watch for OS theme changes and update automatically
3. **Smooth transitions**: Add CSS transitions for theme switching
4. **Remove experimental tag**: Once dark mode is stable and tested
5. **Theme preview**: Show preview of dark/light mode before applying

## Files Modified

1. ✅ `client/src/components/settings/system-settings-tab.tsx`
   - Added Badge import
   - Updated theme selector UI with experimental badge
   - Added theme application effect

## Success Criteria

✅ Dark mode option has "Experimental" badge in dropdown  
✅ Dark mode selection shows badge next to trigger  
✅ Dark mode actually switches UI to dark theme  
✅ Light mode switches UI to light theme  
✅ System theme respects OS preference  
✅ Theme applies immediately on selection  
✅ Theme persists after save and modal reopen  
✅ No console errors  
✅ No linter errors  

## Implementation Date

Completed: October 21, 2025

## Note on "Experimental" Label

The Experimental badge indicates:
- Dark mode is functional but may have edge cases
- Some UI elements may not have perfect dark mode styling
- Users should expect potential visual inconsistencies
- Feature is ready for testing but not production-certified

This is a standard practice for features in beta/preview state.

