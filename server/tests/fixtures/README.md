# Test Fixtures
**Task 11.1: FHIR Test Data for Integration Testing**

## Overview

This directory contains FHIR resource fixtures for integration and end-to-end testing of the validation engine.

## Directory Structure

```
fixtures/
├── fhir-resources/
│   ├── valid/              # Valid FHIR resources (should pass validation)
│   │   ├── patient-simple.json
│   │   ├── observation-vitals.json
│   │   ├── condition-active.json
│   │   ├── encounter-inpatient.json
│   │   └── medication-request.json
│   └── invalid/            # Invalid FHIR resources (should fail validation)
│       ├── patient-missing-required.json
│       ├── observation-invalid-status.json
│       └── condition-missing-status.json
├── test-data-manager.ts    # Centralized test data management utility
└── README.md               # This file
```

## Valid Test Resources

### Patient Resources

- **patient-simple.json** - Basic patient with all required fields
  - ID: `test-patient-simple`
  - Name: John Robert Smith
  - Gender: male
  - Birth Date: 1980-01-01
  - Use: General testing, reference target

### Observation Resources

- **observation-vitals.json** - Vital signs observation (heart rate)
  - ID: `test-observation-vitals`
  - Status: final
  - Code: LOINC 8867-4 (Heart rate)
  - Value: 72 beats/minute
  - Subject: Patient/test-patient-simple
  - Profile: vitalsigns
  - Use: Terminology validation, profile validation

### Condition Resources

- **condition-active.json** - Active hypertension condition
  - ID: `test-condition-active`
  - Clinical Status: active
  - Verification Status: confirmed
  - Code: SNOMED 38341003 (Hypertension)
  - Subject: Patient/test-patient-simple
  - Use: Reference validation, terminology validation

### Encounter Resources

- **encounter-inpatient.json** - Inpatient encounter
  - ID: `test-encounter-inpatient`
  - Status: finished
  - Class: IMP (inpatient encounter)
  - Type: Emergency hospital admission
  - Subject: Patient/test-patient-simple
  - Period: 2024-10-10 to 2024-10-15
  - Use: Complex resource validation

### MedicationRequest Resources

- **medication-request.json** - Active medication order
  - ID: `test-medication-request`
  - Status: active
  - Intent: order
  - Medication: Lisinopril 10mg
  - Subject: Patient/test-patient-simple
  - Dosage: 1 tablet daily
  - Use: Complex validation, reference validation

## Invalid Test Resources

### Missing Required Fields

- **patient-missing-required.json**
  - Missing: gender (required in some profiles)
  - Expected Error: "Missing required field"
  - Use: Testing error detection

### Invalid Enum Values

- **observation-invalid-status.json**
  - Invalid: status = "invalid-status-value"
  - Valid values: registered, preliminary, final, amended, etc.
  - Expected Error: "Invalid status value"
  - Use: Testing enum validation

### Missing Required Elements

- **condition-missing-status.json**
  - Missing: clinicalStatus (required)
  - Missing: verificationStatus (required)
  - Expected Error: "Missing required elements"
  - Use: Testing structural validation

## Test Data Manager

The `test-data-manager.ts` utility provides centralized access to all test fixtures:

```typescript
import { getTestDataManager } from './test-data-manager';

const manager = getTestDataManager();

// Get all valid resources
const validResources = manager.getValidResources();

// Get resources by type
const patients = manager.getResourcesByType('Patient');

// Get specific resource
const patient = manager.getResourceById('test-patient-simple');

// Get statistics
const stats = manager.getStatistics();
console.log(`Total resources: ${stats.total}`);
```

### Helper Functions

```typescript
import { 
  loadTestResource,
  loadValidResources,
  loadInvalidResources,
  createTestPatient,
  createTestObservation
} from './test-data-manager';

// Load specific resource
const patient = loadTestResource('test-patient-simple');

// Load all valid resources
const valid = loadValidResources();

// Create dynamic test resources
const newPatient = createTestPatient({ gender: 'female' });
const observation = createTestObservation('Patient/123');
```

## Usage in Tests

### Example 1: Validate All Valid Resources

```typescript
import { getTestDataManager } from '../fixtures/test-data-manager';
import { getValidationEngine } from '../../services/validation/core/validation-engine';

describe('Valid Resource Validation', () => {
  const manager = getTestDataManager();
  const engine = getValidationEngine();

  it('should validate all valid resources successfully', async () => {
    const validResources = manager.getValidResources();

    for (const testResource of validResources) {
      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    }
  });
});
```

### Example 2: Validate Invalid Resources Should Fail

```typescript
describe('Invalid Resource Validation', () => {
  it('should detect errors in invalid resources', async () => {
    const invalidResources = manager.getInvalidResources();

    for (const testResource of invalidResources) {
      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});
```

### Example 3: Test Specific Resource Type

```typescript
describe('Patient Validation', () => {
  it('should validate patient resources', async () => {
    const patients = manager.getValidResourcesByType('Patient');

    for (const patient of patients) {
      const result = await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
      });

      expect(result.isValid).toBe(true);
    }
  });
});
```

## Adding New Test Fixtures

### Step 1: Create Resource File

Create a new JSON file in either `valid/` or `invalid/` directory:

```bash
# Valid resource
touch fhir-resources/valid/patient-complex.json

# Invalid resource
touch fhir-resources/invalid/patient-invalid-gender.json
```

### Step 2: Add Resource Content

```json
{
  "resourceType": "Patient",
  "id": "test-patient-complex",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2024-10-16T10:00:00Z"
  },
  ...
}
```

### Step 3: Test Data Manager Auto-Loads

The `TestDataManager` automatically discovers and loads all JSON files in the fixtures directory. No code changes needed!

### Step 4: Verify Loading

```typescript
const manager = getTestDataManager();
const stats = manager.getStatistics();
console.log(stats); // Should show your new resource
```

## Test Coverage Goals

### Resource Types (Minimum)
- ✅ Patient (1 valid, 1 invalid)
- ✅ Observation (1 valid, 1 invalid)
- ✅ Condition (1 valid, 1 invalid)
- ✅ Encounter (1 valid)
- ✅ MedicationRequest (1 valid)
- [ ] Procedure (TODO)
- [ ] DiagnosticReport (TODO)
- [ ] AllergyIntolerance (TODO)
- [ ] Immunization (TODO)
- [ ] CarePlan (TODO)

### Validation Scenarios (Coverage)
- ✅ Structural validation (missing required, invalid enums)
- ✅ Reference validation (valid/invalid references)
- ✅ Terminology validation (valid/invalid codes)
- [ ] Profile validation (conformance to profiles)
- [ ] Business rules (custom FHIRPath rules)
- [ ] Metadata validation (meta fields)

### Error Types
- ✅ Missing required fields
- ✅ Invalid enum values
- [ ] Invalid data types
- [ ] Invalid references
- [ ] Invalid code systems
- [ ] Profile non-conformance

## Maintenance

### When to Add New Fixtures

1. **New resource type tested** - Add valid + invalid examples
2. **New validation scenario** - Add resources that trigger it
3. **Bug found** - Add regression test resource
4. **New profile supported** - Add profile-conformant examples

### Naming Conventions

```
{resourceType}-{category}.json

Examples:
- patient-simple.json
- patient-complex.json
- observation-vitals.json
- observation-lab-result.json
- condition-active.json
- encounter-inpatient.json
```

For invalid resources:
```
{resourceType}-{error-type}.json

Examples:
- patient-missing-required.json
- observation-invalid-status.json
- condition-missing-status.json
```

## Statistics

Current test fixture count:
- **Total Resources**: 8
- **Valid**: 5
- **Invalid**: 3
- **Resource Types**: 5 (Patient, Observation, Condition, Encounter, MedicationRequest)

**Target**: 50+ resources covering all major FHIR resource types and validation scenarios.

## Related Documentation

- [Integration Tests](../integration/README.md) - How integration tests use these fixtures
- [Validation Engine](../../services/validation/README.md) - Validation implementation
- [Test Data Manager](./test-data-manager.ts) - Fixture management utility

