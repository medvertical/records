# Task List: Update Validation Display to Respect Validation Aspects Settings

## Relevant Files

- `client/src/components/dashboard/validation-chart.tsx` - Pie chart showing valid vs error resources
- `client/src/components/dashboard/validation-stats-card.tsx` - Success rate, validation coverage, progress bars
- `client/src/components/dashboard/validation-trends.tsx` - Trend charts and progress indicators
- `client/src/components/dashboard/resource-breakdown.tsx` - Resource type breakdown with validation stats
- `client/src/components/resources/resource-list.tsx` - Validation badges, status indicators, progress circles
- `client/src/pages/resource-detail.tsx` - Validation summary calculation and display
- `client/src/components/resources/resource-viewer.tsx` - Validation results display, issue filtering, summary badges
- `client/src/pages/dashboard.tsx` - Dashboard validation engine card and recent activity
- `client/src/pages/dashboard-new.tsx` - New dashboard implementation
- `server/services/dashboard-service.ts` - Server-side validation statistics calculation
- `server/storage.ts` - Database validation statistics with settings filtering
- `server/routes.ts` - API endpoints for validation progress and statistics

### Notes

- The server-side `getResourceStatsWithSettings()` method already exists and correctly filters validation results based on current settings
- The validation engine correctly applies settings during validation and stores filtered results
- The main issue is that the frontend display components don't consistently use the filtered validation data
- All components should use the `isValid` field from validation results, which is already filtered by settings
- When validation settings change, all cached data should be invalidated to ensure consistency

## Tasks

- [ ] 1.0 Update Dashboard Validation Components
  - [ ] 1.1 Update `validation-chart.tsx` to use filtered validation data from server
  - [ ] 1.2 Update `validation-stats-card.tsx` to respect validation aspects settings
  - [ ] 1.3 Update `validation-trends.tsx` to show trends based on current settings
  - [ ] 1.4 Update `resource-breakdown.tsx` to show breakdown respecting current settings
  - [ ] 1.5 Ensure all dashboard components invalidate cache when validation settings change

- [ ] 2.0 Update Resource List View Validation Display
  - [ ] 2.1 Update `getValidationStatus()` function in `resource-list.tsx` to use filtered validation data
  - [ ] 2.2 Update `renderValidationBadge()` function to show correct counts based on settings
  - [ ] 2.3 Ensure validation badges reflect current validation aspects settings
  - [ ] 2.4 Update progress circles to show accurate validation scores

- [ ] 3.0 Update Resource Detail View Validation Display
  - [ ] 3.1 Update validation summary calculation in `resource-detail.tsx` to use filtered data
  - [ ] 3.2 Update `resource-viewer.tsx` validation results display to respect settings
  - [ ] 3.3 Update `OptimizedValidationResults` component to filter issues by current settings
  - [ ] 3.4 Update validation summary badges to show correct counts
  - [ ] 3.5 Ensure issue categorization respects validation aspects settings

- [ ] 4.0 Update Server-Side Validation Statistics
  - [ ] 4.1 Ensure `dashboard-service.ts` uses `getResourceStatsWithSettings()` consistently
  - [ ] 4.2 Update all API endpoints to return filtered validation statistics
  - [ ] 4.3 Update `/api/validation/bulk/progress` to respect current settings
  - [ ] 4.4 Update `/api/dashboard/stats` to use filtered validation data
  - [ ] 4.5 Update `/api/validation/errors/recent` to respect validation aspects settings

- [ ] 5.0 Update Validation Charts and Graphs
  - [ ] 5.1 Update pie charts to show valid/error counts based on current settings
  - [ ] 5.2 Update progress bars to reflect filtered validation results
  - [ ] 5.3 Update trend charts to show trends based on current validation aspects
  - [ ] 5.4 Ensure all charts update when validation settings change

- [ ] 6.0 Update Recent Errors Display
  - [ ] 6.1 Update dashboard recent activity to show errors based on current settings
  - [ ] 6.2 Update error counts and summaries to respect validation aspects
  - [ ] 6.3 Ensure recent errors list filters correctly based on settings
  - [ ] 6.4 Update error severity indicators to match current settings

- [ ] 7.0 Update Validation Progress Display
  - [ ] 7.1 Update dashboard validation engine card to show progress based on current settings
  - [ ] 7.2 Update WebSocket progress updates to respect validation aspects
  - [ ] 7.3 Update progress percentages to reflect filtered validation results
  - [ ] 7.4 Ensure progress display is consistent with current settings

- [ ] 8.0 Update Validation Summary Badges
  - [ ] 8.1 Update all validation summary badges to use filtered validation data
  - [ ] 8.2 Ensure badge colors and counts reflect current validation aspects
  - [ ] 8.3 Update validation score displays to be consistent with settings
  - [ ] 8.4 Ensure all badges update when validation settings change

- [ ] 9.0 Implement Cache Invalidation for Settings Changes
  - [ ] 9.1 Add WebSocket listener for validation settings changes in all components
  - [ ] 9.2 Invalidate TanStack Query caches when validation settings change
  - [ ] 9.3 Ensure all components refresh data when settings are updated
  - [ ] 9.4 Add proper error handling for settings change notifications

- [ ] 10.0 Testing and Validation
  - [ ] 10.1 Test all dashboard components with different validation aspect combinations
  - [ ] 10.2 Test resource list view with various validation settings
  - [ ] 10.3 Test resource detail view with different validation aspects enabled/disabled
  - [ ] 10.4 Test that changing validation settings immediately updates all displays
  - [ ] 10.5 Verify that all validation statistics are consistent across the application
  - [ ] 10.6 Test edge cases (all aspects disabled, single aspect enabled, etc.)
