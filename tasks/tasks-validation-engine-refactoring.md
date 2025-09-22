# Validation Engine Refactoring Tasks

**Goal:** Consolidate multiple validation engines into a single, maintainable validation engine that aligns with PRD requirements for MVP simplicity and enterprise-scale performance.

## Relevant Files

- `server/services/validation/validation-engine.ts` - Legacy validation engine (986 lines)
- `server/services/validation/rock-solid-validation-engine.ts` - New centralized settings integration (1864 lines)
- `server/services/validation/enhanced-validation-engine.ts` - Enhanced 6-aspect validation (2768 lines)
- `server/services/validation/unified-validation.ts` - Unified validation service (741 lines)
- `server/services/validation/validation-pipeline.ts` - Validation pipeline orchestrator (803 lines)
- `server/routes.ts` - API routes using validation engines (5991 lines)
- `shared/validation-settings.ts` - Validation settings types and presets
- `shared/schema.ts` - Database schema and validation result types

### Notes

- The current architecture has 3 competing validation engines with overlapping functionality
- The pipeline uses `rock-solid-validation-engine` while unified service uses legacy `validation-engine`
- PRD requires MVP simplicity with single validation engine and 6-aspect validation system
- Enterprise-scale performance (800K+ resources) requires efficient, maintainable code

## Tasks

- [ ] 1.0 **Analyze and Document Current Validation Engines**
  - [ ] 1.1 Document the interfaces and capabilities of each validation engine
  - [ ] 1.2 Identify unique features in each engine that need to be preserved
  - [ ] 1.3 Map the 6-aspect validation requirements from PRD to current implementations
  - [ ] 1.4 Identify which engine has the best foundation for consolidation
  - [ ] 1.5 Document current usage patterns in routes.ts and other consumers

- [ ] 2.0 **Design Unified Validation Engine Architecture**
  - [ ] 2.1 Create a single validation engine interface that supports all 6 aspects
  - [ ] 2.2 Design modular validation aspect system (Structural, Profile, Terminology, Reference, Business Rules, Metadata)
  - [ ] 2.3 Define consistent validation result interface across all aspects
  - [ ] 2.4 Design centralized settings integration for all validation aspects
  - [ ] 2.5 Plan performance optimizations for enterprise-scale (800K+ resources)

- [ ] 3.0 **Implement Core Unified Validation Engine**
  - [ ] 3.1 Create new unified validation engine with 6-aspect architecture
  - [ ] 3.2 Implement Structural validation (JSON schema, FHIR structure compliance)
  - [ ] 3.3 Implement Profile validation (conformance to specific FHIR profiles)
  - [ ] 3.4 Implement Terminology validation (code system and value set validation)
  - [ ] 3.5 Implement Reference validation (resource reference integrity checking)
  - [ ] 3.6 Implement Business Rule validation (cross-field logic and constraints)
  - [ ] 3.7 Implement Metadata validation (version, timestamp, metadata compliance)

- [ ] 4.0 **Migrate Settings Integration**
  - [ ] 4.1 Integrate centralized validation settings service with unified engine
  - [ ] 4.2 Migrate validation configuration from multiple engines to single source
  - [ ] 4.3 Implement aspect-specific settings (enable/disable, severity levels)
  - [ ] 4.4 Add validation timeout and performance settings
  - [ ] 4.5 Implement validation preset management (built-in presets from PRD)

- [ ] 5.0 **Update Validation Pipeline Integration**
  - [ ] 5.1 Update validation pipeline to use unified validation engine
  - [ ] 5.2 Implement proper error handling and retry logic for unified engine
  - [ ] 5.3 Add performance monitoring and metrics collection
  - [ ] 5.4 Implement validation result caching with unified engine
  - [ ] 5.5 Add progress tracking for long-running validations

- [ ] 6.0 **Update API Routes and Consumers**
  - [ ] 6.1 Update routes.ts to use unified validation engine
  - [ ] 6.2 Update unified validation service to use new engine
  - [ ] 6.3 Update dashboard service to work with unified validation results
  - [ ] 6.4 Update validation settings endpoints to work with unified engine
  - [ ] 6.5 Update validation progress tracking to use unified engine

- [ ] 7.0 **Remove Legacy Validation Engines**
  - [ ] 7.1 Remove legacy validation-engine.ts after migration
  - [ ] 7.2 Remove enhanced-validation-engine.ts after migration
  - [ ] 7.3 Update all imports and references to use unified engine
  - [ ] 7.4 Clean up unused validation engine dependencies
  - [ ] 7.5 Update documentation to reflect single validation engine

- [ ] 8.0 **Testing and Validation**
  - [ ] 8.1 Create comprehensive unit tests for unified validation engine
  - [ ] 8.2 Create integration tests for validation pipeline with unified engine
  - [ ] 8.3 Test validation settings integration with unified engine
  - [ ] 8.4 Test performance with large datasets (800K+ resources)
  - [ ] 8.5 Test all 6 validation aspects with various resource types

- [ ] 9.0 **Performance Optimization**
  - [ ] 9.1 Optimize validation engine for enterprise-scale performance
  - [ ] 9.2 Implement efficient caching strategies for validation results
  - [ ] 9.3 Add validation result batching for large datasets
  - [ ] 9.4 Implement memory-efficient resource processing
  - [ ] 9.5 Add validation performance metrics and monitoring

- [ ] 10.0 **Documentation and Cleanup**
  - [ ] 10.1 Update API documentation for unified validation engine
  - [ ] 10.2 Update validation settings documentation
  - [ ] 10.3 Create migration guide from legacy engines
  - [ ] 10.4 Update PRD compliance documentation
  - [ ] 10.5 Clean up any remaining legacy code and dependencies
