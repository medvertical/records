# Engine Icon Catalog Implementation

## Overview
Implemented a comprehensive icon catalog for validation engines across the application. Icons are now displayed in validation messages and settings dropdowns.

## Implementation Details

### 1. Engine Icon Component
**File**: `client/src/components/validation/EngineIcon.tsx`

Created a centralized icon component that:
- Maps engine types to Lucide icons
- Provides consistent icon sizing and styling
- Exports helper functions for engine names and descriptions

#### Icon Mapping
| Engine | Icon | Description |
|--------|------|-------------|
| HAPI | `FileCode2` | HAPI FHIR Validator - document with code |
| Schema | `Layers` | Schema validator - layers/structure |
| Server/OntoServer | `Server` | Terminology/FHIR Server |
| Cached | `Database` | Cached terminology |
| Internal | `CheckCircle2` | Internal validator - check circle |
| FHIRPath/Custom | `Code2` | FHIRPath/Custom - code brackets |
| Auto | `Layers` | Auto detection - layers |

### 2. Validation Message Display
**File**: `client/src/components/validation/ValidationMessageItem.tsx`

Updated to show engine icon and name in the top-right corner of each validation message:
- Icon + engine name displayed together
- Muted foreground color for subtle appearance
- Tooltip shows full engine description
- Maps aspect to engine (e.g., `structural` → `hapi`)

### 3. Settings Validation Tab
**File**: `client/src/components/settings/shared/AspectCard.tsx`

Updated the engine selector dropdown to include icons:
- Icons in the select trigger (current selection)
- Icons in all dropdown options
- Consistent icon sizing (14px)
- Uses same icon mapping as validation messages

## Usage

### Getting Engine Icon
```typescript
import { EngineIcon } from '@/components/validation/EngineIcon';

<EngineIcon engine="hapi" size={14} />
```

### Getting Engine Name
```typescript
import { getEngineName } from '@/components/validation/EngineIcon';

const name = getEngineName('hapi'); // Returns "HAPI"
```

### Getting Engine Description
```typescript
import { getEngineDescription } from '@/components/validation/EngineIcon';

const desc = getEngineDescription('hapi'); // Returns "HAPI FHIR Validator"
```

## UI Locations

### 1. Resource Detail View
- Each validation message shows engine icon + name in top-right corner
- Replaces the plain text label from previous version
- Maintains muted styling for subtle appearance

### 2. Settings → Validation Tab → Validation Aspects
- Each aspect card has an "Engine" dropdown
- Dropdown trigger shows icon + engine name
- All dropdown options show icon + engine name
- Visual consistency across all aspect cards

## Testing Results

### Validation Messages
✅ Engine icon displays correctly  
✅ Engine name displays correctly  
✅ Tooltip shows engine description  
✅ Icons are appropriately sized (14px)  

### Settings Dropdowns
✅ All dropdown items have icons (3/3)  
✅ Icons match engine types (Schema, HAPI, Server)  
✅ Current selection shows icon in trigger  
✅ Consistent styling across all aspect cards  

## Benefits

1. **Visual Clarity**: Icons provide instant visual recognition of validation engines
2. **Consistency**: Same icons used across messages and settings
3. **Accessibility**: Text labels accompany icons, tooltips provide descriptions
4. **Maintainability**: Centralized icon mapping makes updates easy
5. **Extensibility**: Easy to add new engine types to the catalog

## Files Modified

1. `client/src/components/validation/EngineIcon.tsx` (NEW)
2. `client/src/components/validation/ValidationMessageItem.tsx`
3. `client/src/components/settings/shared/AspectCard.tsx`

## Related Documentation

- Validation Settings: `SETTINGS_IMPLEMENTATION_COMPLETE.md`
- Validation Messages: `VALIDATION_TAB_IMPLEMENTATION_COMPLETE.md`
- HAPI Validation: `HAPI_VALIDATION_PARITY_IMPLEMENTATION.md`

