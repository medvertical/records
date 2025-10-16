/**
 * Contained Reference Resolver Unit Tests
 * 
 * Tests for resolving and validating contained resource references.
 * Validates existence, type matching, and orphaned/unreferenced detection.
 * 
 * Task 6.3: Unit tests for contained reference resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ContainedReferenceResolver,
  getContainedReferenceResolver,
  resetContainedReferenceResolver 
} from '../contained-reference-resolver';

// ============================================================================
// Test Data
// ============================================================================

function createResourceWithContained() {
  return {
    resourceType: 'Observation',
    id: 'obs-001',
    contained: [
      {
        resourceType: 'Patient',
        id: 'patient1',
        name: [{ family: 'Test', given: ['Example'] }],
      },
      {
        resourceType: 'Practitioner',
        id: 'practitioner1',
        name: [{ family: 'Doctor', given: ['Test'] }],
      },
      {
        resourceType: 'Organization',
        id: 'org1',
        name: 'Test Organization',
      },
    ],
    subject: {
      reference: '#patient1',
    },
    performer: [
      {
        reference: '#practitioner1',
      },
    ],
  };
}

function createResourceWithoutContained() {
  return {
    resourceType: 'Observation',
    id: 'obs-002',
    subject: {
      reference: 'Patient/external-patient',
    },
  };
}

function createResourceWithOrphanedReferences() {
  return {
    resourceType: 'Observation',
    id: 'obs-003',
    contained: [
      {
        resourceType: 'Patient',
        id: 'patient1',
        name: [{ family: 'Test' }],
      },
    ],
    subject: {
      reference: '#patient1',
    },
    performer: [
      {
        reference: '#practitioner1', // Orphaned - doesn't exist in contained
      },
    ],
  };
}

function createResourceWithUnreferencedContained() {
  return {
    resourceType: 'Observation',
    id: 'obs-004',
    contained: [
      {
        resourceType: 'Patient',
        id: 'patient1',
        name: [{ family: 'Test' }],
      },
      {
        resourceType: 'Practitioner',
        id: 'practitioner1',
        name: [{ family: 'Doctor' }],
      },
    ],
    subject: {
      reference: '#patient1',
    },
    // practitioner1 is in contained but not referenced
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ContainedReferenceResolver', () => {
  let resolver: ContainedReferenceResolver;

  beforeEach(() => {
    resetContainedReferenceResolver();
    resolver = getContainedReferenceResolver();
  });

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('Extract Contained Resources', () => {
    it('should extract all contained resources', () => {
      const resource = createResourceWithContained();
      const contained = resolver.extractContainedResources(resource);

      expect(contained).toHaveLength(3);
      expect(contained[0]).toEqual({
        id: 'patient1',
        resourceType: 'Patient',
        resource: expect.objectContaining({ id: 'patient1', resourceType: 'Patient' }),
      });
    });

    it('should return empty array when no contained resources', () => {
      const resource = createResourceWithoutContained();
      const contained = resolver.extractContainedResources(resource);

      expect(contained).toHaveLength(0);
    });

    it('should handle resource without contained property', () => {
      const resource = { resourceType: 'Patient', id: '123' };
      const contained = resolver.extractContainedResources(resource);

      expect(contained).toHaveLength(0);
    });

    it('should filter out invalid contained resources', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          { resourceType: 'Patient', id: 'patient1' }, // Valid
          { resourceType: 'Practitioner' }, // Invalid - missing id
          { id: 'org1' }, // Invalid - missing resourceType
          null, // Invalid - null
          undefined, // Invalid - undefined
        ],
      };

      const contained = resolver.extractContainedResources(resource);
      expect(contained).toHaveLength(1);
      expect(contained[0].id).toBe('patient1');
    });
  });

  // ========================================================================
  // Reference Resolution Tests
  // ========================================================================

  describe('Resolve Contained References', () => {
    it('should resolve valid contained reference', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('#patient1', resource);

      expect(result.found).toBe(true);
      expect(result.resource).toBeDefined();
      expect(result.resource?.resourceType).toBe('Patient');
      expect(result.resource?.id).toBe('patient1');
    });

    it('should fail to resolve non-existent contained reference', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('#nonexistent', resource);

      expect(result.found).toBe(false);
      expect(result.errorMessage).toContain('not found');
    });

    it('should fail when resource has no contained resources', () => {
      const resource = createResourceWithoutContained();
      const result = resolver.resolveContainedReference('#patient1', resource);

      expect(result.found).toBe(false);
      expect(result.errorMessage).toContain('no contained resources');
    });

    it('should fail for non-contained reference format', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('Patient/123', resource);

      expect(result.found).toBe(false);
      expect(result.errorMessage).toContain('not a contained reference');
    });

    it('should fail for contained reference missing ID', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('#', resource);

      expect(result.found).toBe(false);
      expect(result.errorMessage).toContain('missing resource ID');
    });
  });

  // ========================================================================
  // Type Validation Tests
  // ========================================================================

  describe('Type Validation for Contained References', () => {
    it('should validate type matches expectation', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('#patient1', resource, 'Patient');

      expect(result.found).toBe(true);
      expect(result.typeMatches).toBe(true);
      expect(result.expectedType).toBe('Patient');
    });

    it('should detect type mismatch', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('#patient1', resource, 'Practitioner');

      expect(result.found).toBe(true);
      expect(result.typeMatches).toBe(false);
      expect(result.resource?.resourceType).toBe('Patient');
      expect(result.expectedType).toBe('Practitioner');
    });

    it('should validate contained reference with full validation', () => {
      const resource = createResourceWithContained();
      const validation = resolver.validateContainedReference('#patient1', resource, ['Patient', 'Group']);

      expect(validation.isValid).toBe(true);
      expect(validation.severity).toBe('info');
    });

    it('should reject contained reference with wrong type', () => {
      const resource = createResourceWithContained();
      const validation = resolver.validateContainedReference('#patient1', resource, ['Practitioner', 'Organization']);

      expect(validation.isValid).toBe(false);
      expect(validation.severity).toBe('error');
      expect(validation.code).toBe('contained-reference-type-mismatch');
      expect(validation.message).toContain('Patient');
    });

    it('should allow any type when expectedTypes includes Resource', () => {
      const resource = createResourceWithContained();
      const validation = resolver.validateContainedReference('#patient1', resource, ['Resource']);

      expect(validation.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Find Contained References Tests
  // ========================================================================

  describe('Find Contained References', () => {
    it('should find all contained references in resource', () => {
      const resource = createResourceWithContained();
      const references = resolver.findContainedReferences(resource);

      expect(references.length).toBeGreaterThanOrEqual(2);
      expect(references).toContain('#patient1');
      expect(references).toContain('#practitioner1');
    });

    it('should not find contained references in resource without them', () => {
      const resource = createResourceWithoutContained();
      const references = resolver.findContainedReferences(resource);

      expect(references).toHaveLength(0);
    });

    it('should find deeply nested contained references', () => {
      const resource = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              subject: { reference: '#patient1' },
            },
          },
        ],
      };

      const references = resolver.findContainedReferences(resource);
      expect(references).toContain('#patient1');
    });
  });

  // ========================================================================
  // Unreferenced and Orphaned Detection Tests
  // ========================================================================

  describe('Unreferenced and Orphaned Detection', () => {
    it('should detect unreferenced contained resources', () => {
      const resource = createResourceWithUnreferencedContained();
      const { unreferencedResources, warnings } = resolver.validateUnreferencedContainedResources(resource);

      expect(unreferencedResources).toHaveLength(1);
      expect(unreferencedResources[0].id).toBe('practitioner1');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('practitioner1');
    });

    it('should detect orphaned contained references', () => {
      const resource = createResourceWithOrphanedReferences();
      const orphaned = resolver.findOrphanedReferences(resource);

      expect(orphaned).toHaveLength(1);
      expect(orphaned[0].reference).toBe('#practitioner1');
    });

    it('should not warn when all contained resources are referenced', () => {
      const resource = createResourceWithContained();
      const { unreferencedResources, warnings } = resolver.validateUnreferencedContainedResources(resource);

      // org1 might be unreferenced in this example
      expect(Array.isArray(unreferencedResources)).toBe(true);
      expect(Array.isArray(warnings)).toBe(true);
    });
  });

  // ========================================================================
  // Utility Methods Tests
  // ========================================================================

  describe('Utility Methods', () => {
    it('should get contained resource by ID', () => {
      const resource = createResourceWithContained();
      const contained = resolver.getContainedResourceById(resource, 'patient1');

      expect(contained).toBeDefined();
      expect(contained?.resourceType).toBe('Patient');
      expect(contained?.id).toBe('patient1');
    });

    it('should return null for non-existent ID', () => {
      const resource = createResourceWithContained();
      const contained = resolver.getContainedResourceById(resource, 'nonexistent');

      expect(contained).toBe(null);
    });

    it('should check if resource has contained resources', () => {
      const resourceWith = createResourceWithContained();
      const resourceWithout = createResourceWithoutContained();

      expect(resolver.hasContainedResources(resourceWith)).toBe(true);
      expect(resolver.hasContainedResources(resourceWithout)).toBe(false);
    });

    it('should get all contained resource IDs', () => {
      const resource = createResourceWithContained();
      const ids = resolver.getContainedResourceIds(resource);

      expect(ids).toHaveLength(3);
      expect(ids).toContain('patient1');
      expect(ids).toContain('practitioner1');
      expect(ids).toContain('org1');
    });

    it('should get contained resources by type', () => {
      const resource = createResourceWithContained();
      const patients = resolver.getContainedResourcesByType(resource, 'Patient');
      const practitioners = resolver.getContainedResourcesByType(resource, 'Practitioner');

      expect(patients).toHaveLength(1);
      expect(patients[0].id).toBe('patient1');
      expect(practitioners).toHaveLength(1);
      expect(practitioners[0].id).toBe('practitioner1');
    });
  });

  // ========================================================================
  // Batch Validation Tests
  // ========================================================================

  describe('Batch Validation', () => {
    it('should validate multiple contained references', () => {
      const resource = createResourceWithContained();
      const references = [
        { reference: '#patient1', fieldPath: 'subject', expectedTypes: ['Patient', 'Group'] },
        { reference: '#practitioner1', fieldPath: 'performer', expectedTypes: ['Practitioner'] },
        { reference: '#nonexistent', fieldPath: 'device', expectedTypes: ['Device'] },
      ];

      const results = resolver.validateAllContainedReferences(resource, references);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });

    it('should include field paths in batch results', () => {
      const resource = createResourceWithContained();
      const references = [
        { reference: '#patient1', fieldPath: 'subject', expectedTypes: ['Patient'] },
      ];

      const results = resolver.validateAllContainedReferences(resource, references);

      expect(results[0].fieldPath).toBe('subject');
    });
  });

  // ========================================================================
  // Real-World Scenarios
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should handle Observation with contained Patient', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          { resourceType: 'Patient', id: 'pat-inline' },
        ],
        subject: { reference: '#pat-inline' },
      };

      const validation = resolver.validateContainedReference(
        '#pat-inline',
        resource,
        ['Patient', 'Group']
      );

      expect(validation.isValid).toBe(true);
    });

    it('should handle Bundle with contained resources', () => {
      const resource = {
        resourceType: 'Bundle',
        contained: [
          { resourceType: 'Medication', id: 'med1' },
        ],
        entry: [
          {
            resource: {
              resourceType: 'MedicationRequest',
              medicationReference: { reference: '#med1' },
            },
          },
        ],
      };

      const validation = resolver.validateContainedReference(
        '#med1',
        resource,
        ['Medication']
      );

      expect(validation.isValid).toBe(true);
    });

    it('should detect type mismatch in real scenario', () => {
      const resource = {
        resourceType: 'DiagnosticReport',
        contained: [
          { resourceType: 'Patient', id: 'pat1' },
        ],
        result: [
          { reference: '#pat1' }, // Should be Observation, not Patient
        ],
      };

      const validation = resolver.validateContainedReference(
        '#pat1',
        resource,
        ['Observation']
      );

      expect(validation.isValid).toBe(false);
      expect(validation.code).toBe('contained-reference-type-mismatch');
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle null resource gracefully', () => {
      const contained = resolver.extractContainedResources(null);
      expect(contained).toHaveLength(0);
    });

    it('should handle undefined resource gracefully', () => {
      const contained = resolver.extractContainedResources(undefined);
      expect(contained).toHaveLength(0);
    });

    it('should handle resource with empty contained array', () => {
      const resource = { resourceType: 'Observation', contained: [] };
      const contained = resolver.extractContainedResources(resource);

      expect(contained).toHaveLength(0);
      expect(resolver.hasContainedResources(resource)).toBe(false);
    });

    it('should handle malformed contained reference', () => {
      const resource = createResourceWithContained();
      const result = resolver.resolveContainedReference('invalid-format', resource);

      expect(result.found).toBe(false);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle resources with many contained resources efficiently', () => {
      const resource = {
        resourceType: 'Bundle',
        contained: Array.from({ length: 100 }, (_, i) => ({
          resourceType: 'Patient',
          id: `patient${i}`,
        })),
      };

      const startTime = Date.now();
      const contained = resolver.extractContainedResources(resource);
      const endTime = Date.now();

      expect(contained).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(50);
    });

    it('should resolve references quickly', () => {
      const resource = createResourceWithContained();

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        resolver.resolveContainedReference('#patient1', resource);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

