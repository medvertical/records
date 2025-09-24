# Tasks: Finish Refactoring - Fix Broken Import Paths and Complete Modular Structure

## Current Status Analysis

### ✅ What's Working:
- Server starts without crashing
- Database connections work
- Cache operations work
- New modular validation engine structure exists

### ❌ What's Broken:
- 14 files still importing from deleted `rock-solid-validation-engine.ts`
- Individual validators have incorrect method signatures
- Missing type definitions in validator files
- Server not responding to HTTP requests (likely due to import errors)
- FHIR client imports are broken

### 🔍 Root Cause:
The refactoring was incomplete - we created the new modular structure but didn't update all the import paths and method signatures to match the new architecture.

## Relevant Files

### Core Validation Files (Need Import Fixes):
- `server/services/validation/core/consolidated-validation-service.ts` - Main validation service
- `server/services/validation/core/validation-pipeline.ts` - Old pipeline (should be removed)
- `server/services/validation/core/validation-pipeline-new.ts` - New pipeline
- `server/services/validation/engine/reference-validator.ts` - Reference validation logic
- `server/services/validation/engine/terminology-validator.ts` - Terminology validation logic
- `server/services/validation/engine/metadata-validator.ts` - Metadata validation logic
- `server/services/validation/engine/business-rule-validator.ts` - Business rules validation
- `server/services/validation/engine/profile-validator.ts` - Profile validation logic

### Pipeline Files (Need Import Fixes):
- `server/services/validation/pipeline/pipeline-types.ts` - Pipeline type definitions
- `server/services/validation/pipeline/pipeline-calculator.ts` - Pipeline calculations
- `server/services/validation/pipeline/batch-processor.ts` - Batch processing logic
- `server/services/validation/pipeline/pipeline-orchestrator.ts` - Pipeline orchestration

### Test Files (Need Updates):
- `server/services/validation/validation-engine.test.ts` - Validation engine tests
- `server/api.test.ts` - API integration tests

### New Files to Create:
- `server/services/validation/types/validation-types.ts` - Shared type definitions
- `server/services/validation/utils/validation-utils.ts` - Shared utility functions

## Tasks

- [x] 1.0 Fix Core Validation Service Imports ✅ COMPLETED
  - [x] 1.1 Update `consolidated-validation-service.ts` to use new validation engine
  - [x] 1.2 Remove old `validation-pipeline.ts` file (replaced by `validation-pipeline-new.ts`)
  - [x] 1.3 Update `validation-pipeline-new.ts` imports to use new structure
  - [x] 1.4 Fix FHIR client imports in validation engine

- [x] 2.0 Fix Individual Validator Files ✅ COMPLETED
  - [x] 2.1 Update `structural-validator.ts` method signatures and types
  - [x] 2.2 Update `profile-validator.ts` method signatures and types
  - [x] 2.3 Update `terminology-validator.ts` method signatures and types
  - [x] 2.4 Update `reference-validator.ts` method signatures and types
  - [x] 2.5 Update `business-rule-validator.ts` method signatures and types
  - [x] 2.6 Update `metadata-validator.ts` method signatures and types

- [x] 3.0 Fix Pipeline Component Imports ✅ COMPLETED
  - [x] 3.1 Update `pipeline-types.ts` to use new type definitions
  - [x] 3.2 Update `pipeline-calculator.ts` imports
  - [x] 3.3 Update `batch-processor.ts` imports
  - [x] 3.4 Update `pipeline-orchestrator.ts` imports

- [x] 4.0 Create Shared Type Definitions ✅ COMPLETED
  - [x] 4.1 Create `validation-types.ts` with all shared interfaces
  - [x] 4.2 Extract types from old engine file
  - [x] 4.3 Update all validators to import from shared types
  - [x] 4.4 Update main validation engine to use shared types

- [x] 5.0 Fix FHIR Client Integration ✅ COMPLETED
  - [x] 5.1 Create missing `simplifier-client.ts` or make it optional
  - [x] 5.2 Fix `terminology-client.ts` import path
  - [x] 5.3 Update validation engine to handle missing clients gracefully

- [x] 6.0 Update Test Files ✅ COMPLETED
  - [x] 6.1 Update `validation-engine.test.ts` to use new structure
  - [x] 6.2 Update `api.test.ts` imports
  - [x] 6.3 Run tests to ensure they pass

- [x] 7.0 Test Server Functionality ✅ COMPLETED
  - [x] 7.1 Test server startup without errors
  - [x] 7.2 Test HTTP endpoints respond correctly
  - [x] 7.3 Test validation functionality works
  - [x] 7.4 Test database operations work
  - [x] 7.5 Test client-side functionality

- [x] 8.0 Clean Up and Documentation ✅ COMPLETED
  - [x] 8.1 Remove any remaining backup files
  - [x] 8.2 Update documentation to reflect new structure
  - [x] 8.3 Verify all imports are using new modular structure
  - [x] 8.4 Run full test suite to ensure nothing is broken

## Expected Results

After completing these tasks:
- ✅ Server starts and responds to HTTP requests
- ✅ All validation functionality works with new modular structure
- ✅ No import errors or missing module errors
- ✅ All tests pass
- ✅ Client-side functionality works
- ✅ Clean, maintainable code structure following single responsibility principle
- ✅ File sizes under 500 lines as per cursor rules

## Priority Order

1. **High Priority**: Tasks 1.0-3.0 (Fix core imports and validators)
2. **Medium Priority**: Tasks 4.0-5.0 (Create shared types and fix FHIR clients)
3. **Low Priority**: Tasks 6.0-8.0 (Update tests and clean up)

## Notes

- The refactoring was 80% complete but import paths weren't updated
- Individual validators need method signature updates to match new engine
- FHIR clients are optional and should be handled gracefully
- All files should import from the new modular structure, not the old monolithic file
