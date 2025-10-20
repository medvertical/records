# Settings Modal Implementation Status

## ✅ Completed (Part 1-5)

### Part 1: Modal Foundation & Layout
- ✅ Created `SettingsModal.tsx` with Dialog, vertical Tabs, ScrollArea
- ✅ Extended `tabs.tsx` with vertical orientation styling
- ✅ Created shared components:
  - `SaveFooter.tsx` - Global save/reset footer
  - `SettingSection.tsx` - Reusable section wrapper
  - `SectionHeader.tsx` - Consistent section headers

### Part 2: State Management
- ✅ Created `use-settings-modal.ts` hook for modal state
- ✅ Created `settings-modal-context.tsx` for global modal control
- ✅ Provider integrated into App.tsx

### Part 3: Backend Schema
- ✅ Extended `ValidationAspectConfig` interface with optional `engine` field
- ✅ Added engine type definitions for each aspect:
  - `StructuralValidationEngine`: 'schema' | 'hapi' | 'server'
  - `ProfileValidationEngine`: 'hapi' | 'server' | 'auto'
  - `TerminologyValidationEngine`: 'server' | 'ontoserver' | 'cached'
  - `ReferenceValidationEngine`: 'internal' | 'server'
  - `BusinessRuleValidationEngine`: 'fhirpath' | 'custom'
  - `MetadataValidationEngine`: 'schema' | 'hapi'
- ✅ Updated default settings with engine defaults

### Part 4: Modal Control & Routing
- ✅ Updated App.tsx to integrate SettingsModal
- ✅ Removed `/settings` route, redirects to modal
- ✅ Updated sidebar to trigger modal instead of navigation
- ✅ Modal renders globally, controlled by context

### Part 5: Keyboard Shortcuts & UX
- ✅ Added keyboard shortcut support:
  - `s` key opens settings
  - `Cmd+,` (Mac) / `Ctrl+,` (Windows) opens settings
- ✅ Added keyboard shortcut event listener in Router
- ✅ Implemented unsaved changes warning dialog with options:
  - Cancel
  - Discard Changes
  - Save & Close

## 🚧 Remaining Work

### Part 6: Tab Content Enhancement
The existing tab components work but need enhancement:

#### ValidationTab
- [ ] Add per-aspect engine selector UI
- [ ] Add engine dropdown for each aspect:
  - Structural: [Schema (default) | HAPI | Server]
  - Profile: [HAPI (default) | Server | Auto]
  - Terminology: [Server (default) | Ontoserver | Cached]
  - Reference: [Internal (default) | Server]
  - Business Rules: [FHIRPath (default) | Custom]
  - Metadata: [Schema (default) | HAPI]
- [ ] Move terminology servers section to ServersTab
- [ ] Reorganize into SettingSection components
- [ ] Remove individual save button (use footer)

#### ServersTab
- [x] Keep existing FHIR server management (no changes needed)
- [ ] Add terminology servers section (move from ValidationTab)
- [ ] Group into SettingSection wrappers

#### RulesTab
- [x] Keep existing CRUD operations
- [ ] Add import/export rules functionality
- [ ] Add auto-apply rules toggle
- [ ] Enhance with filters/search

#### DashboardTab
- [x] Keep existing settings (already complete)
- [ ] Reorganize into SettingSection groups
- [ ] Remove individual save button

#### SystemTab
- [x] Keep existing settings
- [ ] Reorganize into SettingSection groups
- [ ] Remove individual save button

### Part 7: Unified Settings Hook
- [ ] Create `use-unified-settings.ts` to coordinate saves across all tabs
- [ ] Implement dirty state tracking across tabs
- [ ] Coordinate API calls to all settings endpoints
- [ ] Update SaveFooter to use unified hook

### Part 8: Testing & Polish
- [ ] Test modal open/close
- [ ] Test tab switching
- [ ] Test save/reset functionality
- [ ] Test keyboard shortcuts
- [ ] Test unsaved changes dialog
- [ ] Verify mobile responsiveness
- [ ] Performance validation

### Part 9: Cleanup
- [ ] Remove old `/client/src/pages/settings.tsx` (no longer used)
- [ ] Update any tests referencing old settings page
- [ ] Update documentation

## 📝 Implementation Notes

### Backend Compatibility
- All existing API endpoints unchanged:
  - `/api/validation/settings` - Extended with engine field
  - `/api/dashboard-settings` - No changes
  - `/api/system-settings` - No changes
  - `/api/servers` - No changes
  - `/api/validation/business-rules` - No changes

### Database Schema
- No table structure changes needed
- New `engine` field stored in existing JSONB columns
- Backward compatible (engine field optional, defaults provided)

### Per-Aspect Validation Engines
The key innovation is per-aspect engine selection:
- Each validation aspect can use a different validation method
- Sensible defaults: schema for structural, HAPI for profiles, etc.
- Users can override per aspect for fine-grained control

## 🎯 Next Steps

1. **Enhance ValidationTab** to show engine selectors for each aspect
2. **Move terminology servers** from ValidationTab to ServersTab
3. **Create unified settings hook** to coordinate saves
4. **Test end-to-end** functionality
5. **Clean up** old files

## 🔧 Files Modified

### Created
- `client/src/components/settings/SettingsModal.tsx`
- `client/src/components/settings/shared/SaveFooter.tsx`
- `client/src/components/settings/shared/SettingSection.tsx`
- `client/src/components/settings/shared/SectionHeader.tsx`
- `client/src/components/settings/shared/index.ts`
- `client/src/hooks/use-settings-modal.ts`
- `client/src/contexts/settings-modal-context.tsx`

### Modified
- `client/src/components/ui/tabs.tsx` - Added vertical orientation support
- `client/src/App.tsx` - Integrated modal, removed route, added shortcuts
- `client/src/components/layout/sidebar.tsx` - Trigger modal instead of navigate
- `client/src/hooks/use-keyboard-shortcuts.ts` - Added settings shortcuts
- `shared/validation-settings.ts` - Added engine types and defaults

## ✨ Features Implemented

1. ✅ Modal-based settings (replaces full page)
2. ✅ Vertical tab navigation (5 tabs)
3. ✅ Per-aspect validation engine selection (backend ready)
4. ✅ Global keyboard shortcuts (s, Cmd+,)
5. ✅ Unsaved changes warning
6. ✅ Shared save/reset footer
7. ✅ Context-based modal control
8. ✅ Route redirect (/settings → modal)
9. ✅ Backward compatible backend
10. ✅ TypeScript type safety

