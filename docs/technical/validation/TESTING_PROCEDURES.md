# FHIR Validation Testing Procedures

## Overview

This document provides comprehensive testing procedures for the FHIR validation system, including test execution, expected validation scores, test data management, and quality assurance processes.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Data Management](#test-data-management)
4. [Unit Testing](#unit-testing)
5. [Integration Testing](#integration-testing)
6. [End-to-End Testing](#end-to-end-testing)
7. [Performance Testing](#performance-testing)
8. [Expected Validation Scores](#expected-validation-scores)
9. [Test Execution Procedures](#test-execution-procedures)
10. [Quality Assurance](#quality-assurance)

## Testing Overview

### Testing Strategy

The FHIR validation system employs a comprehensive testing strategy with multiple layers:

1. **Unit Tests**: Individual component testing
2. **Integration Tests**: Component interaction testing
3. **End-to-End Tests**: Complete workflow testing
4. **Performance Tests**: Load and stress testing
5. **Regression Tests**: Ensuring no functionality regression

### Test Categories

- **Functional Testing**: Core validation functionality
- **Performance Testing**: Timing and resource usage
- **Error Handling Testing**: Error scenarios and recovery
- **UI Testing**: User interface component testing
- **API Testing**: REST API endpoint testing
- **Real-time Testing**: Live update mechanism testing

## Test Environment Setup

### Prerequisites

Before running tests, ensure the following are installed and configured:

```bash
# Required software
Node.js >= 18.0.0
npm >= 8.0.0
PostgreSQL >= 13.0
Docker (optional, for containerized testing)

# Environment variables
DATABASE_URL=postgresql://test:test@localhost:5432/records_test
ONTOSERVER_R4_URL=https://r4.ontoserver.csiro.au/fhir
FIRELY_SERVER_URL=https://server.fire.ly/R4
NODE_ENV=test
```

### Test Database Setup

```bash
# Create test database
createdb records_test

# Run test migrations
npm run migrate:test

# Seed test data
npm run seed:test
```

### Test Environment Configuration

```bash
# .env.test
NODE_ENV=test
DATABASE_URL=postgresql://test:test@localhost:5432/records_test
ONTOSERVER_R4_URL=https://r4.ontoserver.csiro.au/fhir
FIRELY_SERVER_URL=https://server.fire.ly/R4
VALIDATION_TIMEOUT=10000
CACHE_DEFAULT_TTL=60000
LOG_LEVEL=error
ENABLE_METRICS=false
```

## Test Data Management

### Test Resource Suite

The system includes a comprehensive test resource suite with various validation scenarios:

```typescript
// server/test/test-resources.ts
export const testResourceSuite = {
  valid: {
    validPatient: {
      resourceType: 'Patient',
      id: 'patient-valid-001',
      name: [{ family: 'Smith', given: ['John'] }],
      gender: 'male',
      birthDate: '1990-01-01',
      active: true
    },
    validObservation: {
      resourceType: 'Observation',
      id: 'observation-valid-001',
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '33747-0',
          display: 'Temperature'
        }]
      },
      subject: { reference: 'Patient/patient-valid-001' },
      valueQuantity: {
        value: 98.6,
        unit: '°F',
        system: 'http://unitsofmeasure.org',
        code: '[degF]'
      }
    }
  },
  
  invalid: {
    invalidPatient: {
      resourceType: 'Patient',
      id: 'patient-invalid-001',
      // Missing required fields
      gender: 'invalid-gender',
      birthDate: 'invalid-date'
    },
    invalidObservation: {
      resourceType: 'Observation',
      id: 'observation-invalid-001',
      // Invalid status
      status: 'invalid-status',
      // Missing required code
      subject: { reference: 'Patient/nonexistent-patient' }
    }
  },
  
  terminologyIssues: {
    patientWithInvalidCodes: {
      resourceType: 'Patient',
      id: 'patient-terminology-invalid-001',
      gender: 'unknown-code',
      maritalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
          code: 'invalid-code'
        }]
      }
    }
  },
  
  referenceIssues: {
    observationWithBrokenReferences: {
      resourceType: 'Observation',
      id: 'observation-reference-invalid-001',
      status: 'final',
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '33747-0'
        }]
      },
      subject: { reference: 'Patient/nonexistent-patient' },
      performer: { reference: 'Practitioner/nonexistent-practitioner' }
    }
  }
};
```

### Test Data Categories

1. **Valid Resources**: Properly formatted FHIR resources
2. **Invalid Resources**: Resources with structural issues
3. **Terminology Issues**: Resources with invalid codes
4. **Reference Issues**: Resources with broken references
5. **Edge Cases**: Boundary conditions and unusual scenarios

## Unit Testing

### Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npm run test:unit -- --grep "ValidationService"

# Run with coverage
npm run test:unit:coverage

# Run in watch mode
npm run test:unit:watch
```

### Unit Test Structure

```typescript
// server/services/validation/__tests__/structural-validator.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StructuralValidator } from '../engine/structural-validator';
import { testResourceSuite } from '../../test/test-resources';

describe('StructuralValidator', () => {
  let validator: StructuralValidator;

  beforeEach(() => {
    validator = new StructuralValidator();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('validate', () => {
    it('should validate valid Patient resource', async () => {
      const result = await validator.validate(
        testResourceSuite.valid.validPatient,
        'Patient'
      );

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.score).toBe(100);
    });

    it('should identify structural issues in invalid Patient', async () => {
      const result = await validator.validate(
        testResourceSuite.invalid.invalidPatient,
        'Patient'
      );

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
      
      // Check specific issues
      const missingFieldIssue = result.issues.find(
        issue => issue.message.includes('Missing required field')
      );
      expect(missingFieldIssue).toBeDefined();
    });

    it('should handle null resource gracefully', async () => {
      const result = await validator.validate(null, 'Patient');
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('Resource is null or undefined');
    });
  });
});
```

### Unit Test Coverage Requirements

- **Minimum Coverage**: 80% overall
- **Critical Components**: 90% coverage
- **Validator Classes**: 95% coverage
- **Error Handling**: 100% coverage

## Integration Testing

### Running Integration Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- --grep "External Services"

# Run with database
npm run test:integration:db
```

### Integration Test Examples

```typescript
// server/test/integration/validation-pipeline.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConsolidatedValidationService } from '../services/validation/core/consolidated-validation-service';
import { testResourceSuite } from '../test-resources';

describe('Validation Pipeline Integration', () => {
  let validationService: ConsolidatedValidationService;

  beforeAll(async () => {
    validationService = new ConsolidatedValidationService();
    await validationService.initialize();
  });

  afterAll(async () => {
    await validationService.cleanup();
  });

  describe('External Service Integration', () => {
    it('should integrate with Ontoserver for terminology validation', async () => {
      const result = await validationService.validateResource(
        testResourceSuite.terminologyIssues.patientWithInvalidCodes,
        {
          aspects: ['terminology']
        }
      );

      expect(result.aspects).toHaveLength(1);
      expect(result.aspects[0].name).toBe('terminology');
      expect(result.aspects[0].issues.length).toBeGreaterThan(0);
    });

    it('should integrate with Firely for reference validation', async () => {
      const result = await validationService.validateResource(
        testResourceSuite.referenceIssues.observationWithBrokenReferences,
        {
          aspects: ['reference']
        }
      );

      expect(result.aspects).toHaveLength(1);
      expect(result.aspects[0].name).toBe('reference');
      expect(result.aspects[0].issues.length).toBeGreaterThan(0);
    });
  });

  describe('Database Integration', () => {
    it('should persist validation results to database', async () => {
      const resource = testResourceSuite.valid.validPatient;
      const result = await validationService.validateResource(resource);

      expect(result.resourceId).toBe(resource.id);
      expect(result.validatedAt).toBeDefined();

      // Verify database persistence
      const storedResult = await validationService.getValidationResult(resource.id);
      expect(storedResult).toBeDefined();
      expect(storedResult.score).toBe(result.score);
    });
  });
});
```

## End-to-End Testing

### Running End-to-End Tests

```bash
# Run all end-to-end tests
npm run test:e2e

# Run specific end-to-end test
npm run test:e2e -- --grep "Complete Validation Flow"

# Run with UI testing
npm run test:e2e:ui
```

### End-to-End Test Procedures

#### Complete Validation Flow Test

```typescript
// server/test/end-to-end-validation-test.ts
describe('Complete Validation Flow', () => {
  it('should complete full validation flow from UI to database', async () => {
    const testResource = testResourceSuite.valid.validPatient;
    
    // Step 1: Validate resource
    const validationResult = await validationService.validateResource(testResource);
    
    // Step 2: Verify validation result structure
    expect(validationResult).toMatchObject({
      resourceType: 'Patient',
      resourceId: testResource.id,
      isValid: expect.any(Boolean),
      score: expect.any(Number),
      issues: expect.any(Array),
      aspects: expect.any(Array),
      performance: expect.any(Object),
      validatedAt: expect.any(String)
    });
    
    // Step 3: Verify aspect results
    expect(validationResult.aspects).toHaveLength(6); // All aspects
    validationResult.aspects.forEach(aspect => {
      expect(aspect).toMatchObject({
        name: expect.any(String),
        score: expect.any(Number),
        issues: expect.any(Array),
        validated: expect.any(Boolean)
      });
    });
    
    // Step 4: Verify performance metrics
    expect(validationResult.performance).toMatchObject({
      totalTimeMs: expect.any(Number),
      aspectTimes: expect.any(Object)
    });
    
    // Step 5: Verify database persistence
    const storedResult = await validationService.getValidationResult(testResource.id);
    expect(storedResult).toBeDefined();
    expect(storedResult.score).toBe(validationResult.score);
  });
});
```

#### UI Component Testing

```typescript
// client/src/components/__tests__/validation-badge.test.tsx
import { render, screen } from '@testing-library/react';
import { ValidationBadge } from '../validation-badge';

describe('ValidationBadge', () => {
  const mockValidationResult = {
    score: 85,
    isValid: true,
    issues: [
      { severity: 'warning', message: 'Test warning' }
    ]
  };

  it('should render validation badge with correct score', () => {
    render(<ValidationBadge validationResult={mockValidationResult} />);
    
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByRole('badge')).toHaveClass('validation-badge');
  });

  it('should apply correct color class based on score', () => {
    const { rerender } = render(
      <ValidationBadge validationResult={{ ...mockValidationResult, score: 95 }} />
    );
    expect(screen.getByRole('badge')).toHaveClass('score-excellent');

    rerender(
      <ValidationBadge validationResult={{ ...mockValidationResult, score: 75 }} />
    );
    expect(screen.getByRole('badge')).toHaveClass('score-good');

    rerender(
      <ValidationBadge validationResult={{ ...mockValidationResult, score: 45 }} />
    );
    expect(screen.getByRole('badge')).toHaveClass('score-fair');

    rerender(
      <ValidationBadge validationResult={{ ...mockValidationResult, score: 25 }} />
    );
    expect(screen.getByRole('badge')).toHaveClass('score-poor');
  });
});
```

## Performance Testing

### Running Performance Tests

```bash
# Run performance tests
npm run test:performance

# Run load tests
npm run test:load

# Run stress tests
npm run test:stress
```

### Performance Test Metrics

```typescript
// server/test/performance-validation-test.ts
describe('Performance Testing', () => {
  it('should validate resources within acceptable time limits', async () => {
    const testResources = Array.from({ length: 100 }, (_, i) => ({
      ...testResourceSuite.valid.validPatient,
      id: `patient-${i}`
    }));

    const startTime = Date.now();
    const results = await validationService.validateResources(testResources);
    const endTime = Date.now();

    const totalTime = endTime - startTime;
    const averageTime = totalTime / testResources.length;

    // Performance assertions
    expect(averageTime).toBeLessThan(500); // 500ms per resource
    expect(totalTime).toBeLessThan(30000); // 30 seconds total
    expect(results).toHaveLength(testResources.length);

    // Verify all results are valid
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  it('should handle concurrent validation requests', async () => {
    const concurrentRequests = 10;
    const requests = Array.from({ length: concurrentRequests }, () =>
      validationService.validateResource(testResourceSuite.valid.validPatient)
    );

    const startTime = Date.now();
    const results = await Promise.all(requests);
    const endTime = Date.now();

    expect(results).toHaveLength(concurrentRequests);
    expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
  });
});
```

## Expected Validation Scores

### Score Calculation

Validation scores are calculated based on the following formula:

```typescript
const calculateScore = (issues: ValidationIssue[]) => {
  const errorPenalty = 10;
  const warningPenalty = 5;
  const infoPenalty = 1;
  
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  
  const totalPenalty = (errorCount * errorPenalty) + 
                      (warningCount * warningPenalty) + 
                      (infoCount * infoPenalty);
  
  return Math.max(0, 100 - totalPenalty);
};
```

### Expected Scores for Test Resources

| Resource Type | Test Case | Expected Score Range | Expected Issues |
|---------------|-----------|---------------------|-----------------|
| Patient | Valid | 90-100% | 0-1 minor warnings |
| Patient | Invalid Structure | 20-40% | 3-5 structural errors |
| Patient | Invalid Terminology | 30-50% | 2-3 terminology errors |
| Observation | Valid | 85-95% | 0-2 minor warnings |
| Observation | Invalid Structure | 15-35% | 4-6 structural errors |
| Observation | Broken References | 25-45% | 2-4 reference errors |

### Score Thresholds

- **Excellent**: 90-100% (Green badge)
- **Good**: 70-89% (Yellow badge)
- **Fair**: 50-69% (Orange badge)
- **Poor**: 0-49% (Red badge)

## Test Execution Procedures

### Pre-Test Checklist

Before running any tests, ensure:

- [ ] Test database is set up and accessible
- [ ] External services (Ontoserver, Firely) are available
- [ ] Environment variables are properly configured
- [ ] Test data is loaded
- [ ] Dependencies are installed

### Test Execution Steps

1. **Setup Phase**
   ```bash
   # Install dependencies
   npm install
   
   # Set up test database
   npm run db:setup:test
   
   # Load test data
   npm run data:seed:test
   ```

2. **Unit Tests**
   ```bash
   # Run unit tests
   npm run test:unit
   
   # Verify coverage
   npm run test:unit:coverage
   ```

3. **Integration Tests**
   ```bash
   # Run integration tests
   npm run test:integration
   
   # Test external service connectivity
   npm run test:external
   ```

4. **End-to-End Tests**
   ```bash
   # Run end-to-end tests
   npm run test:e2e
   
   # Test complete validation flow
   npm run test:e2e:validation
   ```

5. **Performance Tests**
   ```bash
   # Run performance tests
   npm run test:performance
   
   # Generate performance report
   npm run test:performance:report
   ```

### Test Result Analysis

#### Success Criteria

- **Unit Tests**: 100% pass rate
- **Integration Tests**: 100% pass rate
- **End-to-End Tests**: 100% pass rate
- **Performance Tests**: Meet timing requirements
- **Coverage**: Minimum 80% overall coverage

#### Failure Investigation

When tests fail:

1. **Check Test Logs**: Review detailed error messages
2. **Verify Environment**: Ensure all services are running
3. **Check Test Data**: Verify test resources are valid
4. **Review Configuration**: Confirm environment variables
5. **Debug Step-by-Step**: Isolate the failing component

### Continuous Integration

#### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: records_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit:coverage
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/records_test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run end-to-end tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Quality Assurance

### Test Quality Metrics

- **Test Coverage**: Minimum 80% overall, 90% for critical components
- **Test Reliability**: Tests should be deterministic and repeatable
- **Test Performance**: Test suite should complete within reasonable time
- **Test Maintainability**: Tests should be easy to understand and modify

### Code Quality Standards

- **TypeScript**: All test code must be properly typed
- **ESLint**: Code must pass linting rules
- **Prettier**: Code must be properly formatted
- **Documentation**: Tests must be well-documented

### Review Process

1. **Code Review**: All test code must be reviewed
2. **Test Review**: Test cases must be reviewed for completeness
3. **Coverage Review**: Coverage reports must be reviewed
4. **Performance Review**: Performance test results must be reviewed

### Test Maintenance

- **Regular Updates**: Tests should be updated with code changes
- **Deprecation Handling**: Tests for deprecated features should be removed
- **Data Updates**: Test data should be kept current
- **Environment Updates**: Test environments should be maintained

## Conclusion

This testing procedures document provides comprehensive guidance for testing the FHIR validation system. By following these procedures, teams can ensure the system meets quality standards and functions reliably in all environments.

Key aspects of the testing strategy:

- **Comprehensive Coverage**: Unit, integration, end-to-end, and performance testing
- **Realistic Test Data**: Comprehensive test resource suite with various scenarios
- **Automated Testing**: CI/CD integration with automated test execution
- **Quality Metrics**: Clear success criteria and quality standards
- **Maintenance Procedures**: Guidelines for keeping tests current and effective

Regular review and updates of this document will ensure it remains relevant and helpful as the system evolves and new testing requirements emerge.
