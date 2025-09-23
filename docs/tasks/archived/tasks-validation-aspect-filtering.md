# Task List: Validation Aspect Filtering System

## Relevant Files

- `client/src/hooks/use-validation-aspect-filtering.ts` - Custom hook for managing validation aspect filtering state across components
- `client/src/hooks/use-validation-aspect-filtering.test.ts` - Unit tests for validation aspect filtering hook
- `client/src/components/ui/validation-aspects-dropdown.tsx` - Updated dropdown component to emit filtering events
- `client/src/components/dashboard/validation-stats-card.tsx` - Dashboard validation statistics with aspect filtering
- `client/src/components/dashboard/validation-stats-card.test.tsx` - Unit tests for validation stats card filtering
- `client/src/components/dashboard/validation-aspect-breakdown-chart.tsx` - Aspect breakdown chart with filtering
- `client/src/components/dashboard/validation-aspect-breakdown-chart.test.tsx` - Unit tests for aspect breakdown filtering
- `client/src/components/resources/resource-list.tsx` - Resource list with filtered validation status display
- `client/src/components/resources/resource-list.test.tsx` - Unit tests for resource list filtering
- `client/src/components/validation/validation-errors.tsx` - Validation errors component with aspect filtering
- `client/src/components/validation/validation-errors.test.tsx` - Unit tests for validation errors filtering
- `client/src/pages/dashboard.tsx` - Updated dashboard to use validation aspect filtering
- `client/src/pages/resource-browser.tsx` - Updated resource browser to use validation aspect filtering
- `client/src/pages/resource-detail.tsx` - Updated resource detail to use validation aspect filtering
- `shared/types/validation.ts` - Updated validation types to include aspect filtering information
- `shared/validation-settings.ts` - Updated default settings to include Structural, Profile, Terminology as default

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Create Validation Aspect Filtering State Management
  - [ ] 1.1 Create custom hook `use-validation-aspect-filtering.ts` for centralized aspect filtering state
  - [ ] 1.2 Implement aspect filtering logic that determines which aspects are currently selected for display
  - [ ] 1.3 Add event emission system to notify components when aspect selection changes
  - [ ] 1.4 Set default aspects to Structural, Profile, Terminology as specified
  - [ ] 1.5 Add persistence of aspect filtering preferences in localStorage
  - [ ] 1.6 Create unit tests for the validation aspect filtering hook

- [ ] 2.0 Update Validation Aspects Dropdown Component
  - [ ] 2.1 Modify `validation-aspects-dropdown.tsx` to emit filtering events instead of just validation settings changes
  - [ ] 2.2 Add visual indicators to show which aspects are selected for filtering vs validation
  - [ ] 2.3 Implement separate toggle states for validation enabled vs display filtering
  - [ ] 2.4 Add tooltip explanations for the difference between validation and filtering
  - [ ] 2.5 Update dropdown to use the new validation aspect filtering hook

- [ ] 3.0 Implement Dashboard Component Filtering
  - [ ] 3.1 Update `validation-stats-card.tsx` to filter validation statistics by selected aspects
  - [ ] 3.2 Modify `validation-aspect-breakdown-chart.tsx` to show only selected aspects
  - [ ] 3.3 Add real-time updates when aspect filtering changes in dashboard
  - [ ] 3.4 Update validation progress indicators to reflect filtered aspects
  - [ ] 3.5 Add visual indicators showing which aspects are currently filtered
  - [ ] 3.6 Create unit tests for dashboard filtering functionality

- [ ] 4.0 Implement Resource Browser Filtering
  - [ ] 4.1 Update `resource-list.tsx` to filter validation status display by selected aspects
  - [ ] 4.2 Modify resource validation counts to reflect only selected aspects
  - [ ] 4.3 Add real-time updates when aspect filtering changes in resource browser
  - [ ] 4.4 Update resource search and filtering to work with aspect-filtered results
  - [ ] 4.5 Add visual indicators in resource browser showing active aspect filters
  - [ ] 4.6 Create unit tests for resource browser filtering functionality

- [ ] 5.0 Implement Resource Detail Filtering
  - [ ] 5.1 Update `validation-errors.tsx` to filter validation errors by selected aspects
  - [ ] 5.2 Modify validation error counts and statistics in resource detail view
  - [ ] 5.3 Add real-time updates when aspect filtering changes in resource details
  - [ ] 5.4 Update validation progress indicators for individual resources
  - [ ] 5.5 Add aspect-specific validation result grouping and display
  - [ ] 5.6 Create unit tests for resource detail filtering functionality

- [ ] 6.0 Update Page Components to Use Filtering
  - [ ] 6.1 Integrate validation aspect filtering hook in `dashboard.tsx`
  - [ ] 6.2 Integrate validation aspect filtering hook in `resource-browser.tsx`
  - [ ] 6.3 Integrate validation aspect filtering hook in `resource-detail.tsx`
  - [ ] 6.4 Add aspect filtering state synchronization across all pages
  - [ ] 6.5 Ensure consistent aspect filtering behavior across all validation-related components

- [ ] 7.0 Update Shared Types and Default Settings
  - [ ] 7.1 Update `shared/types/validation.ts` to include aspect filtering types
  - [ ] 7.2 Modify `shared/validation-settings.ts` to set Structural, Profile, Terminology as default selected aspects
  - [ ] 7.3 Add validation aspect filtering interfaces and type definitions
  - [ ] 7.4 Update validation result types to support aspect-specific filtering
  - [ ] 7.5 Add aspect filtering configuration to validation settings schema

- [ ] 8.0 Testing and Validation
  - [ ] 8.1 Create integration tests for aspect filtering across all components
  - [ ] 8.2 Test aspect filtering with different combinations of selected aspects
  - [ ] 8.3 Validate that filtering works correctly with real validation data
  - [ ] 8.4 Test aspect filtering state persistence across browser sessions
  - [ ] 8.5 Verify that aspect filtering updates in real-time across all components
  - [ ] 8.6 Test edge cases (no aspects selected, all aspects selected, single aspect selected)

- [ ] 9.0 Documentation and User Experience
  - [ ] 9.1 Add tooltips and help text explaining aspect filtering vs validation settings
  - [ ] 9.2 Update component documentation to reflect aspect filtering functionality
  - [ ] 9.3 Add visual indicators showing when aspect filtering is active
  - [ ] 9.4 Ensure consistent user experience across all validation-related components
  - [ ] 9.5 Add keyboard shortcuts for quick aspect filtering (optional enhancement)

