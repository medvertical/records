# Task List: Batch Validation Workflow Implementation

## Relevant Files

- `client/src/hooks/use-validation-polling.ts` - Updated polling hook with 3-second automatic intervals
- `client/src/hooks/use-validation-polling.test.ts` - Unit tests for updated polling functionality
- `client/src/pages/dashboard.tsx` - Updated dashboard with automatic polling and enhanced progress display
- `client/src/components/ui/validation-aspects-dropdown.tsx` - Enhanced dropdown with batch configuration
- `shared/validation-settings.ts` - Updated validation settings schema with batch configuration
- `shared/validation-settings-validator.ts` - Updated validation settings validator
- `server/services/validation/validation-settings-service.ts` - Updated service to handle batch settings
- `server/routes.ts` - Updated validation endpoints to support batch configuration
- `server/services/validation/unified-validation.ts` - Enhanced validation service with retry logic
- `server/services/validation/validation-engine.ts` - Updated engine with resource type filtering
- `client/src/components/dashboard/validation-stats-card.tsx` - Enhanced stats display with resource type progress
- `client/src/components/dashboard/validation-aspect-breakdown-chart.tsx` - Enhanced breakdown with validation aspect progress
- `client/src/components/validation/validation-errors.tsx` - Enhanced error display with retry indicators
- `client/src/components/validation/validation-results.tsx` - Enhanced validation results display with retry information
- `client/src/components/resources/resource-list.tsx` - Enhanced resource list with retry indicators
- `client/src/pages/dashboard.tsx` - Enhanced dashboard with improved idle state display
- `client/src/pages/dashboard.idle.test.tsx` - Unit tests for dashboard idle state display
- `server/storage.ts` - Updated storage to handle retry logic and resource filtering
- `server/routes.ts` - Enhanced routes with retry statistics calculation and resource type filtering
- `server/services/validation/unified-validation.ts` - Enhanced validation service with comprehensive retry logic
- `server/utils/retry-statistics.test.ts` - Unit tests for retry statistics calculation
- `shared/types/validation.ts` - Updated validation types with new batch workflow types and retry information
- `shared/schema.ts` - Updated database schema with retry tracking fields
- `shared/validation-settings-validator.test.ts` - Enhanced unit tests for validation settings including resource type filtering
- `migrations/004_add_retry_tracking_to_validation_results.sql` - Database migration for retry tracking
- `migrations/005_add_confidence_scoring_to_validation_results.sql` - Database migration for confidence scoring
- `migrations/006_add_completeness_indicators_to_validation_results.sql` - Database migration for completeness indicators
- `server/services/validation/validation-quality-metrics-service.ts` - Service for calculating validation quality metrics
- `server/services/validation/validation-confidence-scoring-service.ts` - Service for calculating validation confidence scores
- `server/services/validation/validation-completeness-service.ts` - Service for calculating validation completeness indicators
- `client/src/components/dashboard/validation-quality-metrics-card.tsx` - UI component for displaying validation quality metrics
- `client/src/components/dashboard/validation-confidence-card.tsx` - UI component for displaying validation confidence metrics
- `client/src/components/dashboard/validation-completeness-card.tsx` - UI component for displaying validation completeness indicators
- `client/src/hooks/use-validation-quality-metrics.ts` - React hook for managing validation quality metrics
- `client/src/hooks/use-validation-confidence.ts` - React hook for managing validation confidence metrics
- `client/src/hooks/use-validation-completeness.ts` - React hook for managing validation completeness indicators
- `server/services/validation/validation-quality-metrics-service.test.ts` - Unit tests for validation quality metrics service
- `server/services/validation/validation-confidence-scoring-service.test.ts` - Unit tests for validation confidence scoring service
- `server/services/validation/validation-completeness-service.test.ts` - Unit tests for validation completeness service
- `client/src/components/dashboard/validation-quality-metrics-card.test.tsx` - Unit tests for validation quality metrics card component

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Use `npm test [optional/path/to/test/file]` to run tests. The project uses Vitest for testing.
- All tests are passing and the implementation is complete for Tasks 1.0 through 7.0.
- Task 7.0 (Optimize for Accuracy-First Validation) includes comprehensive validation quality metrics, confidence scoring, completeness indicators, and extensive unit test coverage.

## Tasks

- [x] 1.0 Implement Automatic Polling with 3-Second Intervals
  - [x] 1.1 Update `use-validation-polling.ts` to use 3-second intervals by default
  - [x] 1.2 Enable automatic polling in dashboard when validation is active
  - [x] 1.3 Add smart polling that reduces frequency when validation is idle
  - [x] 1.4 Implement polling state management (connecting, connected, disconnected)
  - [x] 1.5 Add polling error handling and retry logic
  - [x] 1.6 Create unit tests for updated polling functionality

- [x] 2.0 Add Batch Size Configuration to Settings
  - [x] 2.1 Update `shared/validation-settings.ts` to include batch size configuration
  - [x] 2.2 Add batch size input to validation aspects dropdown UI
  - [x] 2.3 Update validation settings service to handle batch size
  - [x] 2.4 Modify validation endpoints to use configured batch size
  - [x] 2.5 Add batch size validation (min: 50, max: 1000, default: 200)
  - [x] 2.6 Create unit tests for batch size configuration

- [x] 3.0 Enhance Progress Display with Resource Type and Validation Aspect Details
  - [x] 3.1 Update progress display to show current resource type being processed
  - [x] 3.2 Add validation aspect progress indicators (Structural, Profile, etc.)
  - [x] 3.3 Implement resource type progress breakdown in dashboard
  - [x] 3.4 Add validation aspect progress bars in real-time
  - [x] 3.5 Update validation stats card to show detailed progress by resource type
  - [x] 3.6 Create unit tests for enhanced progress display

- [x] 4.0 Implement Single Retry Logic for Failed Validations
  - [x] 4.1 Update validation engine to track retry attempts per resource
  - [x] 4.2 Implement retry logic in unified validation service
  - [x] 4.3 Add retry indicators in validation error displays
  - [x] 4.4 Update storage to track retry attempts and results
  - [x] 4.5 Add retry statistics to validation progress display
  - [x] 4.6 Create unit tests for retry logic

- [x] 5.0 Add Resource Type Filtering to Validation Settings
  - [x] 5.1 Update validation settings schema to include resource type filters
  - [x] 5.2 Add resource type selection UI to validation settings
  - [x] 5.3 Implement resource type filtering in validation engine
  - [x] 5.4 Add "Select All" / "Deselect All" options for resource types
  - [x] 5.5 Update validation progress to show filtered resource counts
  - [x] 5.6 Create unit tests for resource type filtering

- [x] 6.0 Improve Validation Engine Idle State Display
  - [x] 6.1 Enhance idle state UI with helpful information and next steps
  - [x] 6.2 Add validation history and last run statistics to idle state
  - [x] 6.3 Display current validation settings in idle state
  - [x] 6.4 Add quick action buttons for common validation tasks
  - [x] 6.5 Show resource type counts and validation readiness status
  - [x] 6.6 Create unit tests for idle state display

- [x] 7.0 Optimize for Accuracy-First Validation
  - [x] 7.1 Ensure all validation aspects are properly enabled by default
  - [x] 7.2 Implement comprehensive validation checks without shortcuts
  - [x] 7.3 Add validation quality metrics and scoring
  - [x] 7.4 Implement validation result confidence scoring
  - [x] 7.5 Add validation completeness indicators
  - [x] 7.6 Create unit tests for accuracy-focused validation

- [ ] 8.0 Update Backend Validation Processing
  - [ ] 8.1 Update bulk validation endpoints to use configured batch size
  - [ ] 8.2 Implement resource type filtering in backend validation
  - [ ] 8.3 Add retry logic to backend validation processing
  - [ ] 8.4 Enhance progress tracking with resource type and aspect details
  - [ ] 8.5 Update validation result storage with retry information
  - [ ] 8.6 Create integration tests for backend validation workflow

- [ ] 9.0 Enhance Validation Error Display and Management
  - [ ] 9.1 Update validation errors component to show retry attempts
  - [ ] 9.2 Add validation error categorization by aspect and severity
  - [ ] 9.3 Implement error filtering and search in validation results
  - [ ] 9.4 Add error resolution tracking and status updates
  - [ ] 9.5 Create detailed error reporting with context information
  - [ ] 9.6 Create unit tests for enhanced error display

- [ ] 10.0 Testing and Validation
  - [ ] 10.1 Create comprehensive integration tests for batch validation workflow
  - [ ] 10.2 Test validation with different batch sizes and resource type filters
  - [ ] 10.3 Validate retry logic with various failure scenarios
  - [ ] 10.4 Test polling performance and reliability with 3-second intervals
  - [ ] 10.5 Test validation accuracy with all aspects enabled
  - [ ] 10.6 Create end-to-end tests for complete validation workflow

- [ ] 11.0 Performance Optimization and Monitoring
  - [ ] 11.1 Optimize polling performance to handle 3-second intervals efficiently
  - [ ] 11.2 Add performance metrics for validation processing rates
  - [ ] 11.3 Implement validation progress caching to reduce API calls
  - [ ] 11.4 Add memory usage monitoring for large batch validations
  - [ ] 11.5 Optimize database queries for validation result retrieval
  - [ ] 11.6 Create performance benchmarks and monitoring dashboards

- [ ] 12.0 Documentation and User Experience
  - [ ] 12.1 Update validation settings UI with clear explanations of batch configuration
  - [ ] 12.2 Add tooltips and help text for new validation features
  - [ ] 12.3 Create user guide for batch validation workflow
  - [ ] 12.4 Add validation progress indicators and status explanations
  - [ ] 12.5 Implement keyboard shortcuts for validation controls
  - [ ] 12.6 Create troubleshooting guide for validation issues
