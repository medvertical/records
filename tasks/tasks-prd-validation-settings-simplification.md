# Validation Settings Simplification Implementation Tasks

## Relevant Files

### Core Schema & Types
- `shared/validation-settings.ts` - **RENAMED** Main validation settings schema (was simplified)
- `shared/validation-settings-validator.ts` - **REMOVED** Complex validation logic (deleted)

### Backend Services
- `server/services/validation/validation-settings-service.ts` - **REMOVED** Complex main service (2354 lines, deleted)
- `server/services/validation/settings/validation-settings-service.ts` - **REMOVED** Unified service (deleted)
- `server/services/validation/settings/validation-settings-service.ts` - **RECREATED** Simplified validation settings service (updated for new schema)
- `server/services/validation/settings/settings-core-service.ts` - **REMOVED** Core service (deleted)
- `server/services/validation/settings/settings-cache-service.ts` - **REMOVED** Cache service (deleted)
- `server/services/validation/settings/settings-preset-service.ts` - **REMOVED** Preset service (deleted)
- `server/services/validation/validation-settings-errors.ts` - Error handling service (to be simplified)

### Backend Repositories
- `server/repositories/validation-settings-repository.ts` - **RENAMED** Main validation settings repository (was simplified)

### API Routes
- `server/routes/api/validation/validation-settings.ts` - **RENAMED** Main validation settings routes (was simplified)
- `server/routes/api/validation/validation.ts` - **REFACTORED** Main validation routes orchestrator (3244+ lines split into modules)
- `server/routes/api/validation/validation-resource.ts` - **NEW** Individual resource validation routes
- `server/routes/api/validation/validation-pipeline.ts` - **NEW** Validation pipeline routes
- `server/routes/api/validation/validation-profiles.ts` - **NEW** Validation profiles routes
- `server/routes/api/validation/validation-backups.ts` - **NEW** Validation backups routes
- `server/routes/api/validation/groups.ts` - **REMOVED** Complex validation groups routes (deleted)
- `server/routes/api/validation/clear.ts` - **REMOVED** Complex validation clear routes (deleted)
- `server/routes/api/validation/resource-messages.ts` - **REMOVED** Complex resource messages routes (deleted)
- `server/routes/api/validation/validation-queue.ts` - **REMOVED** Complex validation queue routes (deleted)

### Frontend Components
- `client/src/components/settings/validation-settings-tab.tsx` - Complex settings tab (to be removed)
- `client/src/components/settings/validation-settings-tab-simplified.tsx` - Simplified settings tab (to become main)
- `client/src/components/ui/validation-aspects-dropdown.tsx` - Header dropdown (to be updated for new schema)
- `client/src/components/dashboard/modals/ValidationSettingsModal.tsx` - Settings modal (to be updated)

### Frontend Hooks & Utils
- `client/src/hooks/use-validation-settings.ts` - Settings hook (to be updated)
- `client/src/hooks/use-validation-controls.ts` - Controls hook (to be updated)
- `client/src/hooks/use-aspect-settings-reactive.ts` - Aspect settings hook (to be updated)
- `client/src/hooks/use-validation-settings-realtime.ts` - Realtime settings hook (to be removed)
- `client/src/hooks/use-validation-sse.ts` - SSE hook (to be removed)
- `client/src/lib/validation-settings-integration.ts` - Integration utilities (to be simplified)
- `client/src/lib/validation-settings-backup.ts` - Backup utilities (to be removed/simplified)
- `client/src/lib/validation-settings-persistence.ts` - Persistence utilities (to be simplified)
- `client/src/lib/validation-scoring.ts` - Scoring utilities (to be updated for new schema)

### Database & Migrations
- `migrations/016_simplify_validation_settings.sql` - **NEW** Migration to simplify database schema (created)
- `migrations/016_simplify_validation_settings_rollback.sql` - **NEW** Rollback script for migration (created)
- `shared/schema.ts` - Database schema (to be updated)

### Tests
- `server/services/validation/settings/validation-settings-service.test.ts` - **RENAMED** Service tests (was simplified)
- `client/src/components/settings/validation-settings-tab-simplified.test.tsx` - Component tests (to be updated)
- `client/src/hooks/use-validation-settings.test.ts` - Settings hook tests (to be updated)
- `client/src/hooks/use-validation-controls.test.ts` - Controls hook tests (to be updated)
- `client/src/lib/validation-scoring.test.ts` - Scoring utility tests (to be updated)
- `server/routes/api/validation/validation-settings-simplified.test.ts` - API tests (to be created)

### Notes
- Unit tests should be placed alongside the code files they are testing
- Use `npm test` to run all tests, or `npm test -- --testPathPattern=<pattern>` for specific tests
- Follow the existing test patterns in the codebase
- All new code must have corresponding tests

## Tasks

- [x] 1.0 Schema Consolidation & Simplification
  - [x] 1.1 Create new simplified ValidationSettings interface in `shared/validation-settings.ts`
  - [x] 1.2 Define 6 validation aspects (Structural, Profile, Terminology, Reference, Business Rules, Metadata) with enabled/severity
  - [x] 1.3 Add performance settings (maxConcurrent, batchSize) to schema
  - [x] 1.4 Add resource type filtering (enabled, includedTypes, excludedTypes) to schema
  - [x] 1.5 Create FHIR version-aware resource type constants (R4 vs R5 defaults)
  - [x] 1.6 Add resource type validation against FHIR version
  - [x] 1.7 Remove complex validation schema from `shared/validation-settings-validator.ts`
  - [x] 1.8 Create migration script to update database schema
  - [x] 1.9 Update all TypeScript imports to use new simplified schema
  - [x] 1.10 Add default settings constants for R4 and R5

- [x] 2.0 Backend Service Consolidation
  - [x] 2.1 Rename `validation-settings-service-simplified.ts` to `validation-settings-service.ts`
  - [x] 2.2 Remove complex service implementations (main service, unified service, core service)
  - [x] 2.3 Update simplified service to work with new schema
  - [x] 2.4 Implement FHIR version detection and resource type validation
  - [x] 2.5 Add automatic settings migration when FHIR version changes
  - [x] 2.6 Fix PUT endpoint validation to allow partial updates
  - [x] 2.7 Simplify error handling and remove complex error types
  - [x] 2.8 Remove real-time sync and SSE functionality (polling only)
  - [x] 2.9 Update repository to work with simplified schema

- [ ] 3.0 API Routes Cleanup
  - [x] 3.1 Rename `validation-settings-simplified.ts` routes to main routes
  - [x] 3.2 Remove complex route implementations
  - [x] 3.3 Add new endpoints: GET /api/validation/resource-types/:version, POST /api/validation/settings/migrate
  - [x] 3.4 Update existing endpoints to work with simplified schema
  - [x] 3.5 Remove audit trail, history, and complex management endpoints
  - [x] 3.6 Remove SSE/WebSocket endpoints (polling only)
  - [x] 3.7 Clean up mixed routes in `validation.ts`
  - [x] 3.8 Add proper error handling and validation for all endpoints

- [x] 4.0 Frontend UI Simplification
  - [x] 4.1 Rename `validation-settings-tab-simplified.tsx` to `validation-settings-tab.tsx`
  - [x] 4.2 Remove complex settings tab implementation
  - [x] 4.3 Update settings tab to show only 6 aspects + performance + resource types
  - [x] 4.4 Add FHIR version indicator and resource type warnings
  - [x] 4.5 Implement version-aware resource type multi-select dropdown
  - [x] 4.6 Add migration warnings when switching FHIR versions
  - [x] 4.7 Update ValidationAspectsDropdown to work with new schema
  - [x] 4.8 Remove complex settings modal and backup/restore features
  - [x] 4.9 Remove real-time sync indicators and SSE status displays

- [x] 5.0 Frontend Integration & Hooks
  - [x] 5.1 Update `use-validation-settings.ts` hook for new schema
  - [x] 5.2 Update `use-validation-controls.ts` hook for simplified settings
  - [x] 5.3 Update `use-aspect-settings-reactive.ts` hook for new aspect structure
  - [x] 5.4 Remove `use-validation-settings-realtime.ts` hook (redundant)
  - [x] 5.5 Remove `use-validation-sse.ts` hook (SSE not used, polling only)
  - [x] 5.6 Simplify `validation-settings-integration.ts` utilities
  - [x] 5.7 Remove backup and persistence utilities
  - [x] 5.8 Remove real-time sync and SSE integration logic
  - [x] 5.9 Update `validation-scoring.ts` for new schema structure
  - [x] 5.10 Update all components to use simplified settings interface
  - [x] 5.11 Add FHIR version detection hook
  - [x] 5.12 Implement settings migration logic in frontend
  - [x] 5.13 Update all imports and references to use new schema

- [x] 6.0 Database Migration & Cleanup
  - [x] 6.1 Create migration to remove unused columns from validation_settings table
  - [x] 6.2 Add new columns for simplified schema (if needed)
  - [x] 6.3 Migrate existing data to new simplified format
  - [x] 6.4 Remove audit trail and versioning tables
  - [x] 6.5 Remove SSE/WebSocket related database tables
  - [x] 6.6 Update database schema definitions
  - [x] 6.7 Test migration with existing data
  - [x] 6.8 Create rollback migration script

- [x] 7.0 Testing & Quality Assurance
  - [x] 7.1 Update service tests for simplified implementation
  - [x] 7.2 Update component tests for new UI
  - [x] 7.3 Update hook tests for simplified settings
  - [x] 7.4 Update utility tests (validation-scoring, etc.)
  - [x] 7.5 Create API endpoint tests
  - [x] 7.6 Add integration tests for FHIR version migration
  - [x] 7.7 Test resource type filtering with R4/R5 servers
  - [x] 7.8 Add end-to-end tests for complete settings workflow
  - [x] 7.9 Test PUT endpoint with partial updates
  - [x] 7.10 Test settings migration between FHIR versions
  - [x] 7.11 Verify polling-based updates work correctly
  - [x] 7.12 Verify all existing functionality still works
  - [x] 7.13 Test error handling and edge cases

- [x] 8.0 Documentation & Cleanup
  - [x] 8.1 Update API documentation for simplified endpoints
  - [x] 8.2 Update component documentation
  - [x] 8.3 Remove unused files and clean up imports
  - [x] 8.4 Remove SSE/WebSocket documentation and examples
  - [x] 8.5 Update README with new simplified settings approach
  - [x] 8.6 Create migration guide for users
  - [x] 8.7 Update task lists and project documentation
  - [x] 8.8 Verify all tests pass and no linting errors
