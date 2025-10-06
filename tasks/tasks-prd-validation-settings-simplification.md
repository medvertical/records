# Validation Settings Simplification Implementation Tasks

## Relevant Files

### Core Schema & Types
- `shared/validation-settings.ts` - Main validation settings schema (to be simplified from complex version)
- `shared/validation-settings-simplified.ts` - Current simplified schema (to be merged into main)
- `shared/validation-settings-validator.ts` - Complex validation logic (to be removed/simplified)

### Backend Services
- `server/services/validation/validation-settings-service.ts` - Complex main service (2354 lines, to be removed)
- `server/services/validation/settings/validation-settings-service.ts` - Unified service (to be removed)
- `server/services/validation/settings/validation-settings-service-simplified.ts` - Simplified service (to become main service)
- `server/services/validation/settings/settings-core-service.ts` - Core service (to be removed)
- `server/services/validation/validation-settings-errors.ts` - Error handling service (to be simplified)

### Backend Repositories
- `server/repositories/validation-settings-repository.ts` - Main repository (to be simplified)
- `server/repositories/validation-settings-repository-simplified.ts` - Simplified repository (to become main)

### API Routes
- `server/routes/api/validation/validation-settings.ts` - Complex routes (to be removed)
- `server/routes/api/validation/validation-settings-simplified.ts` - Simplified routes (to become main)
- `server/routes/api/validation/validation.ts` - Mixed routes (to be cleaned up)

### Frontend Components
- `client/src/components/settings/validation-settings-tab.tsx` - Complex settings tab (to be removed)
- `client/src/components/settings/validation-settings-tab-simplified.tsx` - Simplified settings tab (to become main)
- `client/src/components/ui/validation-aspects-dropdown.tsx` - Header dropdown (to be updated for new schema)
- `client/src/components/dashboard/modals/ValidationSettingsModal.tsx` - Settings modal (to be updated)

### Frontend Hooks & Utils
- `client/src/hooks/use-validation-settings.ts` - Settings hook (to be updated)
- `client/src/lib/validation-settings-integration.ts` - Integration utilities (to be simplified)
- `client/src/lib/validation-settings-backup.ts` - Backup utilities (to be removed/simplified)
- `client/src/lib/validation-settings-persistence.ts` - Persistence utilities (to be simplified)

### Database & Migrations
- `migrations/016_simplify_validation_settings.sql` - New migration to simplify database schema
- `server/db/schema.ts` - Database schema (to be updated)

### Tests
- `server/services/validation/settings/validation-settings-service-simplified.test.ts` - Service tests (to be updated)
- `client/src/components/settings/validation-settings-tab-simplified.test.tsx` - Component tests (to be updated)
- `server/routes/api/validation/validation-settings-simplified.test.ts` - API tests (to be created)

### Notes
- Unit tests should be placed alongside the code files they are testing
- Use `npm test` to run all tests, or `npm test -- --testPathPattern=<pattern>` for specific tests
- Follow the existing test patterns in the codebase
- All new code must have corresponding tests

## Tasks

- [ ] 1.0 Schema Consolidation & Simplification
  - [ ] 1.1 Create new simplified ValidationSettings interface in `shared/validation-settings.ts`
  - [ ] 1.2 Define 6 validation aspects (Structural, Profile, Terminology, Reference, Business Rules, Metadata) with enabled/severity
  - [ ] 1.3 Add performance settings (maxConcurrent, batchSize) to schema
  - [ ] 1.4 Add resource type filtering (enabled, includedTypes, excludedTypes) to schema
  - [ ] 1.5 Create FHIR version-aware resource type constants (R4 vs R5 defaults)
  - [ ] 1.6 Remove complex validation schema from `shared/validation-settings-validator.ts`
  - [ ] 1.7 Create migration script to update database schema
  - [ ] 1.8 Update all TypeScript imports to use new simplified schema

- [ ] 2.0 Backend Service Consolidation
  - [ ] 2.1 Rename `validation-settings-service-simplified.ts` to `validation-settings-service.ts`
  - [ ] 2.2 Remove complex service implementations (main service, unified service, core service)
  - [ ] 2.3 Update simplified service to work with new schema
  - [ ] 2.4 Implement FHIR version detection and resource type validation
  - [ ] 2.5 Add automatic settings migration when FHIR version changes
  - [ ] 2.6 Fix PUT endpoint validation to allow partial updates
  - [ ] 2.7 Simplify error handling and remove complex error types
  - [ ] 2.8 Update repository to work with simplified schema

- [ ] 3.0 API Routes Cleanup
  - [ ] 3.1 Rename `validation-settings-simplified.ts` routes to main routes
  - [ ] 3.2 Remove complex route implementations
  - [ ] 3.3 Add new endpoints: GET /api/validation/resource-types/:version, POST /api/validation/settings/migrate
  - [ ] 3.4 Update existing endpoints to work with simplified schema
  - [ ] 3.5 Remove audit trail, history, and complex management endpoints
  - [ ] 3.6 Clean up mixed routes in `validation.ts`
  - [ ] 3.7 Add proper error handling and validation for all endpoints

- [ ] 4.0 Frontend UI Simplification
  - [ ] 4.1 Rename `validation-settings-tab-simplified.tsx` to `validation-settings-tab.tsx`
  - [ ] 4.2 Remove complex settings tab implementation
  - [ ] 4.3 Update settings tab to show only 6 aspects + performance + resource types
  - [ ] 4.4 Add FHIR version indicator and resource type warnings
  - [ ] 4.5 Implement version-aware resource type multi-select dropdown
  - [ ] 4.6 Add migration warnings when switching FHIR versions
  - [ ] 4.7 Update ValidationAspectsDropdown to work with new schema
  - [ ] 4.8 Remove complex settings modal and backup/restore features

- [ ] 5.0 Frontend Integration & Hooks
  - [ ] 5.1 Update `use-validation-settings.ts` hook for new schema
  - [ ] 5.2 Simplify `validation-settings-integration.ts` utilities
  - [ ] 5.3 Remove backup and persistence utilities
  - [ ] 5.4 Update all components to use simplified settings interface
  - [ ] 5.5 Add FHIR version detection hook
  - [ ] 5.6 Implement settings migration logic in frontend
  - [ ] 5.7 Update all imports and references to use new schema

- [ ] 6.0 Database Migration & Cleanup
  - [ ] 6.1 Create migration to remove unused columns from validation_settings table
  - [ ] 6.2 Add new columns for simplified schema (if needed)
  - [ ] 6.3 Migrate existing data to new simplified format
  - [ ] 6.4 Remove audit trail and versioning tables
  - [ ] 6.5 Update database schema definitions
  - [ ] 6.6 Test migration with existing data
  - [ ] 6.7 Create rollback migration script

- [ ] 7.0 Testing & Quality Assurance
  - [ ] 7.1 Update service tests for simplified implementation
  - [ ] 7.2 Update component tests for new UI
  - [ ] 7.3 Create API endpoint tests
  - [ ] 7.4 Add integration tests for FHIR version migration
  - [ ] 7.5 Test resource type filtering with R4/R5 servers
  - [ ] 7.6 Add end-to-end tests for complete settings workflow
  - [ ] 7.7 Test PUT endpoint with partial updates
  - [ ] 7.8 Verify all existing functionality still works

- [ ] 8.0 Documentation & Cleanup
  - [ ] 8.1 Update API documentation for simplified endpoints
  - [ ] 8.2 Update component documentation
  - [ ] 8.3 Remove unused files and clean up imports
  - [ ] 8.4 Update README with new simplified settings approach
  - [ ] 8.5 Create migration guide for users
  - [ ] 8.6 Update task lists and project documentation
  - [ ] 8.7 Verify all tests pass and no linting errors
