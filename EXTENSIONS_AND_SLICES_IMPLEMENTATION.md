# Extensions and Slices Tree Implementation

## Summary

Successfully implemented visual rendering of FHIR extensions and slices within the resource detail tree view, making them easily identifiable with special formatting and auto-detection.

## Implementation Details

### 1. Created FHIR Helper Utilities (`fhir-helpers.ts`)

**Location**: `client/src/components/resources/unified-tree-viewer/fhir-helpers.ts`

**Functions**:
- `isExtensionField()` - Detects if a field is `extension` or `modifierExtension`
- `extractExtensionInfo()` - Extracts URL, value, type, and display name from extension objects
- `getExtensionDisplayName()` - Converts extension URLs to readable names (e.g., "http://hl7.org/fhir/StructureDefinition/patient-birthPlace" → "Birth Place")
- `detectSliceName()` - Auto-detects slice names from common discriminator patterns (system, use, type, code, profile, contentType)
- `isExtensionObject()` - Checks if a value is an extension object

**Key Features**:
- Smart URL parsing to extract meaningful display names
- Support for common FHIR discriminator patterns
- Special handling for identifier, telecom, name, and address arrays

### 2. Updated Type Definitions (`types.ts`)

**Added interfaces**:
- `ExtensionInfo` - Contains url, valueType, value, displayName, isModifier
- `SliceInfo` - Contains name and discriminator

**Updated interfaces**:
- `TreeNodeProps` - Added `isExtension`, `extensionInfo`, `sliceName` props
- `ContainerProps` - Added `parentKey` prop for slice detection

### 3. Enhanced TreeNode Component

**Location**: `client/src/components/resources/unified-tree-viewer/TreeNode.tsx`

**Visual Enhancements**:

#### Extensions:
- 🔌 Icon displayed before extension names
- Display name shown instead of array index
- Extension URL shown in muted text
- Value displayed inline with type-specific coloring
- "modifier" badge for modifier extensions
- Purple text color and hover effect (hover:bg-purple-50)

#### Slices:
- Blue badge showing slice name next to array index
- Detected from common patterns (system, use, type, etc.)
- Blue hover effect (hover:bg-blue-50)

**Example Extension Display**:
```
🔌 Birth Place
   http://hl7.org/fhir/StructureDefinition/patient-birthPlace → "Boston, MA"
```

**Example Slice Display**:
```
[0] [official]    <- Slice badge for identifier with use="official"
[1] [phone]       <- Slice badge for telecom with system="phone"
```

### 4. Updated ArrayContainer

**Location**: `client/src/components/resources/unified-tree-viewer/ArrayContainer.tsx`

**Features**:
- Detects if array is an extension array (`extension` or `modifierExtension`)
- Extracts extension information for each array item
- Detects slice names for non-extension arrays using discriminator patterns
- Passes `isExtension`, `extensionInfo`, and `sliceName` to TreeNode
- Passes `parentKey` for context-aware slice detection

### 5. Updated ObjectContainer

**Location**: `client/src/components/resources/unified-tree-viewer/ObjectContainer.tsx`

**Features**:
- Identifies extension fields using `isExtensionField()`
- Passes `parentKey` to TreeNode for proper context propagation

## Visual Design

### Extensions
- **Icon**: 🔌 (plug emoji) to represent "extension"
- **Color**: Purple (#7c3aed) for text, purple-50 for hover
- **Layout**: `🔌 Display Name` with URL in small gray text
- **Value**: Shown inline with arrow (→) separator
- **Modifier Badge**: Orange badge for modifier extensions

### Slices
- **Badge**: Light blue badge with slice name
- **Color**: Blue (#2563eb) for badge, blue-50 for hover
- **Position**: Next to array index, e.g., `[0] [official]`
- **Detection**: Automatic based on discriminator fields

## Supported Discriminator Patterns

The implementation auto-detects slices based on these common FHIR discriminators:
1. `system` - CodeableConcept, Identifier, Coding
2. `use` - ContactPoint, Identifier, HumanName
3. `type` - Identifier, CodeableConcept
4. `code` - Coding
5. `profile` - Reference
6. `contentType` - Attachment

Special handling for:
- **identifier**: Uses `system` value
- **telecom**: Uses `system` value (phone, email, etc.)
- **name**: Uses `use` value (official, maiden, etc.)
- **address**: Uses `use` value (home, work, etc.)

## Testing

- ✅ Build successful with no TypeScript errors
- ✅ All linter checks passed
- ✅ Type safety maintained throughout

## Examples

### Patient Resource with Extensions
```
Patient
  ├─ id: "example-patient"
  ├─ name: Array[2]
  │   ├─ [0] [official]
  │   │   ├─ use: "official"
  │   │   ├─ family: "Smith"
  │   │   └─ given: Array[1]
  │   └─ [1] [maiden]
  │       └─ family: "Jones"
  ├─ extension: Array[2]
  │   ├─ 🔌 Birth Place
  │   │   └─ http://hl7.org/.../patient-birthPlace → "Boston, MA"
  │   └─ 🔌 Religion
  │       └─ http://hl7.org/.../patient-religion → {CodeableConcept}
  └─ identifier: Array[2]
      ├─ [0] [http://hospital.org]
      │   ├─ system: "http://hospital.org"
      │   └─ value: "12345"
      └─ [1] [urn:oid:2.16.840.1.113883.4.1]
          ├─ system: "urn:oid:2.16.840.1.113883.4.1"
          └─ value: "123-45-6789"
```

## Benefits

1. **Improved Readability**: Extensions and slices are immediately identifiable
2. **Better UX**: Users can understand resource structure at a glance
3. **Auto-Detection**: No manual configuration needed
4. **Consistent Design**: Maintains tree structure while adding visual distinction
5. **Type Safety**: Full TypeScript support with proper type definitions

## Files Modified

1. `client/src/components/resources/unified-tree-viewer/fhir-helpers.ts` (new file)
2. `client/src/components/resources/unified-tree-viewer/types.ts`
3. `client/src/components/resources/unified-tree-viewer/TreeNode.tsx`
4. `client/src/components/resources/unified-tree-viewer/ArrayContainer.tsx`
5. `client/src/components/resources/unified-tree-viewer/ObjectContainer.tsx`

## Future Enhancements

Potential improvements for future iterations:
- Load extension definitions from StructureDefinition resources
- Show slice definitions from profile constraints
- Add tooltips with full extension/slice documentation
- Support for nested extensions
- Filtering/searching by extension URL or slice name

