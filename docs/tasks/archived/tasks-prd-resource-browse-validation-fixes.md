## Relevant Files

### Database & Schema
- `shared/schema.ts` - Database schema for aspect-based validation storage (currently 350+ lines, needs splitting for aspect tables)
- `shared/types/validation.ts` - NEW: Aspect-based validation result types and interfaces (extract from existing validation types)
- `server/storage.ts` - Storage layer for aspect-based validation results (currently 800+ lines, needs extraction of validation logic)
- `server/migrations/` - Database migration scripts for aspect-based storage (NEW: create migration for clearing existing data)

### Server-Side Core (Large Files - Need Splitting)
- `server/services/validation/core/consolidated-validation-service.ts` - CRITICAL: Currently 1000+ lines, violates 500-line limit. Needs extraction into smaller modules
- `server/services/validation/engine/validation-engine.ts` - Validation engine for aspect-based processing (currently 400+ lines, needs splitting)
- `server/services/validation/engine/structural-validator.ts` - Structural validation with aspect storage (extract from large engine files)
- `server/services/validation/engine/profile-validator.ts` - Profile validation with aspect storage (extract from large engine files)
- `server/services/validation/engine/terminology-validator.ts` - Terminology validation with aspect storage (extract from large engine files)
- `server/services/validation/engine/reference-validator.ts` - Reference validation with aspect storage (extract from large engine files)
- `server/services/validation/engine/business-rule-validator.ts` - Business rule validation with aspect storage (extract from large engine files)
- `server/services/validation/engine/metadata-validator.ts` - Metadata validation with aspect storage (extract from large engine files)
- `server/services/validation/pipeline/pipeline-orchestrator.ts` - Pipeline updates for aspect-based processing (currently 300+ lines)
- `server/services/validation/settings/validation-settings-service.ts` - Settings service standardization (fix mixed concerns)
- `server/services/validation/features/validation-resource-type-filtering-service.ts` - Fix settings service error and extract business logic

### API Endpoints (Need SRP Separation)
- `server/routes/api/validation/validation.ts` - Validation API endpoints with aspect support (currently 800+ lines, needs extraction)
- `server/routes/api/fhir/fhir.ts` - FHIR API with validation result enhancement (currently 600+ lines, needs splitting)
- `server/routes/api/validation/settings.ts` - NEW: Validation settings management endpoints (extract from mixed concerns)

### Client-Side Components (Large Files - Need Splitting)
- `client/src/components/resources/resource-list.tsx` - Resource list component (currently 800+ lines, violates 500-line limit, needs splitting)
- `client/src/components/validation/validation-aspects-dropdown.tsx` - Settings UI component updates (extract from large components)
- `client/src/pages/resource-browser.tsx` - Resource browser page (currently 1000+ lines, violates 500-line limit, needs major refactoring)
- `client/src/pages/resource-detail.tsx` - Resource detail view with per-aspect validation status (extract from large components)
- `client/src/components/validation/validation-status-indicator.tsx` - NEW: Per-aspect validation status display (extract from large components)

### Client-Side Hooks & Utils (Need Modular Design)
- `client/src/hooks/use-validation-settings-polling.ts` - Settings polling hook optimization (extract business logic)
- `client/src/hooks/use-validation-results.ts` - NEW: Validation results hook for aspect-based data (create reusable module)
- `client/src/lib/validation-status.ts` - NEW: Unified validation status calculation utility (create testable module)
- `client/src/lib/validation-cache.ts` - NEW: Client-side validation cache management (create reusable cache module)

### NEW: Test Files (TDD Approach)
- `server/services/validation/core/consolidated-validation-service.test.ts` - Unit tests for validation service
- `client/src/components/resources/resource-list.test.tsx` - Component tests for resource list
- `client/src/lib/validation-status.test.ts` - Unit tests for validation status utility
- `server/storage.test.ts` - Integration tests for storage layer
- `server/routes/api/validation/validation.test.ts` - API endpoint tests

### Notes

- **Breaking changes are acceptable** - can modify existing APIs and components
- **Clear all existing validation results** and start fresh
- **Focus on fixing server connection and settings structure issues first**
- **TDD Approach**: Write tests before implementing features (outline tests → write failing tests → implement → refactor)
- **File Length Limits**: Never exceed 500 lines per file. Split files approaching 400 lines
- **SRP Compliance**: Each file/class/function handles one concern only
- **Modular Design**: Create interchangeable, testable, isolated modules
- **Use npx jest [optional/path/to/test/file]** to run tests. Running without a path executes all tests found by Jest configuration
- **Unit tests should typically be placed alongside the code files they are testing** (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory)

## Tasks

### Phase 1: Critical Immediate Fixes (TDD Approach)
- [ ] 1.0 Fix Critical Server Connection and Settings Issues
  - [x] 1.1 **Write failing tests** for server connection behavior (should only use connected server, never HAPI fallback)
  - [x] 1.2 Fix server connection fallback to HAPI - ensure only connected server is used
  - [x] 1.3 Remove hardcoded HAPI server URLs from all FhirClient instantiations
  - [x] 1.4 **Write failing tests** for ValidationResourceTypeFilteringService (should handle settings service properly)
  - [x] 1.5 Fix ValidationResourceTypeFilteringService error (TypeError: this.settingsService.getSettings is not a function)
  - [x] 1.6 Reduce settings polling frequency from 5 seconds to 30 seconds
  - [x] 1.7 Fix dual settings structure conflict (both `aspects.*.enabled` and direct `*.enabled` properties)
  - [x] 1.8 Update validation settings UI to prevent dual structure conflicts

### Phase 2: File Splitting and SRP Compliance (Prerequisites for Phase 3)
- [ ] 2.0 Split Large Files and Extract Business Logic
  - [ ] 2.1 **Write tests** for consolidated-validation-service functionality before splitting
  - [ ] 2.2 Split `consolidated-validation-service.ts` (1000+ lines) into smaller modules (max 400 lines each)
  - [ ] 2.3 Extract validation logic from `server/storage.ts` (800+ lines) into dedicated validation storage classes
  - [ ] 2.4 Split `resource-list.tsx` (800+ lines) into smaller components (validation status, resource card, pagination)
  - [ ] 2.5 Split `resource-browser.tsx` (1000+ lines) into smaller components (validation coverage, resource grid, filters)
  - [ ] 2.6 Extract business logic from API routes into dedicated service classes
  - [ ] 2.7 Create aspect-specific validation result types and interfaces (extract from existing types)

### Phase 3: Database Schema and Storage (Depends on Phase 2)
- [ ] 3.0 Design and Implement Aspect-Based Validation Storage
  - [ ] 3.1 **Write tests** for aspect-based validation storage operations
  - [ ] 3.2 Create new database schema for aspect-based validation results
  - [ ] 3.3 Create aspect-specific validation result tables (structural, profile, terminology, reference, business-rule, metadata)
  - [ ] 3.4 Add migration script to clear existing validation results and create new tables
  - [ ] 3.5 Update storage layer to support aspect-based operations (extract into smaller classes)
  - [ ] 3.6 Add database indexes for performance optimization
  - [ ] 3.7 Add validation settings management endpoints (extract from mixed concerns)

### Phase 4: Validation Engine Refactoring (Depends on Phase 3)
- [ ] 4.0 Refactor Validation Engine for Aspect-Based Processing
  - [ ] 4.1 **Write tests** for aspect-based validation engine functionality
  - [ ] 4.2 Modify validation engine to store results per aspect (split into smaller modules)
  - [ ] 4.3 Update individual validators for aspect storage (create separate files for each validator)
  - [ ] 4.4 Update validation pipeline to support aspect-specific processing
  - [ ] 4.5 Implement smart revalidation logic (only revalidate changed aspects)
  - [ ] 4.6 Add validation settings snapshot storage with each aspect result
  - [ ] 4.7 Implement cache invalidation per aspect (when settings change)

### Phase 5: Unified Status Calculation (Depends on Phase 4)
- [ ] 5.0 Implement Unified Validation Status Calculation
  - [ ] 5.1 **Write tests** for validation status calculation logic (test edge cases, different aspect combinations)
  - [ ] 5.2 Create centralized validation status calculation utility (create reusable module)
  - [ ] 5.3 Implement consistent validation status logic across all components
  - [ ] 5.4 Add validation status per aspect with clear indicators
  - [ ] 5.5 Create validation coverage calculation that matches individual resource status
  - [ ] 5.6 Add validation timestamp display for each aspect
  - [ ] 5.7 Create validation status indicator component for per-aspect display

### Phase 6: Client-Side Components (Depends on Phase 5)
- [ ] 6.0 Update Client-Side Components for Consistent Validation Display
  - [ ] 6.1 **Write tests** for validation results hook and component behavior
  - [ ] 6.2 Create validation results hook for aspect-based data (create reusable module)
  - [ ] 6.3 Refactor ResourceList component to use unified validation status calculation
  - [ ] 6.4 Update ResourceBrowser page validation coverage calculation
  - [ ] 6.5 Fix resource detail view validation status display
  - [ ] 6.6 Add per-aspect validation status indicators in resource cards
  - [ ] 6.7 Implement hybrid validation display (cached results with "validating" indicators)
  - [ ] 6.8 Add validation progress tracking per aspect
  - [ ] 6.9 Update validation aspects dropdown component

### Phase 7: API Enhancements (Can run parallel with Phase 6)
- [ ] 7.0 Enhance Validation API Endpoints
  - [ ] 7.1 **Write tests** for aspect-specific validation endpoints
  - [ ] 7.2 Create aspect-specific validation endpoints (extract from large API files)
  - [ ] 7.3 Add batch validation endpoints with aspect-level progress tracking
  - [ ] 7.4 Implement cache management endpoints for aspect-based invalidation
  - [ ] 7.5 Add validation status query endpoints
  - [ ] 7.6 Update existing endpoints to support aspect-based operations
  - [ ] 7.7 Add client-side validation cache management

### Phase 8: Performance Optimizations (Depends on Phases 6-7)
- [ ] 8.0 Implement Performance Optimizations
  - [ ] 8.1 **Write performance tests** for validation operations and database queries
  - [ ] 8.2 Add efficient database queries for aspect-based validation results
  - [ ] 8.3 Implement cache warming for frequently accessed resources
  - [ ] 8.4 Add memory usage optimization for validation result caching
  - [ ] 8.5 Implement cache size management and cleanup
  - [ ] 8.6 Add validation result pagination for large datasets
  - [ ] 8.7 Optimize settings polling and cache invalidation strategies

### Phase 9: Error Handling and UX (Depends on Phase 8)
- [ ] 9.0 Add Error Handling and User Experience Improvements
  - [ ] 9.1 **Write tests** for error handling scenarios and retry logic
  - [ ] 9.2 Add comprehensive error handling for validation failures
  - [ ] 9.3 Implement validation retry logic with exponential backoff
  - [ ] 9.4 Add user-friendly error messages for validation issues
  - [ ] 9.5 Implement validation timeout handling
  - [ ] 9.6 Add validation result export functionality
  - [ ] 9.7 Add validation progress indicators and status updates

### Phase 10: Documentation and Cleanup (Final Phase)
- [ ] 10.0 Documentation and Cleanup
  - [ ] 10.1 Update API documentation for new aspect-based endpoints
  - [ ] 10.2 Add developer documentation for validation system architecture
  - [ ] 10.3 Clean up deprecated validation code and unused components
  - [ ] 10.4 Add migration guide for existing validation data
  - [ ] 10.5 Update README with new validation system information
  - [ ] 10.6 Add troubleshooting guide for validation issues
