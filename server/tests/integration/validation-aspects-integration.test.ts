/**
 * Validation Aspects Integration Tests
 * Task 11.4: Integration tests for each validation aspect independently
 * 
 * Tests each validation aspect (structural, profile, terminology, reference, etc.)
 * with real FHIR resources to ensure they work correctly in integration.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';
import type { ValidationRequest } from '../../services/validation/types/validation-types';

// ============================================================================
// Setup
// ============================================================================

const engine = getValidationEngine();
const testData = getTestDataManager();

beforeAll(() => {
  console.log('\n[Integration Tests] Loaded test fixtures:');
  const stats = testData.getStatistics();
  console.log(`  Total: ${stats.total}`);
  console.log(`  Valid: ${stats.valid}`);
  console.log(`  Invalid: ${stats.invalid}`);
  console.log(`  Resource Types: ${stats.resourceTypes}`);
  console.log();
});

// ============================================================================
// Structural Validation Tests
// ============================================================================

describe('Structural Validation Integration', () => {
  it('should validate structurally valid resources', async () => {
    const validResources = testData.getValidResources();

    expect(validResources.length).toBeGreaterThan(0);

    for (const testResource of validResources) {
      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
        settings: {
          aspects: {
            structural: { enabled: true },
            profile: { enabled: false },
            terminology: { enabled: false },
            reference: { enabled: false },
            businessRule: { enabled: false },
            metadata: { enabled: false },
          },
        },
      });

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.aspects).toContain('structural');
    }
  });

  it('should detect structural errors in invalid resources', async () => {
    const invalidResources = testData.getInvalidResources();

    expect(invalidResources.length).toBeGreaterThan(0);

    for (const testResource of invalidResources) {
      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
        settings: {
          aspects: {
            structural: { enabled: true },
            profile: { enabled: false },
            terminology: { enabled: false },
            reference: { enabled: false },
            businessRule: { enabled: false },
            metadata: { enabled: false },
          },
        },
      });

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.aspects).toContain('structural');
    }
  });

  it('should validate different resource types', async () => {
    const resourceTypes = testData.getResourceTypes();

    for (const resourceType of resourceTypes) {
      const resources = testData.getValidResourcesByType(resourceType);

      if (resources.length > 0) {
        const result = await engine.validateResource({
          resource: resources[0].content,
          resourceType,
          settings: {
            aspects: {
              structural: { enabled: true },
            },
          },
        });

        expect(result.resourceType).toBe(resourceType);
        expect(result.aspects).toContain('structural');
      }
    }
  });
});

// ============================================================================
// Profile Validation Tests
// ============================================================================

describe('Profile Validation Integration', () => {
  it('should validate resources against declared profiles', async () => {
    // Get resources with declared profiles
    const observation = testData.getResourceById('test-observation-vitals');

    if (observation) {
      const result = await engine.validateResource({
        resource: observation.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            structural: { enabled: false },
            profile: { enabled: true },
            terminology: { enabled: false },
            reference: { enabled: false },
            businessRule: { enabled: false },
            metadata: { enabled: false },
          },
        },
      });

      expect(result.aspects).toContain('profile');
      // Profile validation may pass or fail depending on profile availability
      // The key is that it runs without crashing
    }
  });

  it('should handle resources without declared profiles', async () => {
    const patient = testData.getResourceById('test-patient-simple');

    if (patient) {
      const result = await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('profile');
    }
  });
});

// ============================================================================
// Terminology Validation Tests
// ============================================================================

describe('Terminology Validation Integration', () => {
  it('should validate terminology in coded elements', async () => {
    const observation = testData.getResourceById('test-observation-vitals');

    if (observation) {
      const result = await engine.validateResource({
        resource: observation.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            structural: { enabled: false },
            profile: { enabled: false },
            terminology: { enabled: true },
            reference: { enabled: false },
            businessRule: { enabled: false },
            metadata: { enabled: false },
          },
        },
      });

      expect(result.aspects).toContain('terminology');
      // Terminology validation depends on server availability
    }
  });

  it('should validate LOINC codes in observations', async () => {
    const observations = testData.getValidResourcesByType('Observation');

    for (const obs of observations) {
      const result = await engine.validateResource({
        resource: obs.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            terminology: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('terminology');
    }
  });

  it('should validate SNOMED CT codes in conditions', async () => {
    const conditions = testData.getValidResourcesByType('Condition');

    for (const condition of conditions) {
      const result = await engine.validateResource({
        resource: condition.content,
        resourceType: 'Condition',
        settings: {
          aspects: {
            terminology: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('terminology');
    }
  });
});

// ============================================================================
// Reference Validation Tests
// ============================================================================

describe('Reference Validation Integration', () => {
  it('should validate references in resources', async () => {
    const observation = testData.getResourceById('test-observation-vitals');

    if (observation) {
      const result = await engine.validateResource({
        resource: observation.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            structural: { enabled: false },
            profile: { enabled: false },
            terminology: { enabled: false },
            reference: { enabled: true },
            businessRule: { enabled: false },
            metadata: { enabled: false },
          },
        },
      });

      expect(result.aspects).toContain('reference');
      // Reference validation depends on FHIR server availability
    }
  });

  it('should validate subject references', async () => {
    const resources = testData.getValidResources().filter(r => 
      r.content.subject?.reference
    );

    for (const resource of resources.slice(0, 3)) { // Test first 3
      const result = await engine.validateResource({
        resource: resource.content,
        resourceType: resource.resourceType,
        settings: {
          aspects: {
            reference: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('reference');
    }
  });
});

// ============================================================================
// Metadata Validation Tests
// ============================================================================

describe('Metadata Validation Integration', () => {
  it('should validate resource metadata', async () => {
    const validResources = testData.getValidResources();

    for (const testResource of validResources) {
      const result = await engine.validateResource({
        resource: testResource.content,
        resourceType: testResource.resourceType,
        settings: {
          aspects: {
            structural: { enabled: false },
            profile: { enabled: false },
            terminology: { enabled: false },
            reference: { enabled: false },
            businessRule: { enabled: false },
            metadata: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('metadata');
    }
  });

  it('should validate meta.versionId format', async () => {
    const patient = testData.getResourceById('test-patient-simple');

    if (patient) {
      const result = await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
        settings: {
          aspects: {
            metadata: { enabled: true },
          },
        },
      });

      expect(result.aspects).toContain('metadata');
    }
  });
});

// ============================================================================
// Multi-Aspect Validation Tests
// ============================================================================

describe('Multi-Aspect Validation Integration', () => {
  it('should run multiple aspects together', async () => {
    const patient = testData.getResourceById('test-patient-simple');

    if (patient) {
      const result = await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
        settings: {
          aspects: {
            structural: { enabled: true },
            profile: { enabled: true },
            terminology: { enabled: true },
            reference: { enabled: true },
            metadata: { enabled: true },
          },
        },
      });

      // Should have run multiple aspects
      expect(result.aspects.length).toBeGreaterThan(1);
      expect(result.aspects).toContain('structural');
      expect(result.aspects).toContain('metadata');
    }
  });

  it('should aggregate issues from multiple aspects', async () => {
    const invalidResource = testData.getInvalidResources()[0];

    if (invalidResource) {
      const result = await engine.validateResource({
        resource: invalidResource.content,
        resourceType: invalidResource.resourceType,
        settings: {
          aspects: {
            structural: { enabled: true },
            profile: { enabled: true },
            terminology: { enabled: true },
          },
        },
      });

      // Should detect errors
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Validation Performance Integration', () => {
  it('should validate resources within reasonable time', async () => {
    const patient = testData.getResourceById('test-patient-simple');

    if (patient) {
      const startTime = Date.now();

      const result = await engine.validateResource({
        resource: patient.content,
        resourceType: 'Patient',
      });

      const elapsedTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsedTime).toBeLessThan(5000); // Should complete within 5 seconds
      console.log(`  Validation completed in ${elapsedTime}ms`);
    }
  });

  it('should handle batch validation efficiently', async () => {
    const sampleSet = testData.getSampleSet(10);

    const startTime = Date.now();

    const results = await Promise.all(
      sampleSet.map(testResource =>
        engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
        })
      )
    );

    const elapsedTime = Date.now() - startTime;
    const avgTime = elapsedTime / sampleSet.length;

    expect(results).toHaveLength(sampleSet.length);
    expect(avgTime).toBeLessThan(2000); // Average under 2s per resource
    console.log(`  Batch validation: ${sampleSet.length} resources in ${elapsedTime}ms (avg: ${avgTime.toFixed(0)}ms)`);
  });
});

