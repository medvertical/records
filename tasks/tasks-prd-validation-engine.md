# Implementation Tasks: FHIR Validation Engine
**Based on:** `docs/requirements/prd-validation-engine.md`  
**Created:** October 2025  
**Status:** Phase 1 - Parent Tasks Generated

---

## Relevant Files

### Core Validation Engine
- `server/services/validation/core/validation-engine.ts` - Main orchestrator for 6-aspect validation
- `server/services/validation/engine/structural-validator.ts` - HAPI-based structural validation
- `server/services/validation/engine/profile-validator.ts` - Profile conformance validation
- `server/services/validation/engine/terminology-validator.ts` - Terminology validation (needs major refactor)
- `server/services/validation/engine/reference-validator.ts` - Reference integrity validation
- `server/services/validation/engine/business-rule-validator.ts` - FHIRPath/JSONPath rule execution
- `server/services/validation/engine/metadata-validator.ts` - Metadata and provenance validation

### New Components (To Be Created)
- `server/services/validation/utils/error-mapping-engine.ts` - Error code translation and suggestions
- `server/services/validation/utils/connectivity-detector.ts` - Network health monitoring
- `server/services/validation/utils/profile-resolver.ts` - Smart canonical URL resolution
- `server/services/validation/utils/process-pool-manager.ts` - HAPI Java process management
- `server/services/validation/terminology/direct-terminology-client.ts` - Direct HTTP terminology validation
- `server/services/validation/cache/validation-cache-manager.ts` - Multi-layer caching system
- `server/config/error-mappings.json` - Error mapping dictionary
- `server/config/validation-rules.json` - Business rules library

### Supporting Services
- `server/services/fhir/profile-manager.ts` - Profile package management (needs enhancement)
- `server/services/fhir/simplifier-client.ts` - Simplifier API integration (working)
- `server/services/fhir/terminology-client.ts` - Terminology server client (needs update)

### Configuration
- `server/config/hapi-validator-config.ts` - HAPI validator configuration
- `shared/validation-settings.ts` - Validation settings schema

### API Routes
- `server/routes/validation.ts` - Validation API endpoints
- `server/routes/profiles.ts` - Profile management endpoints

### Tests
- `server/services/validation/__tests__/terminology-validator.test.ts` - Terminology validation tests
- `server/services/validation/__tests__/error-mapping-engine.test.ts` - Error mapping tests
- `server/services/validation/__tests__/profile-resolver.test.ts` - Profile resolution tests
- `tests/integration/validation-engine.test.ts` - Integration tests

---

## Tasks

- [ ] **1.0 Terminology Validation Optimization** - Rewrite terminology validator to bypass HAPI and use direct HTTP calls to terminology servers
  - [ ] 1.1 Create `DirectTerminologyClient` class with HTTP client for ValueSet/$validate-code operations
  - [ ] 1.2 Implement version-specific terminology server URL routing (R4→tx.fhir.org/r4, R5→r5, R6→r6)
  - [ ] 1.3 Add circuit breaker pattern for terminology server failures with automatic fallback
  - [ ] 1.4 Implement intelligent caching with SHA-256 keys (system|code|valueSet|version) and TTL management
  - [ ] 1.5 Create code extraction logic to identify all CodeableConcept, Coding, and code fields in resources
  - [ ] 1.6 Implement batch validation for multiple codes in single HTTP request
  - [ ] 1.7 Add parallel terminology server requests with Promise.all for performance
  - [ ] 1.8 Update `TerminologyValidator` to use new `DirectTerminologyClient` instead of HAPI
  - [ ] 1.9 Implement cache warming for common ValueSets (administrative-gender, observation-status, etc.)
  - [ ] 1.10 Add performance monitoring and logging for terminology validation times
  - [ ] 1.11 Write unit tests for `DirectTerminologyClient` with mocked HTTP responses
  - [ ] 1.12 Write integration tests validating against real tx.fhir.org endpoints

- [ ] **2.0 Error Mapping System** - Create comprehensive error mapping dictionary with user-friendly messages and suggested fixes
  - [ ] 2.1 Create `error-mappings.json` schema with fields: code, userMessage, suggestedFixes[], severity, documentation
  - [ ] 2.2 Populate error mappings for common HAPI validation codes (structure-failed, profile-mismatch, etc.)
  - [ ] 2.3 Add terminology-specific error mappings (code-unknown, valueset-expansion-failed, binding-strength-violated)
  - [ ] 2.4 Add profile validation error mappings (constraint-failed, extension-unknown, cardinality-violated)
  - [ ] 2.5 Create `ErrorMappingEngine` class to translate ValidationIssue codes to user-friendly messages
  - [ ] 2.6 Implement context variable substitution in error messages (e.g., {code}, {system}, {valueSet})
  - [ ] 2.7 Add suggested fixes generation based on error type and resource context
  - [ ] 2.8 Integrate ErrorMappingEngine into ValidationEngine result processing
  - [ ] 2.9 Add API endpoint to retrieve error explanations: GET /api/validation/errors/:code
  - [ ] 2.10 Create UI component to display enhanced errors with expandable suggestions
  - [ ] 2.11 Write unit tests for ErrorMappingEngine with various error scenarios
  - [ ] 2.12 Document error mapping JSON schema and contribution guidelines

- [ ] **3.0 HAPI Process Pool Management** - Implement Java process pooling to eliminate 20-30s startup delays
  - [ ] 3.1 Create `ProcessPoolManager` class to manage persistent Java processes
  - [ ] 3.2 Implement process lifecycle: spawn, warm-up (load core packages), ready state, graceful shutdown
  - [ ] 3.3 Add process pool configuration: size (default 2-4), max lifetime, idle timeout
  - [ ] 3.4 Implement round-robin or least-busy process selection for validation requests
  - [ ] 3.5 Add health checking for processes (periodic ping with simple validation)
  - [ ] 3.6 Implement automatic process restart on failure or timeout
  - [ ] 3.7 Create warmup routine to pre-load R4/R5/R6 core packages into processes
  - [ ] 3.8 Add process resource monitoring (memory usage, CPU) with alerts
  - [ ] 3.9 Update `HapiValidatorClient` to use process pool instead of spawning new processes
  - [ ] 3.10 Implement graceful pool shutdown on server shutdown
  - [ ] 3.11 Add metrics tracking: process utilization, queue depth, average validation time
  - [ ] 3.12 Write unit tests for ProcessPoolManager with mocked Java processes
  - [ ] 3.13 Write integration tests measuring validation performance improvement

- [ ] **4.0 Smart Profile Resolution** - Build intelligent profile resolver with automatic canonical URL resolution and caching
  - [ ] 4.1 Create `ProfileResolver` class with canonical URL → local profile mapping
  - [ ] 4.2 Implement multi-source profile search: local cache → Simplifier → FHIR Registry
  - [ ] 4.3 Add canonical URL normalization (handle version suffixes, trailing slashes)
  - [ ] 4.4 Implement automatic profile download with dependency resolution
  - [ ] 4.5 Create profile cache schema in database: canonical_url, version, content, dependencies
  - [ ] 4.6 Add IG package dependency graph resolution (identify and download required packages)
  - [ ] 4.7 Implement version-aware profile selection (prefer exact version, fallback to latest)
  - [ ] 4.8 Add profile metadata extraction from StructureDefinition resources
  - [ ] 4.9 Create auto-detection for German profiles (MII, ISiK, KBV) based on canonical patterns
  - [ ] 4.10 Integrate ProfileResolver into `ProfileValidator` validation workflow
  - [ ] 4.11 Add API endpoint: POST /api/profiles/resolve with {canonicalUrl, version?}
  - [ ] 4.12 Create UI notification when profiles are auto-downloaded
  - [ ] 4.13 Write unit tests for ProfileResolver with mocked Simplifier responses
  - [ ] 4.14 Write integration tests with real profile downloads and caching

- [ ] **5.0 Connectivity Detection & Auto-Fallback** - Implement network health monitoring with automatic online/offline mode switching
  - [ ] 5.1 Create `ConnectivityDetector` class with periodic health check scheduling
  - [ ] 5.2 Implement health check endpoints for terminology servers (tx.fhir.org, CSIRO)
  - [ ] 5.3 Add health check for Simplifier API availability
  - [ ] 5.4 Implement server status tracking: healthy, degraded, unhealthy, circuit-open
  - [ ] 5.5 Add automatic mode switching: online→offline on repeated failures, offline→online on recovery
  - [ ] 5.6 Create event emitter for connectivity state changes
  - [ ] 5.7 Implement graceful degradation: use cached data when servers unavailable
  - [ ] 5.8 Add manual mode override in validation settings
  - [ ] 5.9 Update ValidationEngine to listen to connectivity events and adjust behavior
  - [ ] 5.10 Create UI indicator showing current mode (online/offline) with server health status
  - [ ] 5.11 Add toast notifications when mode switches automatically
  - [ ] 5.12 Implement connectivity status dashboard: server health, response times, circuit breaker states
  - [ ] 5.13 Write unit tests for ConnectivityDetector with simulated network failures
  - [ ] 5.14 Write integration tests for auto-fallback behavior

- [ ] **6.0 Enhanced Reference Validation** - Upgrade reference validator with type checking and recursive validation
  - [ ] 6.1 Add resource type extraction from reference strings (e.g., "Patient/123" → "Patient")
  - [ ] 6.2 Implement reference type validation against StructureDefinition constraints
  - [ ] 6.3 Add support for contained resource reference validation
  - [ ] 6.4 Implement Bundle reference resolution (resolve internal references like "#resource-id")
  - [ ] 6.5 Add circular reference detection to prevent infinite loops
  - [ ] 6.6 Implement optional recursive validation (validate referenced resources)
  - [ ] 6.7 Add validation depth limit configuration (default: 1 level, max: 3 levels)
  - [ ] 6.8 Create reference integrity checking for version-specific references
  - [ ] 6.9 Add canonical reference validation (e.g., references to profiles, valuesets)
  - [ ] 6.10 Implement batched reference existence checks (HTTP HEAD requests in parallel)
  - [ ] 6.11 Update validation settings to enable/disable recursive reference validation
  - [ ] 6.12 Write unit tests for reference type validation
  - [ ] 6.13 Write integration tests with real FHIR server references

- [ ] **7.0 Multi-Layer Caching System** - Implement comprehensive caching strategy with L1 (memory), L2 (database), L3 (filesystem)
  - [ ] 7.1 Create `ValidationCacheManager` class coordinating L1/L2/L3 caches
  - [ ] 7.2 Implement L1 (in-memory) cache with LRU eviction and configurable size limits
  - [ ] 7.3 Add L1 cache TTL configuration: validation results (5min), profiles (30min), terminology (1hr)
  - [ ] 7.4 Create L2 database schema for persistent caching: validation_cache table with indexes
  - [ ] 7.5 Implement L2 cache queries with efficient lookups by resource hash and settings hash
  - [ ] 7.6 Add L3 filesystem cache for IG packages and downloaded profiles
  - [ ] 7.7 Implement cache key generation: SHA-256(resourceContent + settings + fhirVersion)
  - [ ] 7.8 Add cache statistics tracking: hit rate, miss rate, size, evictions
  - [ ] 7.9 Create cache invalidation logic on settings changes or profile updates
  - [ ] 7.10 Implement cache warming: pre-populate common profiles and terminology
  - [ ] 7.11 Add cache management API: GET /api/cache/stats, DELETE /api/cache/clear
  - [ ] 7.12 Create cache configuration in validation settings (size limits, TTLs, enabled layers)
  - [ ] 7.13 Write unit tests for cache layer integration
  - [ ] 7.14 Write performance tests measuring cache effectiveness

- [ ] **8.0 Enhanced Metadata Validation** - Extend metadata validator with provenance chain and security label validation
  - [ ] 8.1 Add meta.versionId format validation and consistency checking
  - [ ] 8.2 Implement meta.lastUpdated timestamp validation (format, timezone, chronological order)
  - [ ] 8.3 Add meta.source URI validation and format checking
  - [ ] 8.4 Implement meta.security label validation against security-labels ValueSet
  - [ ] 8.5 Add meta.tag validation (system, code, display consistency)
  - [ ] 8.6 Create Provenance resource linkage validation (verify target references)
  - [ ] 8.7 Implement provenance chain traversal (follow agent → entity chains)
  - [ ] 8.8 Add provenance timestamp consistency checking
  - [ ] 8.9 Implement audit trail integrity validation (verify signature if present)
  - [ ] 8.10 Add meta.profile validation (verify declared profiles exist and are accessible)
  - [ ] 8.11 Create validation rules for required metadata based on resource type
  - [ ] 8.12 Write unit tests for metadata validation scenarios
  - [ ] 8.13 Write integration tests with resources containing provenance chains

- [ ] **9.0 Visual Business Rules Editor** - Create user-friendly interface for FHIRPath rule creation and management
  - [ ] 9.1 Design rule editor UI with tabs: rule name, description, FHIRPath expression, resource types
  - [ ] 9.2 Implement FHIRPath syntax highlighting in code editor (CodeMirror or Monaco)
  - [ ] 9.3 Add FHIRPath autocomplete for resource fields and functions
  - [ ] 9.4 Create rule testing interface: load sample resource, execute rule, show results
  - [ ] 9.5 Implement rule library with pre-built rules for common scenarios
  - [ ] 9.6 Add rule templates: required field, conditional logic, cross-field validation
  - [ ] 9.7 Create rule management page: list, create, edit, delete, enable/disable
  - [ ] 9.8 Implement rule storage in database: rules table with versioning
  - [ ] 9.9 Add rule validation: parse FHIRPath, check syntax errors before saving
  - [ ] 9.10 Create API endpoints: GET/POST/PUT/DELETE /api/validation/rules
  - [ ] 9.11 Update `BusinessRuleValidator` to load rules from database
  - [ ] 9.12 Add rule execution performance monitoring
  - [ ] 9.13 Implement rule export/import for sharing between systems
  - [ ] 9.14 Write unit tests for rule CRUD operations
  - [ ] 9.15 Write E2E tests for rule editor workflow

- [ ] **10.0 Performance Benchmarking & Optimization** - Establish performance baseline and optimize to <2s interactive validation
  - [ ] 10.1 Create performance test suite with sample resources (Patient, Observation, Bundle)
  - [ ] 10.2 Establish baseline metrics: cold start time, warm cache time, throughput
  - [ ] 10.3 Implement performance monitoring: track validation time per aspect
  - [ ] 10.4 Add detailed timing breakdowns: HAPI spawn, package load, validation, post-processing
  - [ ] 10.5 Identify bottlenecks using profiling tools (Chrome DevTools, clinic.js)
  - [ ] 10.6 Optimize structural validation: ensure process pool is effective
  - [ ] 10.7 Optimize terminology validation: batch requests, aggressive caching
  - [ ] 10.8 Optimize profile validation: pre-load common profiles, cache IG packages
  - [ ] 10.9 Optimize reference validation: batch HTTP requests, HEAD instead of GET
  - [ ] 10.10 Implement parallel aspect validation where safe (no dependencies)
  - [ ] 10.11 Add validation result streaming for large batches (progressive results)
  - [ ] 10.12 Create performance dashboard showing validation metrics over time
  - [ ] 10.13 Document optimization techniques and configuration tuning guide
  - [ ] 10.14 Verify <2s target achieved for interactive validation (95th percentile)

- [ ] **11.0 Integration Testing & Quality Assurance** - Comprehensive testing of all validation aspects with real FHIR data
  - [ ] 11.1 Create test data set with diverse FHIR resources (R4, R5, R6)
  - [ ] 11.2 Add positive test cases: valid resources that should pass validation
  - [ ] 11.3 Add negative test cases: invalid resources with known errors
  - [ ] 11.4 Create integration tests for each validation aspect independently
  - [ ] 11.5 Write end-to-end tests for multi-aspect validation workflows
  - [ ] 11.6 Add tests for error mapping: verify user-friendly messages appear
  - [ ] 11.7 Create tests for profile auto-resolution workflow
  - [ ] 11.8 Add tests for online/offline mode switching and fallback
  - [ ] 11.9 Write tests for cache effectiveness and invalidation
  - [ ] 11.10 Add performance regression tests (validate against time thresholds)
  - [ ] 11.11 Create tests with real terminology servers (tx.fhir.org)
  - [ ] 11.12 Add tests with real profile downloads from Simplifier
  - [ ] 11.13 Implement CI/CD pipeline integration with test execution
  - [ ] 11.14 Create test coverage report and ensure >80% coverage

- [ ] **12.0 Documentation & Migration Guide** - Document new features, configuration options, and migration paths
  - [ ] 12.1 Update validation engine architecture documentation
  - [ ] 12.2 Document error mapping system and how to add new mappings
  - [ ] 12.3 Create terminology validation configuration guide
  - [ ] 12.4 Document process pool management and tuning guide
  - [ ] 12.5 Write profile resolution system documentation
  - [ ] 12.6 Document connectivity detection and hybrid mode configuration
  - [ ] 12.7 Create caching system documentation with tuning recommendations
  - [ ] 12.8 Write business rules editor user guide
  - [ ] 12.9 Document API changes and new endpoints
  - [ ] 12.10 Create migration guide from old validation system
  - [ ] 12.11 Document configuration options in validation-settings.ts
  - [ ] 12.12 Write troubleshooting guide for common issues
  - [ ] 12.13 Create performance tuning guide
  - [ ] 12.14 Update README.md with validation engine overview and quick start

---

## Notes

### Implementation Priority
Based on PRD recommendations, the priority order is:
1. **High Priority (Weeks 1-2):** Tasks 1.0 (Terminology), 2.0 (Error Mapping)
2. **Medium Priority (Weeks 3-4):** Tasks 3.0 (Process Pool), 4.0 (Profile Resolution)
3. **Standard Priority (Weeks 5-8):** Tasks 5.0-9.0
4. **Final Phase (Weeks 9-10):** Tasks 10.0-12.0

### Current State Assessment
- **Working Well:** Structural validation via HAPI, basic profile validation
- **Needs Major Work:** Terminology validation (disabled), error reporting
- **Needs Enhancement:** Reference validation, metadata validation, caching
- **New Features:** Error mapping, connectivity detection, process pooling

### Architecture Patterns to Follow
- Maintain modular 6-aspect validation framework
- Use dependency injection for service dependencies
- Implement circuit breaker pattern for external services
- Follow existing TypeScript patterns and error handling
- Keep files under 400 lines (extract to utilities as needed)

### Testing Strategy
- Unit tests for each validator component
- Integration tests for multi-aspect validation flows
- Performance tests for caching and process pooling
- End-to-end tests with real FHIR servers
- Mock external services (Simplifier, tx.fhir.org) for CI/CD

---

**Ready to generate detailed sub-tasks?**  
Respond with **"Go"** to proceed with breaking down each parent task into actionable sub-tasks.

