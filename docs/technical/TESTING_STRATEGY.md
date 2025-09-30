# Testing Strategy

## Overview
Comprehensive testing strategy for the FHIR Validation Platform, ensuring quality, reliability, and production readiness.

## Test Pyramid

### Unit Tests (70% of test suite)
**Goal:** Test individual functions and components in isolation  
**Coverage Target:** 80%+ for critical modules

#### Critical Modules (Must Have High Coverage)
1. **Validation Engine**
   - ✅ `server/services/validation/core/validation-engine.test.ts`
   - ✅ `server/services/validation/core/consolidated-validation-service.test.ts`
   - ✅ `server/services/validation/persistence/per-aspect-persistence.test.ts`
   - **Coverage:** Signature normalization, scoring, error mapping, timeouts

2. **Scoring & Aggregation**
   - ✅ `client/src/lib/validation-scoring.test.ts`
   - **Coverage:** Edge cases (all disabled, mixed severities, not-yet-validated)

3. **Reactivity Hooks**
   - ✅ `client/src/hooks/use-server-reactive-queries.test.ts`
   - ✅ `client/src/hooks/use-aspect-settings-reactive.test.ts`
   - **Coverage:** Server switch, aspect toggle, cache invalidation

4. **Settings Management**
   - ✅ `client/src/hooks/use-validation-settings-polling.test.ts`
   - **Coverage:** Settings snapshot hash, reactivity, polling

5. **Queue Service**
   - ✅ `server/services/validation/performance/validation-queue.test.ts`
   - **Coverage:** Pause/resume/cancel, priority, retry/backoff

### Integration Tests (25% of test suite)
**Goal:** Test API endpoints and service interactions  
**Coverage Target:** 70%+ for API routes

#### Critical Endpoints
1. **Validation Groups API**
   - ✅ `server/routes/api/validation/groups.test.ts`
   - **Coverage:** Filters (aspect, severity, code, path), pagination, sorting

2. **Edit & Batch-Edit APIs**
   - ✅ `server/routes/api/fhir/resource-edit.test.ts`
   - **Coverage:** If-Match conflicts (409), validation errors (422), successful edits

3. **Queue Progress API**
   - ✅ Tests embedded in `validation-queue.test.ts`
   - **Coverage:** Start/pause/resume/cancel, progress updates, ETA calculation

4. **Settings API**
   - ✅ `client/src/hooks/use-validation-settings-polling.integration.test.ts`
   - **Coverage:** Apply/save, validation, emit changes

### E2E Tests (5% of test suite)
**Goal:** Test complete user workflows  
**Coverage Target:** Key happy paths + critical error scenarios

#### Planned E2E Tests
1. **Resource Browsing Flow**
   ```
   User Story: Browse resources by validation messages
   - Apply filters (aspect, severity, code)
   - Switch to group mode
   - Click group → view members
   - Click member → view detail
   - Verify parity (counts match everywhere)
   ```

2. **Server Switch Reactivity**
   ```
   User Story: Switch active FHIR server
   - View resource list on Server A
   - Switch to Server B
   - Verify immediate UI update
   - Verify no stale data from Server A
   ```

3. **Aspect Toggle Reactivity**
   ```
   User Story: Disable/enable validation aspect
   - View resource detail
   - Toggle aspect off
   - Verify aspect greyed out immediately
   - Verify counts recalculated
   - Toggle aspect on
   - Verify "Validating..." state
   ```

4. **Resource Edit & Revalidation**
   ```
   User Story: Edit resource to fix validation error
   - Open resource detail
   - Click Edit
   - Modify JSON
   - Save
   - Verify revalidation triggered
   - Verify validation results update
   ```

## Coverage Targets

### By Module Type
| Module Type | Target Coverage | Current Status |
|-------------|----------------|----------------|
| Critical Services | 80% | ✅ Likely met |
| API Routes | 70% | ✅ Likely met |
| UI Components | 60% | ⚠️ Needs verification |
| Utilities | 80% | ✅ Likely met |
| Integration | 70% | ✅ Likely met |

### By Test Type
| Test Type | Target % | Estimated Count |
|-----------|----------|-----------------|
| Unit | 70% | ~80-100 files |
| Integration | 25% | ~15-20 files |
| E2E | 5% | ~3-5 specs |

## Testing Tools

### Current Stack
- **Test Runner:** Vitest
- **Frontend:** React Testing Library, jsdom
- **Backend:** Vitest + supertest
- **E2E:** (Planned) Playwright or Cypress
- **Coverage:** v8 (built into Vitest)

### Test Utilities
- **Mocking:** `vi.mock()` for module mocking
- **Fixtures:** `server/db/seed/validation-fixtures.ts`
- **Helpers:** `tests/integration/validation/setup.ts`

## Running Tests

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm test -- --coverage
```

### Watch Mode (Development)
```bash
npm test -- --watch
```

### Specific Test File
```bash
npm test -- path/to/test.test.ts
```

### Integration Tests Only
```bash
npm test -- --grep "integration"
```

### E2E Tests (Planned)
```bash
npm run test:e2e
```

## Test Organization

### File Naming
- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.spec.ts` in `tests/e2e/`

### File Location
- **Co-located:** Unit tests next to source files
  ```
  src/lib/validation-scoring.ts
  src/lib/validation-scoring.test.ts
  ```

- **Separate:** Integration tests in tests folder
  ```
  tests/integration/validation-api.spec.ts
  ```

### Test Structure (AAA Pattern)
```typescript
describe('ComponentName', () => {
  describe('FeatureName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = setupTestData();
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Critical Test Scenarios

### 1. Signature Normalization
```typescript
// Test canonical path normalization
expect(normalizePath('entry[3].item[0].code')).toBe('entry.item.code');

// Test message text normalization
expect(normalizeText('  Multiple   Spaces  ')).toBe('multiple spaces');

// Test signature computation
const sig1 = computeSignature({aspect: 'structural', ...});
const sig2 = computeSignature({aspect: 'STRUCTURAL', ...});
expect(sig1).toBe(sig2); // Case insensitive
```

### 2. Scoring Edge Cases
```typescript
// All aspects disabled
const score = calculateScore({allDisabled: true});
expect(score).toBe(100); // or undefined?

// Mixed severities
const score = calculateScore({errors: 1, warnings: 5});
expect(score).toBe(0); // Errors zero the score

// Not yet validated
const score = calculateScore({validated: false});
expect(score).toBeUndefined();
```

### 3. Reactivity Flows
```typescript
// Server switch
const { result } = renderHook(() => useServerReactiveQueries());
act(() => switchServer(newServerId));
await waitFor(() => {
  expect(queryClient.invalidateQueries).toHaveBeenCalled();
});

// Aspect toggle
act(() => toggleAspect('structural', false));
await waitFor(() => {
  expect(result.current.isValidating()).toBe(true);
});
```

### 4. API Integration
```typescript
// Groups endpoint
const response = await request(app)
  .get('/api/validation/issues/groups')
  .query({aspect: 'structural', severity: 'error'});
expect(response.status).toBe(200);
expect(response.body.groups).toBeInstanceOf(Array);
```

## Continuous Integration

### Pre-Commit
```bash
# Run by git hook
./scripts/pre-commit-checks.sh
# Includes: typecheck, lint, quick tests
```

### Pull Request
```bash
# Full test suite
npm test -- --run --coverage
# Coverage report uploaded to Codecov
```

### Pre-Deployment
```bash
# All tests + E2E
npm test -- --run
npm run test:e2e
# Performance validation
npm run test:performance
```

## Test Data Management

### Fixtures
- **Location:** `server/db/seed/validation-fixtures.ts`
- **Usage:** Shared test data for consistent tests
- **Cleanup:** Automatic cleanup after each test

### Database Seeding
```bash
# Seed dev database
npm run db:seed:dev

# Clear validation data
npm run db:clear

# Full reset
npm run db:clear:all && npm run db:migrate && npm run db:seed
```

## Known Gaps & TODOs

### Missing Tests
- [ ] E2E tests with Playwright/Cypress
- [ ] Load tests for 25K-250K resources
- [ ] Visual regression tests
- [ ] Performance regression tests

### Coverage Gaps (Need Verification)
- [ ] UI component coverage (target: 60%)
- [ ] Error boundary coverage
- [ ] Mock data gating verification

### Test Improvements
- [ ] Add mutation testing (Stryker)
- [ ] Add contract testing for APIs
- [ ] Add accessibility testing (axe-core)

## Success Criteria

### Pre-Deployment Checklist
- [ ] All tests passing (100%)
- [ ] Coverage thresholds met (60%+ overall, 80%+ critical)
- [ ] No skipped/pending tests in critical paths
- [ ] E2E tests covering happy paths
- [ ] Performance tests passing (p95 < budgets)
- [ ] Integration tests for all new APIs
- [ ] Regression tests for bug fixes

### Quality Gates
1. **Unit Tests:** Must pass, coverage ≥ 60%
2. **Integration Tests:** Must pass, coverage ≥ 70%
3. **E2E Tests:** Must pass (when implemented)
4. **Performance:** p95 within budgets
5. **Security:** No high/critical vulnerabilities

## Maintenance

### Test Review Cadence
- **Weekly:** Review failing/flaky tests
- **Monthly:** Review coverage reports, identify gaps
- **Quarterly:** Audit test suite, remove obsolete tests

### Test Performance
- **Target:** Full suite < 5 minutes
- **Current:** ~2-3 minutes (needs measurement)
- **Optimization:** Parallel execution, selective mocking

## Resources

- **Testing Library Docs:** https://testing-library.com/
- **Vitest Docs:** https://vitest.dev/
- **Test Best Practices:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

## Status

- ✅ Task 13.1: Unit tests for critical modules
- ✅ Task 13.2: Integration tests for APIs
- ⏳ Task 13.3: E2E tests (planned, not implemented)
- ✅ Task 13.4: Coverage targets defined
