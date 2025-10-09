/**
 * HAPI FHIR Validator Integration Tests
 * 
 * Tests the complete HAPI validation flow end-to-end:
 * - Real FHIR resource validation
 * - OperationOutcome parsing
 * - Integration with validation engine
 * - Error handling and retry logic
 * 
 * Target: Task 1.13 - Integration test with known Patient issues
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { HapiValidatorClient } from '../../../server/services/validation/engine/hapi-validator-client';
import { StructuralValidator } from '../../../server/services/validation/engine/structural-validator';
import { ProfileValidator } from '../../../server/services/validation/engine/profile-validator';
import type { HapiValidationOptions } from '../../../server/services/validation/engine/hapi-validator-types';

// ============================================================================
// Test Data - Real FHIR Resources with Known Issues
// ============================================================================

/**
 * Valid Patient Resource (R4)
 * Should pass all validation checks
 */
const VALID_PATIENT_R4 = {
  resourceType: 'Patient',
  id: 'example-valid',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-01T00:00:00Z',
    profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
  },
  text: {
    status: 'generated',
    div: '<div xmlns="http://www.w3.org/1999/xhtml">John Doe</div>',
  },
  identifier: [{
    use: 'official',
    system: 'urn:oid:1.2.36.146.595.217.0.1',
    value: '12345',
  }],
  active: true,
  name: [{
    use: 'official',
    family: 'Doe',
    given: ['John', 'Michael'],
  }],
  gender: 'male',
  birthDate: '1974-12-25',
  address: [{
    use: 'home',
    line: ['123 Main St'],
    city: 'Boston',
    state: 'MA',
    postalCode: '02101',
    country: 'USA',
  }],
};

/**
 * Invalid Patient - Missing Required Fields
 * Should fail structural validation
 */
const INVALID_PATIENT_MISSING_FIELDS = {
  resourceType: 'Patient',
  id: 'example-missing-fields',
  // Missing: name (not required in spec but best practice)
  // Invalid: gender value
  gender: 'invalid-gender-value', // Should be: male | female | other | unknown
};

/**
 * Invalid Patient - Wrong Data Types
 * Should fail structural validation
 */
const INVALID_PATIENT_WRONG_TYPES = {
  resourceType: 'Patient',
  id: 'example-wrong-types',
  active: 'yes', // Should be boolean
  birthDate: '01/01/2000', // Should be YYYY-MM-DD format
  name: 'John Doe', // Should be array of HumanName
  gender: 'male',
};

/**
 * Invalid Patient - Cardinality Violations
 * Should fail structural validation
 */
const INVALID_PATIENT_CARDINALITY = {
  resourceType: 'Patient',
  id: 'example-cardinality',
  resourceType: 'Patient', // Duplicate field
  gender: ['male', 'female'], // Should be single value, not array
  name: [{
    family: 'Doe',
    given: ['John'],
  }],
};

/**
 * Invalid Patient - Terminology Issues
 * Should fail terminology validation
 */
const INVALID_PATIENT_TERMINOLOGY = {
  resourceType: 'Patient',
  id: 'example-terminology',
  name: [{
    use: 'invalid-use-code', // Invalid code from http://hl7.org/fhir/ValueSet/name-use
    family: 'Doe',
    given: ['John'],
  }],
  gender: 'male',
  maritalStatus: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-MaritalStatus',
      code: 'INVALID', // Invalid code in marital status value set
      display: 'Invalid Status',
    }],
  },
};

/**
 * Invalid Patient - Profile Constraints
 * Should fail profile validation (if validating against specific profile)
 */
const INVALID_PATIENT_PROFILE = {
  resourceType: 'Patient',
  id: 'example-profile',
  meta: {
    profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'],
  },
  // Missing required fields for US Core Patient:
  // - identifier (required in US Core)
  // - name (required in US Core)
  // - gender (required in US Core)
  active: true,
};

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_OPTIONS: HapiValidationOptions = {
  fhirVersion: 'R4',
  mode: 'online',
  timeout: 30000,
};

// ============================================================================
// Integration Tests
// ============================================================================

describe('HAPI Validator Integration Tests', () => {
  let hapiClient: HapiValidatorClient;
  let structuralValidator: StructuralValidator;
  let profileValidator: ProfileValidator;

  // Skip tests if Java is not installed or HAPI JAR is missing
  const isHapiAvailable = (() => {
    try {
      const { execSync } = require('child_process');
      execSync('java -version', { stdio: 'ignore' });
      const fs = require('fs');
      const path = require('path');
      const jarPath = process.env.HAPI_JAR_PATH || path.join(process.cwd(), 'server/lib/validator_cli.jar');
      return fs.existsSync(jarPath);
    } catch {
      return false;
    }
  })();

  beforeAll(() => {
    if (!isHapiAvailable) {
      console.warn(
        '\n⚠️  HAPI Validator integration tests skipped\n' +
        'Reason: Java or HAPI JAR not found\n' +
        'To enable these tests:\n' +
        '  1. Install Java 11+: brew install openjdk@11 (macOS)\n' +
        '  2. Download HAPI JAR: bash scripts/setup-hapi-validator.sh\n'
      );
    } else {
      hapiClient = new HapiValidatorClient();
      structuralValidator = new StructuralValidator(hapiClient);
      profileValidator = new ProfileValidator(hapiClient);
    }
  });

  // --------------------------------------------------------------------------
  // Test 1: Valid Patient Resource
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('Valid Patient Validation', () => {
    it('should validate valid Patient resource successfully', async () => {
      const issues = await hapiClient.validateResource(VALID_PATIENT_R4, TEST_OPTIONS);

      // Should have no errors
      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors).toHaveLength(0);

      // May have warnings or information messages
      console.log(`✅ Valid Patient: ${issues.length} issues (${errors.length} errors)`);
    }, 30000);

    it('should return proper issue structure', async () => {
      const issues = await hapiClient.validateResource(VALID_PATIENT_R4, TEST_OPTIONS);

      // Verify issue structure
      issues.forEach(issue => {
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('code');
        expect(issue).toHaveProperty('message');
        expect(['error', 'warning', 'information']).toContain(issue.severity);
      });
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 2: Invalid Patient - Missing Required Fields
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('Invalid Patient - Missing Fields', () => {
    it('should detect missing required fields', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_MISSING_FIELDS,
        TEST_OPTIONS
      );

      // Should have errors
      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);

      console.log(`❌ Invalid Patient (missing fields): ${errors.length} errors`);
      errors.forEach(error => {
        console.log(`   - ${error.message}`);
      });
    }, 30000);

    it('should detect invalid gender value', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_MISSING_FIELDS,
        TEST_OPTIONS
      );

      // Should have error about invalid gender
      const genderErrors = issues.filter(
        issue =>
          issue.severity === 'error' &&
          (issue.message?.includes('gender') || issue.location?.includes('gender'))
      );

      expect(genderErrors.length).toBeGreaterThan(0);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 3: Invalid Patient - Wrong Data Types
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('Invalid Patient - Wrong Types', () => {
    it('should detect wrong data types', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_WRONG_TYPES,
        TEST_OPTIONS
      );

      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);

      console.log(`❌ Invalid Patient (wrong types): ${errors.length} errors`);
    }, 30000);

    it('should detect boolean type violation for active field', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_WRONG_TYPES,
        TEST_OPTIONS
      );

      const activeErrors = issues.filter(
        issue =>
          issue.severity === 'error' &&
          (issue.message?.toLowerCase().includes('active') ||
            issue.location?.includes('active'))
      );

      expect(activeErrors.length).toBeGreaterThan(0);
    }, 30000);

    it('should detect date format violation', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_WRONG_TYPES,
        TEST_OPTIONS
      );

      const dateErrors = issues.filter(
        issue =>
          issue.severity === 'error' &&
          (issue.message?.toLowerCase().includes('date') ||
            issue.message?.toLowerCase().includes('format'))
      );

      expect(dateErrors.length).toBeGreaterThan(0);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 4: StructuralValidator Integration
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('StructuralValidator Integration', () => {
    it('should use HAPI for structural validation', async () => {
      const issues = await structuralValidator.validate(
        INVALID_PATIENT_MISSING_FIELDS,
        'Patient',
        'R4'
      );

      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);

      console.log(`✅ StructuralValidator: ${errors.length} errors detected`);
    }, 30000);

    it('should pass validation for valid resource', async () => {
      const issues = await structuralValidator.validate(VALID_PATIENT_R4, 'Patient', 'R4');

      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors).toHaveLength(0);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 5: ProfileValidator Integration
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('ProfileValidator Integration', () => {
    it('should validate against base Patient profile', async () => {
      const issues = await profileValidator.validate(
        VALID_PATIENT_R4,
        'Patient',
        'R4',
        'http://hl7.org/fhir/StructureDefinition/Patient'
      );

      const errors = issues.filter(issue => issue.severity === 'error');
      expect(errors).toHaveLength(0);

      console.log(`✅ ProfileValidator: ${issues.length} issues (${errors.length} errors)`);
    }, 30000);

    it('should detect profile constraint violations', async () => {
      const issues = await profileValidator.validate(
        INVALID_PATIENT_PROFILE,
        'Patient',
        'R4',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'
      );

      const errors = issues.filter(issue => issue.severity === 'error');
      // US Core Patient requires identifier, name, gender
      expect(errors.length).toBeGreaterThan(0);

      console.log(`❌ ProfileValidator (US Core): ${errors.length} constraint violations`);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 6: OperationOutcome Parsing
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('OperationOutcome Parsing', () => {
    it('should parse OperationOutcome into ValidationIssue format', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_MISSING_FIELDS,
        TEST_OPTIONS
      );

      // Verify all issues have required fields
      issues.forEach(issue => {
        expect(issue).toHaveProperty('severity');
        expect(issue).toHaveProperty('code');
        expect(issue).toHaveProperty('message');
        expect(issue).toHaveProperty('aspect');

        // Aspect should be properly categorized
        expect(['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata']).toContain(
          issue.aspect
        );
      });

      console.log(`✅ OperationOutcome parsed: ${issues.length} issues`);
    }, 30000);

    it('should include location information in issues', async () => {
      const issues = await hapiClient.validateResource(
        INVALID_PATIENT_MISSING_FIELDS,
        TEST_OPTIONS
      );

      const issuesWithLocation = issues.filter(issue => issue.location && issue.location.length > 0);

      // At least some issues should have location
      expect(issuesWithLocation.length).toBeGreaterThan(0);

      issuesWithLocation.forEach(issue => {
        console.log(`   Location: ${issue.location} - ${issue.message}`);
      });
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 7: Error Handling
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{ invalid json }';

      await expect(async () => {
        await hapiClient.validateResource(invalidJson as any, TEST_OPTIONS);
      }).rejects.toThrow();
    }, 30000);

    it('should handle unsupported resource types gracefully', async () => {
      const unsupportedResource = {
        resourceType: 'UnsupportedType',
        id: 'test',
      };

      const issues = await hapiClient.validateResource(unsupportedResource, TEST_OPTIONS);

      // Should return validation issues, not crash
      expect(issues).toBeInstanceOf(Array);
    }, 30000);
  });

  // --------------------------------------------------------------------------
  // Test 8: Performance
  // --------------------------------------------------------------------------

  describe.skipIf(!isHapiAvailable)('Performance', () => {
    it('should complete validation within timeout', async () => {
      const startTime = Date.now();

      await hapiClient.validateResource(VALID_PATIENT_R4, TEST_OPTIONS);

      const duration = Date.now() - startTime;
      console.log(`⏱️  Validation duration: ${duration}ms`);

      // Should complete within 10 seconds (PRD requirement)
      expect(duration).toBeLessThan(10000);
    }, 30000);

    it('should handle multiple validations efficiently', async () => {
      const startTime = Date.now();

      const validations = [
        hapiClient.validateResource(VALID_PATIENT_R4, TEST_OPTIONS),
        hapiClient.validateResource(INVALID_PATIENT_MISSING_FIELDS, TEST_OPTIONS),
        hapiClient.validateResource(INVALID_PATIENT_WRONG_TYPES, TEST_OPTIONS),
      ];

      await Promise.all(validations);

      const duration = Date.now() - startTime;
      console.log(`⏱️  3 validations duration: ${duration}ms (avg: ${(duration / 3).toFixed(0)}ms)`);

      // Should complete within 30 seconds for 3 resources
      expect(duration).toBeLessThan(30000);
    }, 60000);
  });
});

