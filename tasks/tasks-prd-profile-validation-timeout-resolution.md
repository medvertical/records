# Task List: Profile Validation Timeout Resolution

## Relevant Files

### Configuration Files
- `server/config/validation-timeouts.ts` - **[CREATED]** Centralized timeout configuration module
- `server/config/hapi-validator-config.ts` - **[MODIFIED]** HAPI validator timeout configuration (now uses centralized config)
- `server/config/feature-flags.ts` - **[MODIFIED]** Environment-based configuration (now logs timeout config)
- `server/services/validation/core/validation-engine.ts` - **[MODIFIED]** Validation engine timeout configuration (uses centralized config)
- `server/services/validation/engine/validation-engine-per-aspect.ts` - **[MODIFIED]** Per-aspect timeout configuration (uses centralized config)
- `server/services/validation/engine/profile-validator.ts` - **[MODIFIED]** Profile validator with resolution timeout (30s, uses centralized config)
- `server/services/validation/engine/hapi-process-pool.ts` - **[MODIFIED]** Process pool timeout configuration (uses centralized config)

### Client Files
- `client/src/hooks/use-validation-polling.ts` - **[MODIFIED]** Client HTTP request timeout (increased to 120s)
- `client/src/hooks/use-validation-progress.ts` - Progress tracking and status
- `client/src/components/ui/validation-aspects-dropdown.tsx` - Validation settings UI

### Shared Files
- `shared/validation-settings.ts` - Validation settings schema (needs timeout fields)

### Testing Files (to be updated)
- `server/services/validation/engine/profile-validator.test.ts` - Profile validator tests
- `server/services/validation/engine/hapi-validator-client.test.ts` - HAPI client tests

## Notes

- All timeouts should be in milliseconds for consistency
- Client timeout must be greater than server timeout to prevent premature cancellation
- Use environment variables with sensible defaults
- Ensure backward compatibility with existing configurations

---

## Tasks

- [x] 1.0 **Centralize Timeout Configuration**
  - [x] 1.1 Create `server/config/validation-timeouts.ts` module to define all timeout values in one place
  - [x] 1.2 Define `ValidationTimeouts` interface with timeout values for: `clientHttp`, `validationEngine`, `hapiProcess`, `profileResolution`, `terminologyLookup`, `referenceCheck`
  - [x] 1.3 Implement `getValidationTimeouts()` function that loads timeouts from environment variables with fallback to defaults
  - [x] 1.4 Define default timeout values: `clientHttp: 120000` (2min), `validationEngine: 90000` (1.5min), `hapiProcess: 75000` (75s), `profileResolution: 30000` (30s)
  - [x] 1.5 Add environment variable support: `VALIDATION_TIMEOUT_CLIENT`, `VALIDATION_TIMEOUT_ENGINE`, `VALIDATION_TIMEOUT_HAPI`, `VALIDATION_TIMEOUT_PROFILE_RESOLUTION`
  - [x] 1.6 Add validation to ensure timeout cascade: `clientHttp > validationEngine > hapiProcess > profileResolution`
  - [x] 1.7 Export `ValidationTimeouts` singleton instance for use across the application
  - [x] 1.8 Add logging to show configured timeout values on application startup

- [x] 2.0 **Update Server-Side Timeout Configuration**
  - [x] 2.1 Update `server/config/hapi-validator-config.ts` to import and use `ValidationTimeouts.hapiProcess`
  - [x] 2.2 Update `server/config/feature-flags.ts` to import and use `ValidationTimeouts.validationEngine` instead of hardcoded `75000`
  - [x] 2.3 Update `server/services/validation/core/validation-engine.ts:578` to use `ValidationTimeouts.validationEngine` for profile aspect timeout
  - [x] 2.4 Update `server/services/validation/engine/validation-engine-per-aspect.ts:49` to use `ValidationTimeouts.validationEngine` for profile aspect timeout
  - [x] 2.5 Update `server/services/validation/engine/profile-validator.ts:226` to use `ValidationTimeouts.profileResolution` for profile resolution timeout (increase from 10000 to 30000)
  - [x] 2.6 Update `server/services/validation/engine/hapi-process-pool.ts:182` to use `ValidationTimeouts.hapiProcess` for process pool job timeout
  - [x] 2.7 Update `server/services/validation/engine/hapi-validator-client.ts:266` to use `ValidationTimeouts.hapiProcess` for HAPI validation timeout (uses config via hapiValidatorConfig)
  - [x] 2.8 Remove all hardcoded timeout values (grep for `30000`, `75000`, `60000`) and replace with centralized configuration

- [ ] 3.0 **Update Client-Side Timeout Configuration**
  - [x] 3.1 Update `client/src/hooks/use-validation-polling.ts:99` to increase `requestTimeout` default from `30000` to `120000` (2 minutes)
  - [ ] 3.2 Add environment variable support in client: `VITE_VALIDATION_TIMEOUT` for configurable client timeout
  - [ ] 3.3 Update `client/src/hooks/use-validation-progress.ts` to use increased timeout value
  - [ ] 3.4 Add timeout configuration to validation settings UI in `client/src/components/ui/validation-aspects-dropdown.tsx`
  - [ ] 3.5 Display current timeout values in settings panel for user awareness
  - [ ] 3.6 Add warning message if client timeout is less than recommended value (< 120 seconds)
  - [ ] 3.7 Update all API calls to validation endpoints to use increased timeout values

- [ ] 4.0 **Improve Profile Resolution Performance**
  - [ ] 4.1 Update `server/services/validation/engine/profile-validator.ts:220-232` to increase profile resolution timeout from 10s to 30s
  - [ ] 4.2 Add detailed logging in `resolveProfileBeforeValidation()` to track resolution time and identify bottlenecks
  - [ ] 4.3 Implement parallel dependency resolution in `server/services/validation/utils/profile-resolver.ts` (if dependencies are resolved sequentially)
  - [ ] 4.4 Increase profile cache TTL in cache configuration from default to 7 days for stable profiles
  - [ ] 4.5 Add profile preloading for common German profiles (KBV, MII, ISiK) in `server/services/validation/profiles/profile-preloader.ts`
  - [ ] 4.6 Call profile preloader during application startup in `server/routes.ts` or `server.ts`
  - [ ] 4.7 Skip profile resolution for core FHIR profiles (already in HAPI) to avoid unnecessary delays
  - [ ] 4.8 Add cache hit/miss metrics to profile resolver for monitoring

- [ ] 5.0 **Enhance Error Messages and User Feedback**
  - [ ] 5.1 Update `server/services/validation/core/validation-engine.ts:596-605` to create detailed timeout error messages
  - [ ] 5.2 Include timeout duration, aspect name, and suggestions in timeout error messages
  - [ ] 5.3 Add error code `PROFILE_VALIDATION_TIMEOUT` to distinguish profile timeouts from other timeouts
  - [ ] 5.4 Update `client/src/components/validation/validation-message-panel.tsx` to display timeout errors prominently
  - [ ] 5.5 Add actionable suggestions in UI: "Profile validation timed out. Try: 1) Increase timeout in settings, 2) Validate again (profile may be cached)"
  - [ ] 5.6 Add retry button with extended timeout option in validation error display
  - [ ] 5.7 Show estimated time remaining during profile validation (if possible)
  - [ ] 5.8 Display intermediate status: "Resolving profile...", "Validating constraints...", "Processing results..."

- [ ] 6.0 **Add Validation Settings for Timeout Configuration**
  - [ ] 6.1 Update `shared/validation-settings.ts` schema to add `timeouts` section with fields: `clientHttp`, `validationEngine`, `hapiProcess`, `profileResolution`
  - [ ] 6.2 Add migration script to add timeout configuration columns to validation settings database table
  - [ ] 6.3 Update validation settings service to load and persist timeout configuration
  - [ ] 6.4 Add timeout settings fields to validation settings UI (`client/src/components/ui/validation-aspects-dropdown.tsx`)
  - [ ] 6.5 Add validation rules: ensure client timeout > engine timeout > HAPI timeout
  - [ ] 6.6 Display warning if timeouts are configured incorrectly (client < server)
  - [ ] 6.7 Add "Reset to Recommended" button to restore default timeout values
  - [ ] 6.8 Save timeout configuration per FHIR server (different servers may need different timeouts)

- [ ] 7.0 **Implement Graceful Degradation for Timeouts**
  - [ ] 7.1 Update `server/services/validation/engine/profile-validator.ts:109-123` to catch timeout errors and provide fallback
  - [ ] 7.2 Implement basic profile validation fallback: check if `meta.profile` is declared
  - [ ] 7.3 Return partial validation results when profile validation times out (structural + terminology only)
  - [ ] 7.4 Add info-level validation message: "Profile validation timed out, showing partial results"
  - [ ] 7.5 Implement background validation queue for timed-out profile validations
  - [ ] 7.6 Notify user when background profile validation completes (via polling or UI refresh)
  - [ ] 7.7 Store partial validation results in database with flag `profileValidationIncomplete: true`
  - [ ] 7.8 Add UI indicator for incomplete validation: "Profile validation pending..."

- [ ] 8.0 **Add Comprehensive Logging and Monitoring**
  - [ ] 8.1 Add timeout tracking in `server/services/validation/core/validation-engine.ts` with `console.warn` for timeouts > 50% of configured value
  - [ ] 8.2 Log timeout occurrences with context: aspect, resource type, profile URL, elapsed time
  - [ ] 8.3 Add timeout metrics to performance baseline tracker (`server/services/performance/performance-baseline.ts`)
  - [ ] 8.4 Track timeout rate per aspect (profile, terminology, reference, etc.)
  - [ ] 8.5 Add timeout dashboard panel to show timeout trends and problematic profiles
  - [ ] 8.6 Alert if timeout rate exceeds threshold (e.g., > 10% of validations timing out)
  - [ ] 8.7 Log profile resolution time separately to identify slow profiles
  - [ ] 8.8 Add HAPI process pool metrics for timeout tracking

- [ ] 9.0 **Update Documentation**
  - [ ] 9.1 Document timeout configuration in `docs/technical/validation/validation-configuration.md`
  - [ ] 9.2 Add troubleshooting guide for timeout issues in `docs/guides/troubleshooting-validation-timeouts.md`
  - [ ] 9.3 Update environment variable documentation in `docs/deployment/environment-variables.md`
  - [ ] 9.4 Add timeout configuration examples in `docs/guides/configuring-validation-timeouts.md`
  - [ ] 9.5 Document profile preloading feature and how to configure preloaded profiles
  - [ ] 9.6 Update API documentation to reflect timeout behavior and retry recommendations
  - [ ] 9.7 Add performance tuning guide for profile validation optimization
  - [ ] 9.8 Document graceful degradation behavior when timeouts occur

- [ ] 10.0 **Testing and Validation**
  - [ ] 10.1 Create test for timeout configuration module: verify defaults, environment variables, and cascade validation
  - [ ] 10.2 Create integration test for profile validation with various timeout scenarios
  - [ ] 10.3 Test profile validation with German profiles (KBV, MII, ISiK) to verify no timeouts
  - [ ] 10.4 Test profile validation with slow network conditions (simulated latency)
  - [ ] 10.5 Test graceful degradation: verify partial results returned when profile validation times out
  - [ ] 10.6 Test client-server timeout interaction: verify client doesn't cancel before server completes
  - [ ] 10.7 Test timeout configuration via settings UI: save, load, validate
  - [ ] 10.8 Test profile preloading: verify profiles are preloaded on startup and validation is faster
  - [ ] 10.9 Test error messages: verify timeout errors are clear and actionable
  - [ ] 10.10 Load test with concurrent profile validations to verify no resource exhaustion

- [ ] 11.0 **Deployment and Rollout**
  - [ ] 11.1 Update production environment variables to set appropriate timeouts for production workload
  - [ ] 11.2 Add feature flag for gradual rollout: `ENABLE_EXTENDED_TIMEOUTS=true`
  - [ ] 11.3 Monitor timeout rates in production after deployment
  - [ ] 11.4 Create runbook for handling timeout issues in production
  - [ ] 11.5 Add alerting for timeout rate spikes
  - [ ] 11.6 Document rollback procedure if extended timeouts cause issues
  - [ ] 11.7 Communicate changes to users: "Profile validation now supports large German profiles"
  - [ ] 11.8 Collect user feedback on validation timeout experience

---

## Execution Plan

### Phase 1: Critical Fixes (1-2 days) ✅ **COMPLETED**
Tasks: ✅ 1.0, ✅ 2.0, 🔄 3.0 (3.1 done, 3.2-3.7 pending)
Goal: Stop immediate timeouts, align client/server timeouts
**Status**: Core timeout alignment complete. Client timeout increased to 120s. Profile validation should now work!

### Phase 2: Performance Improvements (2-3 days)
Tasks: 4.0, 8.0
Goal: Make profile validation faster, add monitoring

### Phase 3: User Experience (2-3 days)
Tasks: 5.0, 6.0, 7.0
Goal: Better error messages, settings UI, graceful degradation

### Phase 4: Documentation and Testing (2-3 days)
Tasks: 9.0, 10.0
Goal: Comprehensive testing and documentation

### Phase 5: Deployment (1 day)
Tasks: 11.0
Goal: Safe production rollout with monitoring

**Total Estimated Time**: 8-12 days

---

## Success Criteria

- [ ] Profile validation success rate > 95%
- [ ] Average profile validation time < 45 seconds for German profiles
- [ ] Zero client-side timeouts due to premature cancellation
- [ ] Timeout error messages are clear and actionable
- [ ] Users can configure timeouts via settings UI
- [ ] Graceful degradation provides partial results on timeout
- [ ] All tests pass with new timeout configuration
- [ ] Documentation is comprehensive and up-to-date
