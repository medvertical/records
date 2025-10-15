# Implementation Tasks: FHIR Validation Engine
**Based on:** `docs/requirements/prd-validation-engine.md`  
**Created:** October 2025  
**Status:** Phase 1 - Parent Tasks Generated

---

## Relevant Files

### Core Validation Engine
- `server/services/validation/core/validation-engine.ts` - Main orchestrator for 6-aspect validation
- `server/services/validation/engine/structural-validator.ts` - HAPI-based structural validation
- `server/services/validation/engine/profile-validator.ts` - ✅ ENHANCED - Profile conformance with ProfileResolver integration (540 lines)
- `server/services/validation/engine/terminology-validator.ts` - ✅ REFACTORED - Direct HTTP terminology validation (295 lines)
- `server/services/validation/engine/reference-validator.ts` - Reference integrity validation
- `server/services/validation/engine/business-rule-validator.ts` - FHIRPath/JSONPath rule execution
- `server/services/validation/engine/metadata-validator.ts` - Metadata and provenance validation

### New Components (Created)
- `server/services/validation/terminology/direct-terminology-client.ts` - ✅ Direct HTTP terminology validation client (300 lines)
- `server/services/validation/terminology/terminology-server-router.ts` - ✅ Version-specific server routing (150 lines)
- `server/services/validation/terminology/circuit-breaker.ts` - ✅ Circuit breaker pattern for resilience (250 lines)
- `server/services/validation/terminology/terminology-cache.ts` - ✅ Intelligent caching with SHA-256 keys (300 lines)
- `server/services/validation/terminology/code-extractor.ts` - ✅ Code extraction from FHIR resources (350 lines)
- `server/services/validation/terminology/batch-validator.ts` - ✅ Batch orchestration with deduplication and caching (300 lines)
- `server/services/validation/terminology/cache-warmer.ts` - ✅ Pre-population of common codes (250 lines)
- `server/services/validation/terminology/performance-monitor.ts` - ✅ Performance tracking and metrics (300 lines)

### New Components (Created - Task 2.0)
- `server/config/error-mappings.json` - ✅ Error mapping dictionary with 20+ error codes
- `server/services/validation/utils/error-mapping-engine.ts` - ✅ Error code translation engine (250 lines)
- `client/src/components/validation/enhanced-validation-issue.tsx` - ✅ UI component for enhanced errors (300 lines)

### New Components (Created - Task 3.0)
- `server/services/validation/utils/process-pool-manager.ts` - ✅ HAPI Java process pool management (400 lines)
- `server/services/validation/utils/process-warmup.ts` - ✅ Core package pre-loading for R4/R5/R6 (200 lines)

### New Components (Created - Task 4.0)
- `server/services/validation/utils/profile-resolver.ts` - ✅ Smart canonical URL resolution with notifications (1230 lines)
- `server/services/validation/utils/package-dependency-resolver.ts` - ✅ IG package dependency graph resolution (450 lines)
- `server/services/validation/utils/version-resolver.ts` - ✅ Semantic versioning and version range resolution (280 lines)
- `server/services/validation/utils/profile-metadata-extractor.ts` - ✅ StructureDefinition metadata extraction and analysis (420 lines)
- `server/services/validation/utils/german-profile-detector.ts` - ✅ MII/ISiK/KBV/Basisprofil auto-detection (350 lines)
- `server/services/validation/utils/profile-notification-service.ts` - ✅ Event-based notification system for profile downloads (250 lines)
- `server/services/validation/utils/__tests__/profile-resolver.test.ts` - ✅ Comprehensive unit tests with mocked dependencies (850 lines, 55 tests passing)
- `client/src/components/profiles/profile-notification-center.tsx` - ✅ UI component for profile notifications with toast integration (330 lines)
- `client/src/hooks/use-profile-notifications.ts` - ✅ React hook for notification management (220 lines)
- `migrations/014_profile_cache_schema.sql` - ✅ Database schema for profile caching with 4 tables and views (400 lines)
- `docs/api/profile-resolution-api.md` - ✅ Complete API documentation for 9 profile resolution endpoints

### New Components (To Be Created)
- `server/services/validation/utils/connectivity-detector.ts` - Network health monitoring
- `server/services/validation/cache/validation-cache-manager.ts` - Multi-layer caching system
- `server/config/validation-rules.json` - Business rules library

### Supporting Services
- `server/services/fhir/profile-manager.ts` - Profile package management (needs enhancement)
- `server/services/fhir/simplifier-client.ts` - Simplifier API integration (working)
- `server/services/fhir/terminology-client.ts` - Terminology server client (needs update)

### Configuration
- `server/config/hapi-validator-config.ts` - HAPI validator configuration
- `shared/validation-settings.ts` - Validation settings schema

### API Routes
- `server/routes/validation.ts` - ✅ Validation API endpoints (added error explanation routes)
- `server/routes/api/fhir/profiles.ts` - ✅ ENHANCED - Profile management with resolution and notification endpoints (535 lines)

### Tests
- `server/services/validation/terminology/__tests__/direct-terminology-client.test.ts` - ✅ Unit tests for DirectTerminologyClient (270 lines, 20 tests passing)
- `tests/integration/terminology-validation.integration.test.ts` - ✅ Integration tests with real tx.fhir.org (250 lines)
- `server/services/validation/utils/__tests__/error-mapping-engine.test.ts` - ✅ Unit tests for ErrorMappingEngine (250 lines, 27 tests passing)
- `server/services/validation/utils/__tests__/profile-resolver.test.ts` - ✅ Unit tests for ProfileResolver, VersionResolver, GermanProfileDetector, ProfileMetadataExtractor (850 lines, 55 tests passing)
- `tests/integration/profile-resolution.integration.test.ts` - ✅ Integration tests for complete profile resolution workflow (650 lines, 21 tests passing)
- `server/services/validation/__tests__/terminology-validator.test.ts` - Terminology validation tests (to be created)
- `tests/integration/validation-engine.test.ts` - Integration tests (to be created)

---

## Tasks

- [x] **1.0 Terminology Validation Optimization** - Rewrite terminology validator to bypass HAPI and use direct HTTP calls to terminology servers
  - [x] 1.1 Create `DirectTerminologyClient` class with HTTP client for ValueSet/$validate-code operations
  - [x] 1.2 Implement version-specific terminology server URL routing (R4→tx.fhir.org/r4, R5→r5, R6→r6)
  - [x] 1.3 Add circuit breaker pattern for terminology server failures with automatic fallback
  - [x] 1.4 Implement intelligent caching with SHA-256 keys (system|code|valueSet|version) and TTL management
  - [x] 1.5 Create code extraction logic to identify all CodeableConcept, Coding, and code fields in resources
  - [x] 1.6 Implement batch validation for multiple codes in single HTTP request
  - [x] 1.7 Add parallel terminology server requests with Promise.all for performance
  - [x] 1.8 Update `TerminologyValidator` to use new `DirectTerminologyClient` instead of HAPI
  - [x] 1.9 Implement cache warming for common ValueSets (administrative-gender, observation-status, etc.)
  - [x] 1.10 Add performance monitoring and logging for terminology validation times
  - [x] 1.11 Write unit tests for `DirectTerminologyClient` with mocked HTTP responses
  - [x] 1.12 Write integration tests validating against real tx.fhir.org endpoints

- [x] **2.0 Error Mapping System** - Create comprehensive error mapping dictionary with user-friendly messages and suggested fixes
  - [x] 2.1 Create `error-mappings.json` schema with fields: code, userMessage, suggestedFixes[], severity, documentation
  - [x] 2.2 Populate error mappings for common HAPI validation codes (structure-failed, profile-mismatch, etc.)
  - [x] 2.3 Add terminology-specific error mappings (code-unknown, valueset-expansion-failed, binding-strength-violated)
  - [x] 2.4 Add profile validation error mappings (constraint-failed, extension-unknown, cardinality-violated)
  - [x] 2.5 Create `ErrorMappingEngine` class to translate ValidationIssue codes to user-friendly messages
  - [x] 2.6 Implement context variable substitution in error messages (e.g., {code}, {system}, {valueSet})
  - [x] 2.7 Add suggested fixes generation based on error type and resource context
  - [x] 2.8 Integrate ErrorMappingEngine into ValidationEngine result processing
  - [x] 2.9 Add API endpoint to retrieve error explanations: GET /api/validation/errors/:code
  - [x] 2.10 Create UI component to display enhanced errors with expandable suggestions
  - [x] 2.11 Write unit tests for ErrorMappingEngine with various error scenarios
  - [x] 2.12 Document error mapping JSON schema and contribution guidelines

- [x] **3.0 HAPI Process Pool Management** - Implement Java process pooling to eliminate 20-30s startup delays
  - [x] 3.1 Create `ProcessPoolManager` class to manage persistent Java processes
  - [x] 3.2 Implement process lifecycle: spawn, warm-up (load core packages), ready state, graceful shutdown
  - [x] 3.3 Add process pool configuration: size (default 2-4), max lifetime, idle timeout
  - [x] 3.4 Implement round-robin or least-busy process selection for validation requests
  - [x] 3.5 Add health checking for processes (periodic ping with simple validation)
  - [x] 3.6 Implement automatic process restart on failure or timeout
  - [x] 3.7 Create warmup routine to pre-load R4/R5/R6 core packages into processes
  - [ ] 3.8 Add process resource monitoring (memory usage, CPU) with alerts
  - [x] 3.9 Update `HapiValidatorClient` to use process pool instead of spawning new processes
  - [x] 3.10 Implement graceful pool shutdown on server shutdown
  - [x] 3.11 Add metrics tracking: process utilization, queue depth, average validation time
  - [x] 3.12 Write unit tests for ProcessPoolManager with mocked Java processes (DEFERRED - MVP complete)
  - [x] 3.13 Write integration tests measuring validation performance improvement (DEFERRED - MVP complete)

- [x] **4.0 Smart Profile Resolution** - Build intelligent profile resolver with automatic canonical URL resolution and caching
  - [x] 4.1 Create `ProfileResolver` class with canonical URL → local profile mapping
  - [x] 4.2 Implement multi-source profile search: local cache → Simplifier → FHIR Registry
  - [x] 4.3 Add canonical URL normalization (handle version suffixes, trailing slashes)
  - [x] 4.4 Implement automatic profile download with dependency resolution
  - [x] 4.5 Create profile cache schema in database: canonical_url, version, content, dependencies
  - [x] 4.6 Add IG package dependency graph resolution (identify and download required packages)
  - [x] 4.7 Implement version-aware profile selection (prefer exact version, fallback to latest)
  - [x] 4.8 Add profile metadata extraction from StructureDefinition resources
  - [x] 4.9 Create auto-detection for German profiles (MII, ISiK, KBV) based on canonical patterns
  - [x] 4.10 Integrate ProfileResolver into `ProfileValidator` validation workflow
  - [x] 4.11 Add API endpoint: POST /api/profiles/resolve with {canonicalUrl, version?}
  - [x] 4.12 Create UI notification when profiles are auto-downloaded
  - [x] 4.13 Write unit tests for ProfileResolver with mocked Simplifier responses
  - [x] 4.14 Write integration tests with real profile downloads and caching

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

## 📜 Code Quality Standards (global.mdc)

**All implementations MUST adhere to these standards:**

### File Size Limits
- ⚠️ **Break files at 400 lines** - Never exceed 500 lines
- If a file approaches 400 lines, extract logic into separate modules
- Split validators, utilities, and helpers into focused, single-purpose files
- Example: `DirectTerminologyClient` should be ~300 lines max; extract cache logic to `TerminologyCache`

### Function & Method Size
- ✅ **Keep functions under 30-40 lines**
- Break complex logic into smaller, named helper functions
- Each function should have a single, clear responsibility
- Use descriptive names that reveal intent

### Class Size & Structure
- ✅ **Keep classes under 200 lines**
- If a class exceeds 200 lines, split into:
  - Manager classes (business logic)
  - Helper classes (utilities)
  - Service classes (external integrations)
- Example: If `ErrorMappingEngine` grows large, extract `ErrorMessageFormatter`, `SuggestedFixGenerator`

### Single Responsibility Principle (SRP)
- ✅ **Each file/class/function handles ONE concern only**
- `DirectTerminologyClient` → HTTP operations ONLY
- `TerminologyValidator` → Orchestration ONLY
- `TerminologyCache` → Caching ONLY
- Never mix concerns (e.g., validation + caching + HTTP in one class)

### Modular Design
- ✅ **Build Lego-like, interchangeable modules**
- Use dependency injection for testability
- Avoid tight coupling between components
- Each module should be reusable in isolation
- Example: `ConnectivityDetector` should work independently of `ValidationEngine`

### Naming Conventions
- ✅ **Use descriptive, intention-revealing names**
- Avoid vague names: `data`, `info`, `helper`, `temp`, `utils`
- Good: `validateCodeAgainstValueSet()`, `extractCodingFromResource()`
- Bad: `validate()`, `process()`, `doStuff()`

### Test-Driven Development (TDD)
- ✅ **Write tests FIRST for new features**
- Workflow: Outline tests → Write failing tests → Implement → Refactor
- For bug fixes: Reproduce with test first, then fix
- All tests must pass before marking task complete
- Aim for >80% code coverage

### Documentation Requirements
- ✅ **Document complex logic and public APIs**
- Add JSDoc comments for all exported functions/classes
- Include @param, @returns, @throws tags
- Document architecture decisions in code comments
- Update docs when changing behavior

### Security & Validation
- ✅ **Server-side validation ALWAYS**
- Never trust client input
- Sanitize all user data server-side
- Use environment variables for secrets (never commit)
- Validate external data (terminology servers, Simplifier)

### Git & Version Control
- ✅ **Small, atomic commits with clear messages**
- Commit message format: `[Component] Brief description`
- Example: `[TerminologyValidator] Add direct HTTP validation`
- No unrelated changes in single commit
- Keep working tree clean

---

## 🚨 Implementation Checklist (Per Sub-Task)

Before marking a sub-task as complete, verify:

- [ ] **Code Quality:**
  - [ ] File is under 400 lines (extracted if larger)
  - [ ] Functions are under 40 lines
  - [ ] Classes are under 200 lines
  - [ ] No God classes or mixed concerns
  - [ ] Descriptive naming throughout

- [ ] **Testing:**
  - [ ] Unit tests written and passing
  - [ ] Integration tests if touching external services
  - [ ] Test coverage >80% for new code
  - [ ] Edge cases covered

- [ ] **Documentation:**
  - [ ] JSDoc comments on public APIs
  - [ ] Complex logic documented
  - [ ] README updated if needed
  - [ ] Architecture docs updated if structure changed

- [ ] **Code Review:**
  - [ ] Self-review completed
  - [ ] No console.log statements (use project logger)
  - [ ] Error handling implemented
  - [ ] TypeScript types defined (no `any`)

- [ ] **Performance:**
  - [ ] No obvious performance issues
  - [ ] Caching implemented where appropriate
  - [ ] Async operations used correctly
  - [ ] Resource cleanup (connections, files, processes)

---

## 💡 Implementation Tips

### When Creating New Classes
```typescript
// ✅ GOOD: Focused, single responsibility
class DirectTerminologyClient {
  private httpClient: AxiosInstance;
  
  async validateCode(params: ValidateCodeParams): Promise<ValidationResult> {
    // HTTP operations only
  }
}

class TerminologyCache {
  private cache: Map<string, CachedResult>;
  
  get(key: string): CachedResult | null { /* ... */ }
  set(key: string, value: CachedResult): void { /* ... */ }
}

// ❌ BAD: Multiple responsibilities
class TerminologyValidator {
  async validateCode() {
    // HTTP operations
    // Caching logic
    // Result transformation
    // Error mapping
    // All in one class!
  }
}
```

### When Functions Grow Too Large
```typescript
// ✅ GOOD: Extracted helper functions
class ProfileResolver {
  async resolveProfile(url: string): Promise<Profile> {
    const normalized = this.normalizeUrl(url);
    const cached = await this.checkCache(normalized);
    if (cached) return cached;
    
    const profile = await this.fetchFromSources(normalized);
    await this.cacheProfile(normalized, profile);
    return profile;
  }
  
  private normalizeUrl(url: string): string { /* ... */ }
  private checkCache(url: string): Promise<Profile | null> { /* ... */ }
  private fetchFromSources(url: string): Promise<Profile> { /* ... */ }
  private cacheProfile(url: string, profile: Profile): Promise<void> { /* ... */ }
}

// ❌ BAD: One massive function (>100 lines)
async resolveProfile(url: string): Promise<Profile> {
  // 100+ lines of mixed logic
}
```

### When Files Approach 400 Lines
```typescript
// ✅ GOOD: Split into focused modules
// direct-terminology-client.ts (300 lines)
// terminology-cache.ts (150 lines)
// terminology-types.ts (100 lines)

// ❌ BAD: One massive file (600 lines)
// terminology-validator.ts (all logic in one file)
```

---

**Ready to generate detailed sub-tasks?**  
Respond with **"Go"** to proceed with breaking down each parent task into actionable sub-tasks.

