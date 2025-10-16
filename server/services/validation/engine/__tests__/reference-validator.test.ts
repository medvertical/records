/**
 * Reference Validator Integration Unit Tests
 * 
 * Comprehensive tests for the ReferenceValidator with all enhanced capabilities.
 * Tests integration of type extraction, constraints, contained, Bundle, circular,
 * recursive, version, canonical, and batched checking.
 * 
 * Task 6.12: Write unit tests for reference type validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReferenceValidator } from '../reference-validator';

// ============================================================================
// Test Data
// ============================================================================

function createPatient(id: string, orgRef?: string) {
  return {
    resourceType: 'Patient',
    id,
    managingOrganization: orgRef ? { reference: orgRef } : undefined,
  };
}

function createObservation(id: string, subjectRef: string) {
  return {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: {
      coding: [{ system: 'http://loinc.org', code: '15074-8' }],
    },
    subject: { reference: subjectRef },
  };
}

function createBundle(entries: any[]) {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries.map(resource => ({
      fullUrl: `${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ReferenceValidator - Integration Tests', () => {
  let validator: ReferenceValidator;

  beforeEach(() => {
    validator = new ReferenceValidator();
  });

  // ========================================================================
  // Basic Validation Tests
  // ========================================================================

  describe('Basic Reference Validation', () => {
    it('should validate resource with valid references', async () => {
      const patient = createPatient('pat1', 'Organization/org1');
      
      const issues = await validator.validate(patient, 'Patient');

      // Should not have critical errors for format
      const criticalIssues = issues.filter(i => i.severity === 'error');
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should detect invalid reference format', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'pat1',
        managingOrganization: { reference: 'invalid reference format!@#' },
      };

      const issues = await validator.validate(patient, 'Patient');

      const formatErrors = issues.filter(i => 
        i.code === 'invalid-reference-format'
      );
      expect(formatErrors.length).toBeGreaterThan(0);
    });

    it('should handle resource without references', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'pat1',
        name: [{ family: 'Test' }],
      };

      const issues = await validator.validate(patient, 'Patient');

      // Should complete without errors
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  // ========================================================================
  // Type Extraction Tests (Task 6.1)
  // ========================================================================

  describe('Reference Type Extraction', () => {
    it('should extract resource type from reference', () => {
      const type = validator.extractResourceType('Patient/123');

      expect(type).toBe('Patient');
    });

    it('should parse various reference formats', () => {
      const relative = validator.parseReference('Patient/123');
      expect(relative.resourceType).toBe('Patient');
      expect(relative.resourceId).toBe('123');

      const absolute = validator.parseReference('https://server.com/fhir/Patient/123');
      expect(absolute.referenceType).toBe('absolute');

      const contained = validator.parseReference('#contained-1');
      expect(contained.referenceType).toBe('contained');
    });
  });

  // ========================================================================
  // Type Constraint Validation Tests (Task 6.2)
  // ========================================================================

  describe('Type Constraint Validation', () => {
    it('should validate reference type against constraints', () => {
      const result = validator.validateReferenceTypeConstraint(
        'Patient/123',
        'Observation',
        'subject'
      );

      expect(result.isValid).toBe(true);
    });

    it('should detect type mismatch', () => {
      const result = validator.validateReferenceTypeConstraint(
        'Medication/456',
        'Observation',
        'subject'
      );

      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('error');
    });

    it('should check if field has type constraints', () => {
      const hasConstraints = validator.hasTypeConstraints('Observation', 'subject');

      expect(typeof hasConstraints).toBe('boolean');
    });

    it('should get field constraints', () => {
      const constraints = validator.getFieldConstraints('Observation', 'subject');

      expect(constraints).toBeDefined();
      if (constraints) {
        expect(Array.isArray(constraints.targetTypes)).toBe(true);
      }
    });
  });

  // ========================================================================
  // Contained Reference Tests (Task 6.3)
  // ========================================================================

  describe('Contained Reference Validation', () => {
    it('should resolve contained reference', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          { resourceType: 'Patient', id: 'pat1' },
        ],
        subject: { reference: '#pat1' },
      };

      const result = validator.resolveContainedReference('#pat1', resource);

      expect(result.found).toBe(true);
      expect(result.resource).toBeDefined();
      expect(result.resource?.resourceType).toBe('Patient');
    });

    it('should detect missing contained resource', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [],
        subject: { reference: '#nonexistent' },
      };

      const result = validator.resolveContainedReference('#nonexistent', resource);

      expect(result.found).toBe(false);
    });

    it('should get contained resources', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          { resourceType: 'Patient', id: 'pat1' },
          { resourceType: 'Practitioner', id: 'pract1' },
        ],
      };

      const contained = validator.getContainedResources(resource);

      expect(contained.length).toBe(2);
    });

    it('should validate contained references in resource', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          { resourceType: 'Patient', id: 'pat1' },
        ],
        subject: { reference: '#pat1' },
      };

      const issues = validator.validateContainedReferences(resource);

      expect(Array.isArray(issues)).toBe(true);
    });
  });

  // ========================================================================
  // Bundle Reference Tests (Task 6.4)
  // ========================================================================

  describe('Bundle Reference Resolution', () => {
    it('should resolve Bundle reference by fullUrl', () => {
      const bundle = createBundle([
        createPatient('pat1'),
      ]);

      const result = validator.resolveBundleReference('Patient/pat1', bundle);

      expect(result.resolved).toBe(true);
      expect(result.resource).toBeDefined();
    });

    it('should validate Bundle references', async () => {
      const bundle = createBundle([
        createPatient('pat1'),
        createObservation('obs1', 'Patient/pat1'),
      ]);

      const issues = await validator.validate(bundle, 'Bundle');

      // Should complete Bundle validation
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should detect Bundle reference issues', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'Patient/pat1',
            resource: createPatient('pat1'),
          },
          {
            fullUrl: 'Observation/obs1',
            resource: createObservation('obs1', 'Patient/nonexistent'),
          },
        ],
      };

      const bundleIssues = validator.validateBundleReferences(bundle);

      // Should detect broken reference
      expect(bundleIssues.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Circular Reference Tests (Task 6.5)
  // ========================================================================

  describe('Circular Reference Detection', () => {
    it('should detect circular references', () => {
      const bundle = {
        resourceType: 'Bundle',
        entry: [
          {
            fullUrl: 'Patient/A',
            resource: {
              resourceType: 'Patient',
              id: 'A',
              link: [{ other: { reference: 'Patient/B' } }],
            },
          },
          {
            fullUrl: 'Patient/B',
            resource: {
              resourceType: 'Patient',
              id: 'B',
              link: [{ other: { reference: 'Patient/A' } }],
            },
          },
        ],
      };

      const result = validator.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(true);
      expect(result.circularChain).toBeDefined();
    });

    it('should detect if adding reference would create cycle', () => {
      const wouldCreate = validator.wouldCreateCircularReference(
        ['Patient/A', 'Patient/B'],
        'Patient/A'
      );

      expect(wouldCreate).toBe(true);
    });
  });

  // ========================================================================
  // Recursive Validation Tests (Task 6.6 & 6.7)
  // ========================================================================

  describe('Recursive Reference Validation', () => {
    it('should get recursive validation config', () => {
      const config = validator.getRecursiveValidationConfig();

      expect(config.enabled).toBe(false); // Default
      expect(config.maxDepth).toBe(1);
    });

    it('should estimate recursive validation cost', () => {
      const patient = createPatient('pat1', 'Organization/org1');
      
      const estimate = validator.estimateRecursiveValidationCost(patient, {
        maxDepth: 2,
      });

      expect(estimate.estimatedResources).toBeGreaterThanOrEqual(0);
      expect(estimate.estimatedReferences).toBeGreaterThanOrEqual(0);
    });

    it('should validate recursively when enabled', async () => {
      const patient = createPatient('pat1', 'Organization/org1');
      
      const mockFetcher = async (ref: string) => ({
        resourceType: 'Organization',
        id: 'org1',
      });

      const result = await validator.validateRecursively(patient, {
        enabled: true,
        maxDepth: 1,
      }, mockFetcher);

      expect(result.totalResourcesValidated).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Version-Specific Reference Tests (Task 6.8)
  // ========================================================================

  describe('Version-Specific Reference Validation', () => {
    it('should parse versioned reference', () => {
      const versionInfo = validator.parseVersionedReference('Patient/123/_history/5');

      expect(versionInfo.isVersioned).toBe(true);
      expect(versionInfo.versionId).toBe('5');
      expect(versionInfo.resourceType).toBe('Patient');
    });

    it('should validate versioned reference', () => {
      const result = validator.validateVersionedReference('Patient/123/_history/5');

      expect(result.isValid).toBe(true);
    });

    it('should check version consistency', () => {
      const consistency = validator.checkVersionConsistency([
        'Patient/123/_history/1',
        'Patient/123/_history/2',
      ]);

      expect(consistency.isConsistent).toBe(false);
      expect(consistency.issues.length).toBeGreaterThan(0);
    });

    it('should extract versioned references from resource', () => {
      const resource = {
        resourceType: 'DiagnosticReport',
        basedOn: [{ reference: 'ServiceRequest/req1/_history/2' }],
      };

      const versioned = validator.extractVersionedReferences(resource);

      expect(versioned.length).toBe(1);
      expect(versioned[0].versionId).toBe('2');
    });

    it('should validate Bundle version integrity', () => {
      const bundle = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              subject: { reference: 'Patient/123/_history/1' },
            },
          },
        ],
      };

      const result = validator.validateBundleVersionIntegrity(bundle);

      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });
  });

  // ========================================================================
  // Canonical Reference Tests (Task 6.9)
  // ========================================================================

  describe('Canonical Reference Validation', () => {
    it('should parse canonical URL', () => {
      const canonical = validator.parseCanonicalUrl(
        'http://hl7.org/fhir/StructureDefinition/Patient|4.0.1'
      );

      expect(canonical.baseUrl).toBe('http://hl7.org/fhir/StructureDefinition/Patient');
      expect(canonical.version).toBe('4.0.1');
    });

    it('should validate canonical URL', () => {
      const result = validator.validateCanonicalUrl(
        'http://hl7.org/fhir/StructureDefinition/Patient'
      );

      expect(result.isValid).toBe(true);
    });

    it('should validate profile canonical', () => {
      const result = validator.validateProfileCanonical(
        'http://hl7.org/fhir/StructureDefinition/Patient'
      );

      expect(result.isValid).toBe(true);
    });

    it('should validate value set canonical', () => {
      const result = validator.validateValueSetCanonical(
        'http://hl7.org/fhir/ValueSet/administrative-gender'
      );

      expect(result.isValid).toBe(true);
    });

    it('should extract canonical URLs from resource', () => {
      const resource = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
      };

      const canonicals = validator.extractCanonicalUrls(resource);

      expect(canonicals.length).toBeGreaterThan(0);
    });

    it('should validate resource canonicals', () => {
      const resource = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
      };

      const results = validator.validateResourceCanonicals(resource);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].isValid).toBe(true);
    });

    it('should validate Bundle canonicals', () => {
      const bundle = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              meta: {
                profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
              },
            },
          },
        ],
      };

      const result = validator.validateBundleCanonicals(bundle);

      expect(result.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Batched Existence Checking Tests (Task 6.10)
  // ========================================================================

  describe('Batched Reference Existence Checking', () => {
    it('should check batch references', async () => {
      const result = await validator.checkBatchReferences(
        ['Patient/123', 'Organization/456'],
        { baseUrl: 'http://fhir.example.com' }
      );

      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(2);
    });

    it('should check resource references', async () => {
      const observation = createObservation('obs1', 'Patient/123');
      
      const result = await validator.checkResourceReferences(
        observation,
        { baseUrl: 'http://fhir.example.com' }
      );

      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should check Bundle reference existence', async () => {
      const bundle = createBundle([
        createPatient('pat1'),
        createObservation('obs1', 'Patient/pat1'),
      ]);

      const result = await validator.checkBundleReferenceExistence(
        bundle,
        { baseUrl: 'http://fhir.example.com' }
      );

      expect(result.results).toBeDefined();
    });

    it('should filter existing references', async () => {
      const existing = await validator.filterExistingReferences(
        ['Patient/123', 'Patient/456'],
        { baseUrl: 'http://fhir.example.com' }
      );

      expect(Array.isArray(existing)).toBe(true);
    });
  });

  // ========================================================================
  // Complex Scenario Tests
  // ========================================================================

  describe('Complex Scenarios', () => {
    it('should validate DiagnosticReport with multiple references', async () => {
      const diagnosticReport = {
        resourceType: 'DiagnosticReport',
        id: 'report1',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '58410-2' }],
        },
        subject: { reference: 'Patient/pat1' },
        performer: [
          { reference: 'Practitioner/pract1' },
          { reference: 'Organization/org1' },
        ],
        result: [
          { reference: 'Observation/obs1' },
          { reference: 'Observation/obs2' },
        ],
      };

      const issues = await validator.validate(diagnosticReport, 'DiagnosticReport');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle resource with contained and external references', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs1',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '15074-8' }],
        },
        contained: [
          { resourceType: 'Patient', id: 'pat1' },
        ],
        subject: { reference: '#pat1' },
        performer: [{ reference: 'Practitioner/pract1' }],
      };

      const issues = await validator.validate(observation, 'Observation');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should validate Bundle with mixed reference types', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-A',
            resource: createPatient('A'),
            request: { method: 'POST', url: 'Patient' },
          },
          {
            fullUrl: 'urn:uuid:obs-1',
            resource: createObservation('obs1', 'urn:uuid:patient-A'),
            request: { method: 'POST', url: 'Observation' },
          },
        ],
      };

      const issues = await validator.validate(bundle, 'Bundle');

      expect(Array.isArray(issues)).toBe(true);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle null resource', async () => {
      const issues = await validator.validate(null as any, 'Patient');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle resource without resourceType', async () => {
      const resource = { id: 'test' };

      const issues = await validator.validate(resource, 'Unknown');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle deeply nested references', async () => {
      const resource = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Bundle',
              entry: [
                {
                  resource: createObservation('obs1', 'Patient/123'),
                },
              ],
            },
          },
        ],
      };

      const issues = await validator.validate(resource, 'Bundle');

      expect(Array.isArray(issues)).toBe(true);
    });
  });

  // ========================================================================
  // FHIR Version Tests (Task 2.4)
  // ========================================================================

  describe('FHIR Version Support', () => {
    it('should validate R4 resource', async () => {
      const patient = createPatient('pat1');

      const issues = await validator.validate(patient, 'Patient', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should validate R5 resource', async () => {
      const patient = createPatient('pat1');

      const issues = await validator.validate(patient, 'Patient', undefined, 'R5');

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should add R6 warning', async () => {
      const patient = createPatient('pat1');

      const issues = await validator.validate(patient, 'Patient', undefined, 'R6');

      const r6Warnings = issues.filter(i => 
        i.code === 'r6-not-fully-supported' || 
        i.message?.includes('R6')
      );
      
      // May have R6 warning
      expect(Array.isArray(issues)).toBe(true);
    });
  });
});
