/**
 * Circular Reference Detector Unit Tests
 * 
 * Tests for detecting circular references in FHIR resources and Bundles.
 * Validates cycle detection, depth limiting, and graph traversal algorithms.
 * 
 * Task 6.5: Unit tests for circular reference detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  CircularReferenceDetector,
  getCircularReferenceDetector,
  resetCircularReferenceDetector 
} from '../circular-reference-detector';

// ============================================================================
// Test Data
// ============================================================================

function createResourceWithCircularReference() {
  return {
    resourceType: 'Patient',
    id: 'patient1',
    link: [
      {
        other: { reference: 'Patient/patient2' },
        type: 'seealso',
      },
    ],
    // In a real scenario, patient2 would reference patient1, creating a cycle
  };
}

function createBundleWithCircularReferences() {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:patient-A',
        resource: {
          resourceType: 'Patient',
          id: 'patient-A',
          link: [
            { other: { reference: 'urn:uuid:patient-B' }, type: 'seealso' },
          ],
        },
      },
      {
        fullUrl: 'urn:uuid:patient-B',
        resource: {
          resourceType: 'Patient',
          id: 'patient-B',
          link: [
            { other: { reference: 'urn:uuid:patient-A' }, type: 'seealso' }, // Circular!
          ],
        },
      },
    ],
  };
}

function createBundleWithoutCircularReferences() {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      {
        fullUrl: 'urn:uuid:patient-001',
        resource: {
          resourceType: 'Patient',
          id: 'patient-001',
          managingOrganization: { reference: 'urn:uuid:org-001' },
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
          subject: { reference: 'urn:uuid:patient-001' },
        },
      },
    ],
  };
}

function createComplexCircularChain() {
  // A → B → C → A (3-node cycle)
  return {
    resourceType: 'Bundle',
    type: 'collection',
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
          link: [{ other: { reference: 'Patient/C' } }],
        },
      },
      {
        fullUrl: 'Patient/C',
        resource: {
          resourceType: 'Patient',
          id: 'C',
          link: [{ other: { reference: 'Patient/A' } }], // Back to A
        },
      },
    ],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('CircularReferenceDetector', () => {
  let detector: CircularReferenceDetector;

  beforeEach(() => {
    resetCircularReferenceDetector();
    detector = getCircularReferenceDetector(10);
  });

  // ========================================================================
  // Basic Detection Tests
  // ========================================================================

  describe('Basic Circular Detection', () => {
    it('should detect simple circular reference in Bundle', () => {
      const bundle = createBundleWithCircularReferences();
      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(true);
      expect(result.circularChain).toBeDefined();
      expect(result.circularChain!.length).toBeGreaterThan(2);
    });

    it('should not detect circular references when none exist', () => {
      const bundle = createBundleWithoutCircularReferences();
      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(false);
      expect(result.circularChain).toBeUndefined();
      expect(result.totalReferences).toBeGreaterThan(0);
    });

    it('should detect complex circular chain', () => {
      const bundle = createComplexCircularChain();
      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(true);
      expect(result.circularChain).toBeDefined();
      // Should show A → B → C → A cycle
      expect(result.circularChain!.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle resource without circular references', () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient1',
        managingOrganization: { reference: 'Organization/acme' },
      };

      const result = detector.detectCircularReferences(resource);

      expect(result.hasCircularReference).toBe(false);
      expect(result.totalReferences).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Chain Validation Tests
  // ========================================================================

  describe('Reference Chain Validation', () => {
    it('should validate a non-circular chain', () => {
      const chain = ['Patient/A', 'Organization/B', 'Location/C'];
      const result = detector.validateReferenceChain(chain);

      expect(result.isValid).toBe(true);
      expect(result.circularAt).toBeUndefined();
    });

    it('should detect circular chain', () => {
      const chain = ['Patient/A', 'Patient/B', 'Patient/A'];
      const result = detector.validateReferenceChain(chain);

      expect(result.isValid).toBe(false);
      expect(result.circularAt).toBe(2);
      expect(result.circularReference).toBe('Patient/A');
    });

    it('should detect self-reference', () => {
      const chain = ['Patient/A', 'Patient/A'];
      const result = detector.validateReferenceChain(chain);

      expect(result.isValid).toBe(false);
      expect(result.circularAt).toBe(1);
    });
  });

  // ========================================================================
  // Would Create Circular Reference Tests
  // ========================================================================

  describe('Would Create Circular Reference', () => {
    it('should detect that adding would create circular reference', () => {
      const currentPath = ['Patient/A', 'Organization/B', 'Practitioner/C'];
      const wouldCreate = detector.wouldCreateCircularReference(currentPath, 'Patient/A');

      expect(wouldCreate).toBe(true);
    });

    it('should detect that adding would not create circular reference', () => {
      const currentPath = ['Patient/A', 'Organization/B'];
      const wouldCreate = detector.wouldCreateCircularReference(currentPath, 'Practitioner/C');

      expect(wouldCreate).toBe(false);
    });

    it('should handle empty path', () => {
      const wouldCreate = detector.wouldCreateCircularReference([], 'Patient/A');

      expect(wouldCreate).toBe(false);
    });
  });

  // ========================================================================
  // Depth Limit Tests
  // ========================================================================

  describe('Depth Limit', () => {
    it('should respect depth limit', () => {
      const detector = new CircularReferenceDetector(3);
      
      expect(detector.getMaxDepthLimit()).toBe(3);
    });

    it('should allow setting depth limit', () => {
      detector.setMaxDepthLimit(5);
      
      expect(detector.getMaxDepthLimit()).toBe(5);
    });

    it('should check if chain exceeds depth limit', () => {
      detector.setMaxDepthLimit(3);
      
      const shortChain = ['A', 'B', 'C'];
      const longChain = ['A', 'B', 'C', 'D', 'E'];
      
      expect(detector.isDepthLimitExceeded(shortChain)).toBe(false);
      expect(detector.isDepthLimitExceeded(longChain)).toBe(true);
    });
  });

  // ========================================================================
  // Formatting and Statistics Tests
  // ========================================================================

  describe('Formatting and Statistics', () => {
    it('should format circular chain for display', () => {
      const chain = ['Patient/A', 'Patient/B', 'Patient/A'];
      const formatted = detector.formatCircularChain(chain);

      expect(formatted).toBe('Patient/A → Patient/B → Patient/A');
    });

    it('should calculate chain statistics', () => {
      const chains = [
        ['A', 'B', 'C'],
        ['X', 'Y'],
        ['P', 'Q', 'R', 'S'],
      ];

      const stats = detector.getChainStatistics(chains);

      expect(stats.totalChains).toBe(3);
      expect(stats.maxLength).toBe(4);
      expect(stats.minLength).toBe(2);
      expect(stats.averageLength).toBeCloseTo(3, 0);
    });

    it('should handle empty chains in statistics', () => {
      const stats = detector.getChainStatistics([]);

      expect(stats.totalChains).toBe(0);
      expect(stats.averageLength).toBe(0);
      expect(stats.maxLength).toBe(0);
      expect(stats.minLength).toBe(0);
    });

    it('should count circular chains in statistics', () => {
      const chains = [
        ['A', 'B', 'C'], // Not circular
        ['X', 'Y', 'X'], // Circular
      ];

      const stats = detector.getChainStatistics(chains);

      expect(stats.circularChains).toBe(1);
    });
  });

  // ========================================================================
  // Real-World Scenarios
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should handle Patient with self-referencing link', () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient1',
        link: [
          { other: { reference: 'Patient/patient1' }, type: 'seealso' },
        ],
      };

      const result = detector.detectCircularReferences(resource);

      // Self-reference is a circular reference
      expect(result.hasCircularReference).toBe(true);
    });

    it('should handle Provenance chain without cycles', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'Provenance/prov1',
            resource: {
              resourceType: 'Provenance',
              id: 'prov1',
              target: [{ reference: 'Patient/pat1' }],
            },
          },
          {
            fullUrl: 'Patient/pat1',
            resource: {
              resourceType: 'Patient',
              id: 'pat1',
            },
          },
        ],
      };

      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(false);
    });

    it('should handle DiagnosticReport with hasMember cycle', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'Observation/obs1',
            resource: {
              resourceType: 'Observation',
              id: 'obs1',
              hasMember: [{ reference: 'Observation/obs2' }],
            },
          },
          {
            fullUrl: 'Observation/obs2',
            resource: {
              resourceType: 'Observation',
              id: 'obs2',
              hasMember: [{ reference: 'Observation/obs1' }], // Cycle!
            },
          },
        ],
      };

      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(true);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty resource', () => {
      const resource = { resourceType: 'Patient', id: '123' };
      const result = detector.detectCircularReferences(resource);

      expect(result.hasCircularReference).toBe(false);
      expect(result.totalReferences).toBe(0);
    });

    it('should handle resource with contained resources', () => {
      const resource = {
        resourceType: 'Observation',
        contained: [
          {
            resourceType: 'Patient',
            id: 'pat1',
          },
        ],
        subject: { reference: '#pat1' },
      };

      const result = detector.detectCircularReferences(resource);

      expect(result.hasCircularReference).toBe(false);
    });

    it('should handle null and undefined gracefully', () => {
      expect(() => {
        detector.detectCircularReferences(null as any);
      }).not.toThrow();

      expect(() => {
        detector.detectCircularReferences(undefined as any);
      }).not.toThrow();
    });

    it('should handle Bundle with no entries', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [],
      };

      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(false);
      expect(result.totalReferences).toBe(0);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle large Bundle efficiently', () => {
      const largeBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: Array.from({ length: 100 }, (_, i) => ({
          fullUrl: `Patient/${i}`,
          resource: {
            resourceType: 'Patient',
            id: `${i}`,
            managingOrganization: {
              reference: i < 99 ? `Organization/${i}` : 'Organization/0',
            },
          },
        })),
      };

      const startTime = Date.now();
      const result = detector.detectCircularReferences(largeBundle);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in reasonable time
    });

    it('should handle deep reference chains', () => {
      // Create a chain: A → B → C → D → E (no cycle)
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: Array.from({ length: 5 }, (_, i) => ({
          fullUrl: `Patient/${String.fromCharCode(65 + i)}`,
          resource: {
            resourceType: 'Patient',
            id: String.fromCharCode(65 + i),
            link: i < 4 ? [
              { other: { reference: `Patient/${String.fromCharCode(65 + i + 1)}` } }
            ] : [],
          },
        })),
      };

      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(false);
      expect(result.maxDepth).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Multiple Cycles Tests
  // ========================================================================

  describe('Multiple Cycles', () => {
    it('should detect multiple circular references', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          // First cycle: A → B → A
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
          // Second cycle: X → Y → X
          {
            fullUrl: 'Patient/X',
            resource: {
              resourceType: 'Patient',
              id: 'X',
              link: [{ other: { reference: 'Patient/Y' } }],
            },
          },
          {
            fullUrl: 'Patient/Y',
            resource: {
              resourceType: 'Patient',
              id: 'Y',
              link: [{ other: { reference: 'Patient/X' } }],
            },
          },
        ],
      };

      const result = detector.detectCircularReferences(bundle);

      expect(result.hasCircularReference).toBe(true);
      expect(result.referenceChains).toBeDefined();
      expect(result.referenceChains!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================================================
  // Configuration Tests
  // ========================================================================

  describe('Configuration', () => {
    it('should initialize with custom depth limit', () => {
      const customDetector = new CircularReferenceDetector(5);
      
      expect(customDetector.getMaxDepthLimit()).toBe(5);
    });

    it('should use default depth limit when not specified', () => {
      const defaultDetector = new CircularReferenceDetector();
      
      expect(defaultDetector.getMaxDepthLimit()).toBe(10);
    });

    it('should update depth limit', () => {
      detector.setMaxDepthLimit(20);
      
      expect(detector.getMaxDepthLimit()).toBe(20);
    });
  });
});

