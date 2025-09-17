## Relevant Files

- `server/services/validation/rock-solid-validation-engine.ts` - Default 6-layer validation engine (target core engine)
- `server/services/validation/validation-pipeline.ts` - Orchestrator for single/batch validation over Rock Solid engine
- `server/services/validation/unified-validation.ts` - Current service used by routes; to be adapted to delegate to Pipeline (compat layer)
- `server/services/validation/enhanced-validation-engine.ts` - Legacy comprehensive engine (to be deprecated)
- `server/services/validation/validation-engine.ts` - Older rules-based validator (to be deprecated)
- `server/services/validation/robust-validation.ts` - Batch validator with progress/state (to be replaced by Pipeline batch mode)
- `server/services/validation/bulk-validation.ts` - Legacy bulk (to be removed)
- `server/services/validation/bulk-validation-new.ts` - Alternative bulk impl (to be removed)
- `server/services/validation/validation-settings-service.ts` - Centralized validation settings (single source of truth)
- `server/services/validation/validation-settings-errors.ts` - Error types and helpers for settings
- `server/services/validation/validation-notification-service.ts` - Eventing/notifications; should consume canonical pipeline events
- `server/services/validation/validation-performance-service.ts` - Performance metrics over validation results
- `server/services/validation/validation-quality-service.ts` - Quality metrics over validation results
- `server/services/validation/validation-comparison-service.ts` - Cross-run comparison utilities
- `server/services/validation/validation-report-service.ts` - Report generation from validation results
- `server/services/validation/validation-state-service.ts` - Validation state; ensure it reflects Pipeline status
- `server/routes.ts` - API endpoints; migrate to Pipeline/Unified adapter and remove legacy engine usage
- `server/storage.ts` - Storage integration for results/settings where needed
- `client/src/hooks/use-validation-sse.ts` - SSE consumer; keep unchanged but ensure messages originate from Pipeline
- `client/src/components/dashboard/validation-engine-card.tsx` - UI card reflecting engine; update to show Rock Solid 6 layers
- `client/src/pages/dashboard.tsx` - Dashboard reads validation stats; ensure compatibility with Pipeline
- `server/services/dashboard/dashboard-service.ts` - Aggregations for dashboard; normalize to pipeline result model
- `server/tests/validation-progress-tests.ts` - Validation progress tests; update to pipeline
- `server/services/validation/validation-engine.test.ts` - Engine tests; replace/port to Rock Solid/Pipeline tests
- `docs/validation-pipeline-operations.md` - Operational documentation for ValidationPipeline batch execution

### Notes

- Unit tests should be placed alongside the code files they are testing (e.g., `validation-pipeline.ts` and `validation-pipeline.test.ts`)
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration
- Maintain SSE for progress updates; do not reintroduce WebSockets
- Preserve current API response shapes where necessary using a temporary adapter layer to avoid breaking the UI; introduce v2 endpoints only if needed

### Parity Notes (default engine vs. legacy/enhanced)

- Profile handling
  - Legacy: auto-detects profiles (resource.meta.profile + heuristics), validates via Simplifier/FHIR server.
  - Default: profile validation via `profileResolutionServers` from settings. Action: add optional pre-processing for auto-detect; consider optional Simplifier integration behind settings.
- Terminology validation
  - Legacy/Enhanced: TerminologyClient with multiple servers/priorities.
  - Default: driven by `terminologyServers` with priority; verify priority ordering and expansion caching.
- Business rules / custom rules
  - Legacy: `ValidationRule[]` custom rules applied per resource.
  - Default: BusinessRule aspect. Action: provide mapper to translate `ValidationRule` into business-rule checks or run a post-processor in adapter.
- Server-side $validate fallback
  - Legacy: may call FHIR server validation.
  - Default: engine-first. Action: optional fallback via adapter (feature-flagged) if parity required.
- Caching & performance
  - Enhanced: profile cache, timeout per aspect, max concurrency.
  - Default: supports `cacheSettings`, `timeoutSettings`, `maxConcurrentValidations`. Action: ensure settings are honored and logged.
- Issue model & filtering
  - Unified filters per active settings.
  - Action: centralize filtering in Pipeline/adapter; standardize issue codes/severities/aspect tagging.
- Batch control & progress
  - Robust supports pause/resume/state.
  - Pipeline: batch orchestration, SSE progress; pause/resume TBD. Action: either implement pause/resume or de-scope with clear API behavior.
- Output shape compatibility
  - Action: adapter maps default engine result → legacy response shape for routes still expecting it; keep UI stable during migration.

## Tasks

- [ ] 1.0 Consolidate on default 6-layer validation engine
  - [x] 1.1 Audit all engine usages across routes and services
  - [x] 1.2 Catalogue parity requirements vs Enhanced/legacy engines
  - [x] 1.3 Add any missing 6-layer features to default engine
  - [x] 1.4 Align issue shapes, severities, and aspect tagging
  - [x] 1.5 Add engine health/status metrics and debug logging
  - [x] 1.6 Document engine configuration from settings service

- [ ] 2.0 Establish `ValidationPipeline` as the single orchestrator (single and batch)
  - [x] 2.1 Implement single-resource validation entry with timeouts
  - [x] 2.2 Implement batch validation with concurrency controls
  - [x] 2.3 Emit progress events compatible with existing SSE topics
  - [x] 2.4 Reconfigure pipeline on settingsChanged events
  - [x] 2.5 Add optional result caching with TTL controls
  - [x] 2.6 Expose pipeline facade for DI and testing

- [ ] 3.0 Implement `UnifiedValidationService` adapter that delegates to `ValidationPipeline`
  - [x] 3.1 Map legacy validate APIs to pipeline equivalents
  - [x] 3.2 Preserve legacy response shape via mapping helpers
  - [x] 3.3 Centralize settings-based filtering in adapter
  - [x] 3.4 Wire settings service listeners for cache invalidation
  - [x] 3.5 Add deprecation warnings and telemetry
  - [ ] 3.6 Cover adapter with unit tests

- [ ] 4.0 Migrate API routes to Pipeline/adapter; remove direct use of legacy engines
  - [x] 4.1 Switch single validation endpoints to adapter/pipeline
  - [x] 4.2 Switch bulk validation endpoints to pipeline batch
  - [x] 4.3 Remove direct instantiations of legacy engines
  - [x] 4.4 Keep response schemas stable; add v2 if needed
  - [x] 4.5 Update error handling to canonical error model

- [x] 5.0 Replace Robust/Bulk validation with Pipeline batch mode and progress via SSE
  - [x] 5.1 Replace RobustValidationService usage with pipeline batch
  - [x] 5.2 Map robust progress fields to pipeline progress
  - [x] 5.3 Ensure SSE messages originate from pipeline
  - [x] 5.4 Remove legacy robust/bulk services after cutover
  - [x] 5.5 Update operational docs for batch execution

- [ ] 6.0 Normalize validation result model and settings-based filtering in one canonical place
  - [ ] 6.1 Define canonical ValidationResult and ValidationIssue types
  - [ ] 6.2 Implement settings-based issue filtering centrally
  - [ ] 6.3 Provide mappers for legacy result consumers
  - [ ] 6.4 Update aggregation helpers for dashboard stats
  - [ ] 6.5 Add versioned result model notes for API stability

- [ ] 7.0 Update satellite services (quality, performance, reports, comparison, state, scheduler) to consume the canonical model
  - [ ] 7.1 Refactor validation-quality-service to canonical model
  - [ ] 7.2 Refactor validation-performance-service metrics inputs
  - [ ] 7.3 Refactor validation-report-service data sources
  - [ ] 7.4 Refactor validation-comparison-service diff logic
  - [ ] 7.5 Align validation-state-service and scheduler with pipeline

- [ ] 8.0 Update frontend engine/status displays to reflect the default engine's 6 layers (keep SSE endpoints stable)
  - [ ] 8.1 Update validation-engine-card to show 6-layer aspects
  - [ ] 8.2 Ensure SSE subscriptions remain unchanged
  - [ ] 8.3 Adjust dashboard aggregations if field names changed
  - [ ] 8.4 Add per-aspect counts and timing indicators

- [ ] 9.0 Remove deprecated engines and obsolete code (Enhanced, legacy ValidationEngine, Robust, Bulk)
  - [ ] 9.1 Delete enhanced-validation-engine and references
  - [ ] 9.2 Delete legacy validation-engine and references
  - [ ] 9.3 Remove robust-validation and bulk-validation files
  - [ ] 9.4 Purge dead imports and update build configs
  - [ ] 9.5 Run type checks to ensure no dangling usages

- [ ] 10.0 Add comprehensive tests and docs for the consolidated architecture
  - [ ] 10.1 Add unit tests for pipeline single and batch
  - [ ] 10.2 Add adapter mapping and filtering tests
  - [ ] 10.3 Add route integration tests and snapshots
  - [ ] 10.4 Add SSE progress tests for batch mode
  - [ ] 10.5 Update architecture docs and migration guide


