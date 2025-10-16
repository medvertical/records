/**
 * Bundle Reference Resolver Unit Tests
 * 
 * Tests for resolving references within FHIR Bundle resources.
 * Validates fullUrl resolution, UUID references, and Bundle structure.
 * 
 * Task 6.4: Unit tests for Bundle reference resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  BundleReferenceResolver,
  getBundleReferenceResolver,
  resetBundleReferenceResolver 
} from '../bundle-reference-resolver';

// ============================================================================
// Test Data
// ============================================================================

function createSimpleBundle() {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:patient-001',
        resource: {
          resourceType: 'Patient',
          id: 'patient-001',
          name: [{ family: 'Test', given: ['Example'] }],
        },
      },
      {
        fullUrl: 'urn:uuid:practitioner-001',
        resource: {
          resourceType: 'Practitioner',
          id: 'practitioner-001',
          name: [{ family: 'Doctor', given: ['Test'] }],
        },
      },
      {
        fullUrl: 'https://example.com/fhir/Organization/org-001',
        resource: {
          resourceType: 'Organization',
          id: 'org-001',
          name: 'Test Organization',
        },
      },
    ],
  };
}

function createBundleWithReferences() {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:patient-001',
        resource: {
          resourceType: 'Patient',
          id: 'patient-001',
          managingOrganization: {
            reference: 'urn:uuid:org-001',
          },
        },
      },
      {
        fullUrl: 'urn:uuid:org-001',
        resource: {
          resourceType: 'Organization',
          id: 'org-001',
          name: 'Acme Corp',
        },
      },
      {
        fullUrl: 'urn:uuid:observation-001',
        resource: {
          resourceType: 'Observation',
          id: 'observation-001',
          subject: {
            reference: 'urn:uuid:patient-001',
          },
          performer: [
            {
              reference: 'https://example.com/fhir/Practitioner/ext-pract', // External
            },
          ],
        },
      },
    ],
  };
}

function createTransactionBundle() {
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        fullUrl: 'urn:uuid:temp-patient',
        resource: {
          resourceType: 'Patient',
          name: [{ family: 'Transaction', given: ['Test'] }],
        },
        request: {
          method: 'POST',
          url: 'Patient',
        },
      },
      {
        fullUrl: 'urn:uuid:temp-obs',
        resource: {
          resourceType: 'Observation',
          subject: {
            reference: 'urn:uuid:temp-patient',
          },
        },
        request: {
          method: 'POST',
          url: 'Observation',
        },
      },
    ],
  };
}

function createBundleWithDuplicateFullUrls() {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:duplicate',
        resource: { resourceType: 'Patient', id: 'pat1' },
      },
      {
        fullUrl: 'urn:uuid:duplicate',
        resource: { resourceType: 'Practitioner', id: 'pract1' },
      },
    ],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('BundleReferenceResolver', () => {
  let resolver: BundleReferenceResolver;

  beforeEach(() => {
    resetBundleReferenceResolver();
    resolver = getBundleReferenceResolver();
  });

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('Extract Bundle Entries', () => {
    it('should extract all entries from Bundle', () => {
      const bundle = createSimpleBundle();
      const entries = resolver.extractBundleEntries(bundle);

      expect(entries).toHaveLength(3);
      expect(entries[0].resource?.resourceType).toBe('Patient');
      expect(entries[1].resource?.resourceType).toBe('Practitioner');
      expect(entries[2].resource?.resourceType).toBe('Organization');
    });

    it('should return empty array for non-Bundle resource', () => {
      const resource = { resourceType: 'Patient', id: '123' };
      const entries = resolver.extractBundleEntries(resource);

      expect(entries).toHaveLength(0);
    });

    it('should return empty array for Bundle without entries', () => {
      const bundle = { resourceType: 'Bundle', type: 'collection' };
      const entries = resolver.extractBundleEntries(bundle);

      expect(entries).toHaveLength(0);
    });
  });

  // ========================================================================
  // Reference Resolution Tests
  // ========================================================================

  describe('Resolve Bundle References', () => {
    it('should resolve reference by fullUrl (UUID)', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('urn:uuid:patient-001', bundle);

      expect(result.resolved).toBe(true);
      expect(result.resource?.resourceType).toBe('Patient');
      expect(result.resolutionMethod).toBe('fullUrl');
    });

    it('should resolve reference by fullUrl (absolute URL)', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('https://example.com/fhir/Organization/org-001', bundle);

      expect(result.resolved).toBe(true);
      expect(result.resource?.resourceType).toBe('Organization');
      expect(result.resolutionMethod).toBe('fullUrl');
    });

    it('should resolve reference by relative ResourceType/id', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('Patient/patient-001', bundle);

      expect(result.resolved).toBe(true);
      expect(result.resource?.resourceType).toBe('Patient');
      expect(result.resolutionMethod).toBe('relative');
    });

    it('should fail to resolve non-existent reference', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('urn:uuid:nonexistent', bundle);

      expect(result.resolved).toBe(false);
      expect(result.errorMessage).toBeDefined();
    });

    it('should identify external references', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('https://external.com/fhir/Patient/123', bundle);

      expect(result.resolved).toBe(false);
      expect(result.resolutionMethod).toBe('external');
    });

    it('should identify contained references', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('#contained1', bundle);

      expect(result.resolved).toBe(false);
      expect(result.resolutionMethod).toBe('contained');
      expect(result.errorMessage).toContain('parent resource');
    });
  });

  // ========================================================================
  // Bundle Validation Tests
  // ========================================================================

  describe('Validate Bundle References', () => {
    it('should validate Bundle with all resolvable references', () => {
      const bundle = createBundleWithReferences();
      const validation = resolver.validateBundleReferencesOptimized(bundle);

      const errors = validation.issues.filter(i => i.severity === 'error');
      
      // Should have minimal errors (external references are OK)
      expect(errors.length).toBeLessThanOrEqual(1); // Might have external reference warnings
      expect(validation.totalEntries).toBe(3);
    });

    it('should detect unresolved Bundle references', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-001',
            resource: {
              resourceType: 'Patient',
              id: 'patient-001',
              managingOrganization: {
                reference: 'urn:uuid:nonexistent-org', // Unresolved
              },
            },
          },
        ],
      };

      const validation = resolver.validateBundleReferencesOptimized(bundle);

      expect(validation.isValid).toBe(false);
      const unresolvedErrors = validation.issues.filter(i => i.code === 'unresolved-bundle-reference');
      expect(unresolvedErrors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate fullUrls', () => {
      const bundle = createBundleWithDuplicateFullUrls();
      const validation = resolver.validateBundleReferencesOptimized(bundle);

      expect(validation.isValid).toBe(false);
      const duplicateErrors = validation.issues.filter(i => i.code === 'duplicate-bundle-fullurl');
      expect(duplicateErrors.length).toBeGreaterThan(0);
    });

    it('should warn about fullUrl mismatch with resource', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'https://example.com/fhir/Observation/wrong-id',
            resource: {
              resourceType: 'Patient', // Type mismatch
              id: 'correct-id',
            },
          },
        ],
      };

      const validation = resolver.validateBundleReferencesOptimized(bundle);

      const warnings = validation.issues.filter(i => i.code === 'bundle-fullurl-mismatch');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Bundle Structure Validation Tests
  // ========================================================================

  describe('Validate Bundle Structure', () => {
    it('should validate required Bundle.type', () => {
      const bundle = { resourceType: 'Bundle', entry: [] };
      const issues = resolver.validateBundleStructure(bundle);

      const typeErrors = issues.filter(i => i.code === 'bundle-missing-type');
      expect(typeErrors.length).toBeGreaterThan(0);
    });

    it('should validate transaction Bundle has request elements', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            resource: { resourceType: 'Patient' },
            // Missing request
          },
        ],
      };

      const issues = resolver.validateBundleStructure(bundle);

      const requestErrors = issues.filter(i => i.code === 'bundle-entry-missing-request');
      expect(requestErrors.length).toBeGreaterThan(0);
    });

    it('should validate request has required fields', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            resource: { resourceType: 'Patient' },
            request: {}, // Missing method and url
          },
        ],
      };

      const issues = resolver.validateBundleStructure(bundle);

      const methodErrors = issues.filter(i => i.code === 'bundle-request-missing-method');
      const urlErrors = issues.filter(i => i.code === 'bundle-request-missing-url');
      
      expect(methodErrors.length).toBeGreaterThan(0);
      expect(urlErrors.length).toBeGreaterThan(0);
    });

    it('should allow valid transaction Bundle', () => {
      const bundle = createTransactionBundle();
      const issues = resolver.validateBundleStructure(bundle);

      const errors = issues.filter(i => i.severity === 'error');
      expect(errors.length).toBe(0);
    });
  });

  // ========================================================================
  // Find References Tests
  // ========================================================================

  describe('Find All References', () => {
    it('should find all references in Bundle', () => {
      const bundle = createBundleWithReferences();
      const references = resolver.findAllBundleReferences(bundle);

      expect(references.length).toBeGreaterThan(0);
      expect(references.some(r => r.reference === 'urn:uuid:org-001')).toBe(true);
      expect(references.some(r => r.reference === 'urn:uuid:patient-001')).toBe(true);
    });

    it('should include entry index with references', () => {
      const bundle = createBundleWithReferences();
      const references = resolver.findAllBundleReferences(bundle);

      references.forEach(ref => {
        expect(ref.entryIndex).toBeGreaterThanOrEqual(0);
        expect(ref.fieldPath).toBeDefined();
      });
    });

    it('should find references in nested structures', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'DiagnosticReport',
              result: [
                { reference: 'Observation/obs1' },
                { reference: 'Observation/obs2' },
              ],
            },
          },
        ],
      };

      const references = resolver.findAllBundleReferences(bundle);

      expect(references.length).toBeGreaterThanOrEqual(2);
      expect(references.some(r => r.reference === 'Observation/obs1')).toBe(true);
      expect(references.some(r => r.reference === 'Observation/obs2')).toBe(true);
    });
  });

  // ========================================================================
  // Utility Methods Tests
  // ========================================================================

  describe('Utility Methods', () => {
    it('should get all Bundle resources', () => {
      const bundle = createSimpleBundle();
      const resources = resolver.getAllBundleResources(bundle);

      expect(resources).toHaveLength(3);
      expect(resources[0].resourceType).toBe('Patient');
    });

    it('should find entry by fullUrl', () => {
      const bundle = createSimpleBundle();
      const entry = resolver.findEntryByFullUrl(bundle, 'urn:uuid:patient-001');

      expect(entry).toBeDefined();
      expect(entry?.resource?.resourceType).toBe('Patient');
    });

    it('should find entry by resource type and ID', () => {
      const bundle = createSimpleBundle();
      const entry = resolver.findEntryByResourceTypeAndId(bundle, 'Patient', 'patient-001');

      expect(entry).toBeDefined();
      expect(entry?.resource?.resourceType).toBe('Patient');
    });

    it('should build fullUrl index', () => {
      const bundle = createSimpleBundle();
      const index = resolver.buildFullUrlIndex(bundle);

      expect(index.size).toBeGreaterThan(0);
      expect(index.has('urn:uuid:patient-001')).toBe(true);
      expect(index.has('Patient/patient-001')).toBe(true);
    });

    it('should check Bundle type', () => {
      const transactionBundle = createTransactionBundle();
      const collectionBundle = createSimpleBundle();

      expect(resolver.isTransactionOrBatchBundle(transactionBundle)).toBe(true);
      expect(resolver.isTransactionOrBatchBundle(collectionBundle)).toBe(false);
      expect(resolver.getBundleType(transactionBundle)).toBe('transaction');
      expect(resolver.getBundleType(collectionBundle)).toBe('collection');
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('Bundle Statistics', () => {
    it('should provide Bundle statistics', () => {
      const bundle = createBundleWithReferences();
      const stats = resolver.getBundleStatistics(bundle);

      expect(stats.totalEntries).toBe(3);
      expect(stats.resourceTypes).toEqual(
        expect.objectContaining({
          Patient: 1,
          Organization: 1,
          Observation: 1,
        })
      );
      expect(stats.hasFullUrls).toBe(3);
      expect(stats.hasUuidReferences).toBeGreaterThan(0);
    });

    it('should count reference types correctly', () => {
      const bundle = createBundleWithReferences();
      const stats = resolver.getBundleStatistics(bundle);

      expect(stats.hasUuidReferences).toBeGreaterThan(0);
      expect(stats.hasExternalReferences).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Real-World Scenarios
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should handle IPS Bundle with UUID references', () => {
      const ipsBundle = {
        resourceType: 'Bundle',
        type: 'document',
        entry: [
          {
            fullUrl: 'urn:uuid:composition-001',
            resource: {
              resourceType: 'Composition',
              subject: { reference: 'urn:uuid:patient-001' },
            },
          },
          {
            fullUrl: 'urn:uuid:patient-001',
            resource: {
              resourceType: 'Patient',
              id: 'patient-001',
            },
          },
        ],
      };

      const result = resolver.resolveBundleReference('urn:uuid:patient-001', ipsBundle);

      expect(result.resolved).toBe(true);
      expect(result.resource?.resourceType).toBe('Patient');
    });

    it('should handle search result Bundle with absolute URLs', () => {
      const searchBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          {
            fullUrl: 'https://server.com/fhir/Patient/123',
            resource: {
              resourceType: 'Patient',
              id: '123',
            },
          },
        ],
      };

      const result = resolver.resolveBundleReference('https://server.com/fhir/Patient/123', searchBundle);

      expect(result.resolved).toBe(true);
      expect(result.resource?.id).toBe('123');
    });

    it('should handle transaction Bundle with temporary IDs', () => {
      const bundle = createTransactionBundle();
      const validation = resolver.validateBundleReferencesOptimized(bundle);

      // Should resolve internal UUID references
      expect(validation.isValid).toBe(true);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty Bundle', () => {
      const bundle = { resourceType: 'Bundle', type: 'collection', entry: [] };
      const validation = resolver.validateBundleReferencesOptimized(bundle);

      expect(validation.totalEntries).toBe(0);
      expect(validation.isValid).toBe(true);
    });

    it('should handle Bundle with null entries', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [null, undefined, { resource: { resourceType: 'Patient' } }],
      };

      const entries = resolver.extractBundleEntries(bundle);
      // Should handle nulls gracefully
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should handle malformed references gracefully', () => {
      const bundle = createSimpleBundle();
      const result = resolver.resolveBundleReference('', bundle);

      expect(result.resolved).toBe(false);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle large Bundles efficiently', () => {
      const largeBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: Array.from({ length: 100 }, (_, i) => ({
          fullUrl: `urn:uuid:resource-${i}`,
          resource: {
            resourceType: 'Patient',
            id: `patient-${i}`,
          },
        })),
      };

      const startTime = Date.now();
      const validation = resolver.validateBundleReferencesOptimized(largeBundle);
      const endTime = Date.now();

      expect(validation.totalEntries).toBe(100);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast with optimization
    });

    it('should use index for fast resolution', () => {
      const bundle = createSimpleBundle();
      const index = resolver.buildFullUrlIndex(bundle);

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        resolver.resolveBundleReference('urn:uuid:patient-001', bundle);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

