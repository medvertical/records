# Validation Integration Tests

This directory contains comprehensive integration tests for the validation system, covering the complete workflow from settings configuration to UI display.

## Test Structure

### 1. `validation-flow-integration.test.ts`
Tests the complete validation flow:
- **Settings Management**: Configuration, updates, presets, audit trails
- **Validation Processing**: Single resource, batch validation, resource ID validation
- **Pipeline Processing**: Request processing, status tracking, cancellation
- **Data Persistence**: Result storage, retrieval, statistics
- **API Integration**: All validation endpoints and error handling
- **Error Scenarios**: Graceful error handling and recovery

### 2. `ui-integration.test.ts`
Tests UI component integration:
- **React Component Integration**: Validation hooks, component rendering
- **Data Flow**: API to UI component data flow
- **User Interactions**: Settings toggles, validation triggers
- **Real-time Updates**: Live data updates and state management
- **Error States**: Loading, error, and no-data states
- **Performance**: Large datasets and rapid state changes

### 3. `end-to-end-workflow.test.ts`
Tests complete end-to-end workflows:
- **Complete Validation Workflow**: Settings → Validation → Persistence → API → UI
- **Batch Processing**: Large-scale validation with progress tracking
- **Control Operations**: Pause, resume, cancel validation
- **Real-time Events**: Event system and live updates
- **Data Consistency**: Integrity across all layers
- **Concurrent Operations**: Thread safety and data consistency
- **Performance**: Large-scale processing and memory efficiency

## Test Configuration

### `vitest.config.ts`
- **Environment**: Node.js environment for server-side testing
- **Timeout**: 30 seconds for integration tests
- **Coverage**: 80% threshold for all metrics
- **Concurrency**: Limited to 5 concurrent tests
- **Reporting**: Verbose, JSON, and HTML reports

### `setup.ts`
- **Global Mocks**: React Query, React Router, Testing Library
- **Test Utilities**: Mock data generators and helpers
- **Performance Monitoring**: Test duration and memory usage tracking
- **Error Handling**: Unhandled rejection and exception handling

## Running Tests

### Run All Integration Tests
```bash
npx vitest run tests/integration/validation/
```

### Run Specific Test File
```bash
npx vitest run tests/integration/validation/validation-flow-integration.test.ts
```

### Run with Coverage
```bash
npx vitest run tests/integration/validation/ --coverage
```

### Run in Watch Mode
```bash
npx vitest watch tests/integration/validation/
```

## Test Data

### Mock Validation Result
```typescript
{
  id: 1,
  resourceId: 'test-resource-1',
  resourceType: 'Patient',
  isValid: true,
  overallScore: 95,
  confidence: 0.9,
  completeness: 0.85,
  issues: [],
  aspects: {
    structural: { isValid: true, score: 100, confidence: 0.95, issues: [], validationTime: 50 },
    profile: { isValid: true, score: 90, confidence: 0.85, issues: [], validationTime: 100 },
    terminology: { isValid: true, score: 95, confidence: 0.9, issues: [], validationTime: 75 },
    reference: { isValid: true, score: 100, confidence: 0.95, issues: [], validationTime: 60 },
    businessRule: { isValid: true, score: 90, confidence: 0.8, issues: [], validationTime: 80 },
    metadata: { isValid: true, score: 95, confidence: 0.9, issues: [], validationTime: 40 }
  },
  validatedAt: new Date(),
  validationTime: 405,
  profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient',
  validationSource: 'consolidated-validation-service'
}
```

### Mock Validation Settings
```typescript
{
  id: 1,
  enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'],
  strictMode: false,
  batchSize: 100,
  timeoutMs: 30000,
  retryAttempts: 3,
  retryDelayMs: 1000,
  enableParallelProcessing: true,
  maxConcurrentValidations: 5,
  enablePersistence: true,
  enableCaching: true,
  cacheTimeoutMs: 300000,
  enableAuditTrail: true,
  enableRealTimeUpdates: true,
  enableQualityMetrics: true,
  enableCompletenessScoring: true,
  enableConfidenceScoring: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  isActive: true
}
```

## Test Scenarios

### 1. Settings → Pipeline → Persistence → API → UI Flow
- Configure validation settings
- Update settings with new values
- Validate resources using the pipeline
- Verify persistence of results
- Check API responses
- Verify UI display of results

### 2. Batch Validation Flow
- Process multiple resources simultaneously
- Track progress across batches
- Handle mixed success/failure scenarios
- Verify all results are persisted
- Check statistics accuracy

### 3. Validation Control Flow
- Start validation process
- Pause validation
- Resume validation
- Cancel validation
- Verify status updates

### 4. Settings Management Flow
- Get settings history
- Apply presets
- Test settings configuration
- Get settings statistics
- View audit trail
- Reset settings

### 5. Pipeline Processing Flow
- Process pipeline requests
- Track request status
- Cancel pipeline requests
- Get pipeline statistics

### 6. Error Handling
- Handle validation errors gracefully
- Test error recovery
- Verify error messages
- Check error states in UI

### 7. Real-time Updates
- Simulate live data updates
- Test event system
- Verify UI updates
- Check progress tracking

### 8. Data Consistency
- Verify data integrity across layers
- Test concurrent operations
- Check state consistency
- Validate statistics accuracy

### 9. Performance Testing
- Large-scale validation
- Memory efficiency
- Concurrent operations
- Response times

## Coverage Requirements

- **Branches**: 80% coverage
- **Functions**: 80% coverage
- **Lines**: 80% coverage
- **Statements**: 80% coverage

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Clean up after each test

### Mocking
- Mock external dependencies
- Use realistic mock data
- Verify mock interactions
- Reset mocks between tests

### Performance
- Monitor test execution time
- Track memory usage
- Test with large datasets
- Verify concurrent operations

### Error Handling
- Test error scenarios
- Verify error messages
- Check error recovery
- Test edge cases

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout in vitest.config.ts
   - Check for infinite loops
   - Verify async operations complete

2. **Memory Leaks**
   - Clear mocks between tests
   - Clean up event listeners
   - Monitor memory usage

3. **Flaky Tests**
   - Use deterministic mock data
   - Wait for async operations
   - Avoid race conditions

4. **Coverage Issues**
   - Add tests for uncovered code paths
   - Verify mock interactions
   - Check error scenarios

### Debug Mode
```bash
npx vitest run tests/integration/validation/ --reporter=verbose
```

### Performance Analysis
```bash
npx vitest run tests/integration/validation/ --coverage --reporter=json
```

## Contributing

When adding new integration tests:

1. **Follow the existing structure**
2. **Use the provided test utilities**
3. **Add comprehensive test coverage**
4. **Document new test scenarios**
5. **Update this README if needed**

## Related Documentation

- [Validation Engine Architecture](../../../docs/technical/validation/consolidated-validation-architecture.md)
- [API Documentation](../../../docs/core/API_DOCUMENTATION.md)
- [Testing Guidelines](../../../docs/technical/README.md)
