/**
 * Provenance Validator Tests
 * Task 8.6: Test Provenance resource linkage validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProvenanceValidator } from '../provenance-validator';

describe('ProvenanceValidator', () => {
  let validator: ProvenanceValidator;

  beforeEach(() => {
    validator = new ProvenanceValidator();
  });

  // ========================================================================
  // Task 8.6: Target Reference Validation
  // ========================================================================

  describe('Target Reference Validation', () => {
    it('should accept valid Provenance with target references', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(true);
      expect(result.targetCount).toBe(1);
      expect(result.agentCount).toBe(1);
      expect(result.issues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should accept multiple target references', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
          {
            reference: 'Observation/obs-456',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(true);
      expect(result.targetCount).toBe(2);
    });

    it('should reject Provenance without target', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const targetIssues = result.issues.filter(i => i.code === 'provenance-missing-target');
      expect(targetIssues.length).toBe(1);
      expect(targetIssues[0].severity).toBe('error');
    });

    it('should reject non-array target', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: {
          reference: 'Patient/patient-123',
        },
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const arrayIssues = result.issues.filter(i => i.code === 'provenance-target-not-array');
      expect(arrayIssues.length).toBe(1);
    });

    it('should reject empty target array', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const emptyIssues = result.issues.filter(i => i.code === 'provenance-empty-target');
      expect(emptyIssues.length).toBe(1);
    });

    it('should reject invalid target reference object', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: ['invalid'],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const invalidIssues = result.issues.filter(i => i.code === 'provenance-invalid-target');
      expect(invalidIssues.length).toBe(1);
    });

    it('should reject target without reference field', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            display: 'Some Resource',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const missingRefIssues = result.issues.filter(i => i.code === 'provenance-target-missing-reference');
      expect(missingRefIssues.length).toBe(1);
    });
  });

  // ========================================================================
  // Agent Validation
  // ========================================================================

  describe('Agent Validation', () => {
    it('should accept valid agents', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.agentCount).toBe(1);
      const agentIssues = result.issues.filter(i => i.path?.startsWith('agent') && i.severity === 'error');
      expect(agentIssues.length).toBe(0);
    });

    it('should reject Provenance without agent', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const agentIssues = result.issues.filter(i => i.code === 'provenance-missing-agent');
      expect(agentIssues.length).toBe(1);
    });

    it('should reject non-array agent', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: {
          who: {
            reference: 'Practitioner/prac-1',
          },
        },
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const arrayIssues = result.issues.filter(i => i.code === 'provenance-agent-not-array');
      expect(arrayIssues.length).toBe(1);
    });

    it('should reject empty agent array', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const emptyIssues = result.issues.filter(i => i.code === 'provenance-empty-agent');
      expect(emptyIssues.length).toBe(1);
    });

    it('should reject agent without who or onBehalfOf', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                  code: 'author',
                },
              ],
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const whoIssues = result.issues.filter(i => i.code === 'provenance-agent-missing-who');
      expect(whoIssues.length).toBe(1);
    });

    it('should accept agent with onBehalfOf instead of who', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            onBehalfOf: {
              reference: 'Organization/org-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      const whoIssues = result.issues.filter(i => i.code === 'provenance-agent-missing-who');
      expect(whoIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Entity Validation
  // ========================================================================

  describe('Entity Validation', () => {
    it('should accept Provenance without entities', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.entityCount).toBe(0);
      const entityIssues = result.issues.filter(i => i.path?.startsWith('entity'));
      expect(entityIssues.length).toBe(0);
    });

    it('should accept valid entities', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        entity: [
          {
            role: 'source',
            what: {
              reference: 'DocumentReference/doc-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.entityCount).toBe(1);
      const entityIssues = result.issues.filter(i => i.path?.startsWith('entity') && i.severity === 'error');
      expect(entityIssues.length).toBe(0);
    });

    it('should reject non-array entity', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        entity: {
          role: 'source',
        },
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const arrayIssues = result.issues.filter(i => i.code === 'provenance-entity-not-array');
      expect(arrayIssues.length).toBe(1);
    });

    it('should reject entity without role', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        entity: [
          {
            what: {
              reference: 'DocumentReference/doc-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const roleIssues = result.issues.filter(i => i.code === 'provenance-entity-missing-role');
      expect(roleIssues.length).toBe(1);
    });

    it('should reject entity without what', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        entity: [
          {
            role: 'source',
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const whatIssues = result.issues.filter(i => i.code === 'provenance-entity-missing-what');
      expect(whatIssues.length).toBe(1);
    });
  });

  // ========================================================================
  // Recorded Timestamp Validation
  // ========================================================================

  describe('Recorded Timestamp Validation', () => {
    it('should accept valid recorded timestamp', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      const recordedIssues = result.issues.filter(i => i.path === 'recorded' && i.severity === 'error');
      expect(recordedIssues.length).toBe(0);
    });

    it('should reject Provenance without recorded', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const recordedIssues = result.issues.filter(i => i.code === 'provenance-missing-recorded');
      expect(recordedIssues.length).toBe(1);
    });

    it('should reject non-string recorded', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: 1234567890,
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const typeIssues = result.issues.filter(i => i.code === 'provenance-invalid-recorded-type');
      expect(typeIssues.length).toBe(1);
    });
  });

  // ========================================================================
  // Wrong Resource Type
  // ========================================================================

  describe('Resource Type Validation', () => {
    it('should reject non-Provenance resource', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.isValid).toBe(false);
      const typeIssues = result.issues.filter(i => i.code === 'invalid-resource-type');
      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });
  });

  // ========================================================================
  // Signature Detection
  // ========================================================================

  describe('Signature Detection', () => {
    it('should detect signature presence', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [
              {
                system: 'urn:iso-astm:E1762-95:2013',
                code: '1.2.840.10065.1.12.1.1',
              },
            ],
            when: '2024-01-01T12:00:00Z',
            who: {
              reference: 'Practitioner/prac-1',
            },
            data: 'base64encodeddata',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.hasSignature).toBe(true);
    });

    it('should not detect signature when absent', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          {
            reference: 'Patient/patient-123',
          },
        ],
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.hasSignature).toBe(false);
    });
  });

  // ========================================================================
  // Complete Provenance Resource
  // ========================================================================

  describe('Complete Provenance Resource', () => {
    it('should validate complete Provenance resource', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T12:00:00Z',
        },
        target: [
          {
            reference: 'Patient/patient-123',
          },
          {
            reference: 'Observation/obs-456',
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
        agent: [
          {
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                  code: 'author',
                },
              ],
            },
            who: {
              reference: 'Practitioner/prac-1',
            },
          },
        ],
        entity: [
          {
            role: 'source',
            what: {
              reference: 'DocumentReference/doc-1',
            },
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      expect(result.targetCount).toBe(2);
      expect(result.agentCount).toBe(1);
      expect(result.entityCount).toBe(1);
      expect(result.isValid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error').length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.7: Provenance Chain Traversal
  // ========================================================================

  describe('Provenance Chain Traversal', () => {
    it('should traverse single Provenance without fetcher', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
      };

      const chainResult = await validator.traverseChain(resource);

      expect(chainResult.chain.length).toBe(1);
      expect(chainResult.totalDepth).toBe(0);
      expect(chainResult.hasCircular).toBe(false);
      expect(chainResult.errors.length).toBe(0);
    });

    it('should traverse chain with entity reference to Provenance', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        recorded: '2024-01-01T11:00:00Z',
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);

      expect(chainResult.chain.length).toBe(2);
      expect(chainResult.totalDepth).toBe(1);
      expect(chainResult.hasCircular).toBe(false);
      expect(chainResult.chain[0].provenanceId).toBe('prov-1');
      expect(chainResult.chain[1].provenanceId).toBe('prov-2');
    });

    it('should detect circular references in chain', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-1' }, // Circular!
          },
        ],
        recorded: '2024-01-01T11:00:00Z',
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        if (ref === 'Provenance/prov-1') return prov1;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);

      expect(chainResult.hasCircular).toBe(true);
      expect(chainResult.circularReferences.length).toBeGreaterThan(0);
      expect(chainResult.circularReferences).toContain('Provenance/prov-1');
    });

    it('should respect max depth limit', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-3' },
          },
        ],
        recorded: '2024-01-01T11:00:00Z',
      };

      const prov3 = {
        resourceType: 'Provenance',
        id: 'prov-3',
        target: [{ reference: 'Procedure/proc-789' }],
        agent: [{ who: { reference: 'Practitioner/prac-3' } }],
        recorded: '2024-01-01T10:00:00Z',
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        if (ref === 'Provenance/prov-3') return prov3;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher, 1);

      // Should have prov-1 and prov-2, but prov-3 should be blocked by max depth
      expect(chainResult.totalDepth).toBeLessThanOrEqual(1);
      // With max depth 1, we get prov-1 (depth 0) and prov-2 (depth 1), but prov-3 (depth 2) exceeds limit
      if (chainResult.errors.length > 0) {
        expect(chainResult.errors.some(e => e.includes('Max depth'))).toBe(true);
      }
    });

    it('should extract chain node information correctly', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [
          { reference: 'Patient/patient-123' },
          { reference: 'Observation/obs-456' },
        ],
        agent: [
          {
            who: { reference: 'Practitioner/prac-1' },
            onBehalfOf: { reference: 'Organization/org-1' },
          },
        ],
        entity: [
          {
            role: 'source',
            what: { reference: 'DocumentReference/doc-1' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const chainResult = await validator.traverseChain(resource);

      expect(chainResult.chain.length).toBe(1);
      const node = chainResult.chain[0];
      expect(node.provenanceId).toBe('prov-1');
      expect(node.targets.length).toBe(2);
      expect(node.agents.length).toBe(1);
      expect(node.entities.length).toBe(1);
      expect(node.recorded).toBe('2024-01-01T12:00:00Z');
    });

    it('should handle Provenance without entities', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
      };

      const chainResult = await validator.traverseChain(resource);

      expect(chainResult.chain.length).toBe(1);
      expect(chainResult.chain[0].entities.length).toBe(0);
    });

    it('should follow agent references to Provenance', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [
          {
            who: { reference: 'Provenance/prov-2' }, // Agent references another Provenance
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Organization/org-1' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T11:00:00Z',
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);

      expect(chainResult.chain.length).toBe(2);
      expect(chainResult.chain[0].provenanceId).toBe('prov-1');
      expect(chainResult.chain[1].provenanceId).toBe('prov-2');
    });

    it('should handle fetcher errors gracefully', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const mockFetcher = async (ref: string) => {
        throw new Error('Network error');
      };

      const chainResult = await validator.traverseChain(resource, mockFetcher);

      expect(chainResult.chain.length).toBe(1);
      expect(chainResult.errors.length).toBeGreaterThan(0);
      expect(chainResult.errors.some(e => e.includes('Network error'))).toBe(true);
    });

    it('should reject non-Provenance starting resource', async () => {
      const resource = {
        resourceType: 'Patient',
        id: 'patient-123',
      };

      const chainResult = await validator.traverseChain(resource);

      expect(chainResult.chain.length).toBe(0);
      expect(chainResult.errors.length).toBe(1);
      expect(chainResult.errors[0]).toContain('not a Provenance resource');
    });
  });

  // ========================================================================
  // Task 8.8: Timestamp Consistency Validation
  // ========================================================================

  describe('Timestamp Consistency Validation', () => {
    it('should accept valid recorded timestamp', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
      };

      const result = await validator.validate(resource, null, 'R4');

      const timestampIssues = result.issues.filter(i => 
        i.path === 'recorded' && i.code !== 'provenance-missing-recorded'
      );
      const errorIssues = timestampIssues.filter(i => i.severity === 'error');

      expect(errorIssues.length).toBe(0);
    });

    it('should warn about future recorded timestamp', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: futureDate.toISOString(),
      };

      const result = await validator.validate(resource, null, 'R4');

      const futureIssues = result.issues.filter(i => i.code === 'provenance-recorded-future');

      expect(futureIssues.length).toBe(1);
      expect(futureIssues[0].severity).toBe('warning');
      expect(futureIssues[0].details).toHaveProperty('futureBySeconds');
    });

    it('should warn when recorded is before occurredDateTime', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        occurredDateTime: '2024-01-02T12:00:00Z', // After recorded
      };

      const result = await validator.validate(resource, null, 'R4');

      const beforeIssues = result.issues.filter(i => i.code === 'provenance-recorded-before-occurred');

      expect(beforeIssues.length).toBe(1);
      expect(beforeIssues[0].severity).toBe('warning');
      expect(beforeIssues[0].details).toHaveProperty('differenceSeconds');
    });

    it('should accept when recorded is after occurredDateTime', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-02T12:00:00Z',
        occurredDateTime: '2024-01-01T12:00:00Z', // Before recorded (normal)
      };

      const result = await validator.validate(resource, null, 'R4');

      const beforeIssues = result.issues.filter(i => i.code === 'provenance-recorded-before-occurred');

      expect(beforeIssues.length).toBe(0);
    });

    it('should provide info about delayed recording (> 1 day)', async () => {
      const occurred = new Date('2024-01-01T12:00:00Z');
      const recorded = new Date('2024-01-05T12:00:00Z'); // 4 days later

      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: recorded.toISOString(),
        occurredDateTime: occurred.toISOString(),
      };

      const result = await validator.validate(resource, null, 'R4');

      const delayedIssues = result.issues.filter(i => i.code === 'provenance-recorded-delayed');

      expect(delayedIssues.length).toBe(1);
      expect(delayedIssues[0].severity).toBe('info');
      expect(delayedIssues[0].details).toHaveProperty('differenceDays');
    });

    it('should warn when signature timestamp is before recorded', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-02T12:00:00Z',
        signature: [
          {
            type: [
              {
                system: 'urn:iso-astm:E1762-95:2013',
                code: '1.2.840.10065.1.12.1.1',
              },
            ],
            when: '2024-01-01T12:00:00Z', // Before recorded
            who: { reference: 'Practitioner/prac-1' },
            data: 'base64data',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const signatureIssues = result.issues.filter(i => i.code === 'provenance-signature-before-recorded');

      expect(signatureIssues.length).toBe(1);
      expect(signatureIssues[0].severity).toBe('warning');
      expect(signatureIssues[0].details).toHaveProperty('differenceSeconds');
    });

    it('should accept when signature timestamp is after recorded', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [
              {
                system: 'urn:iso-astm:E1762-95:2013',
                code: '1.2.840.10065.1.12.1.1',
              },
            ],
            when: '2024-01-01T13:00:00Z', // After recorded (normal)
            who: { reference: 'Practitioner/prac-1' },
            data: 'base64data',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const signatureIssues = result.issues.filter(i => i.code === 'provenance-signature-before-recorded');

      expect(signatureIssues.length).toBe(0);
    });
  });

  // ========================================================================
  // Task 8.8: Chain Timestamp Consistency
  // ========================================================================

  describe('Chain Timestamp Consistency', () => {
    it('should validate timestamp order in chain', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-02T12:00:00Z', // Later (derived)
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        recorded: '2024-01-01T12:00:00Z', // Earlier (source)
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);
      const timestampIssues = await validator.validateChainTimestampConsistency(chainResult);

      // Should have chronological order (source before derived)
      expect(timestampIssues.length).toBe(0);
    });

    it('should detect reverse chronology in chain', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z', // Earlier
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        recorded: '2024-01-02T12:00:00Z', // Later (reverse!)
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);
      const timestampIssues = await validator.validateChainTimestampConsistency(chainResult);

      expect(timestampIssues.length).toBe(1);
      expect(timestampIssues[0].code).toBe('provenance-chain-reverse-chronology');
      expect(timestampIssues[0].severity).toBe('info');
    });

    it('should skip chain validation for single Provenance', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
      };

      const chainResult = await validator.traverseChain(resource);
      const timestampIssues = await validator.validateChainTimestampConsistency(chainResult);

      expect(timestampIssues.length).toBe(0);
    });

    it('should handle missing timestamps in chain', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'source',
            what: { reference: 'Provenance/prov-2' },
          },
        ],
        recorded: '2024-01-01T12:00:00Z',
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        target: [{ reference: 'Observation/obs-456' }],
        agent: [{ who: { reference: 'Practitioner/prac-2' } }],
        // No recorded timestamp
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-2') return prov2;
        return null;
      };

      const chainResult = await validator.traverseChain(prov1, mockFetcher);
      const timestampIssues = await validator.validateChainTimestampConsistency(chainResult);

      // Should not crash, may not detect issues without timestamps
      expect(timestampIssues).toBeDefined();
    });
  });

  // ========================================================================
  // Task 8.9: Signature Validation
  // ========================================================================

  describe('Signature Validation', () => {
    it('should accept valid signature', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [
              {
                system: 'urn:iso-astm:E1762-95:2013',
                code: '1.2.840.10065.1.12.1.1',
                display: 'Author',
              },
            ],
            when: '2024-01-01T12:00:00Z',
            who: {
              reference: 'Practitioner/prac-1',
            },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZQ==', // Valid base64
            sigFormat: 'application/jose',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const signatureIssues = result.issues.filter(i => 
        i.path?.startsWith('signature') && i.severity === 'error'
      );

      expect(signatureIssues.length).toBe(0);
      expect(result.hasSignature).toBe(true);
    });

    it('should reject non-array signature', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: {
          type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
        },
      };

      const result = await validator.validate(resource, null, 'R4');

      const arrayIssues = result.issues.filter(i => i.code === 'provenance-signature-not-array');

      expect(arrayIssues.length).toBe(1);
      expect(arrayIssues[0].severity).toBe('error');
    });

    it('should reject signature without type', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZQ==',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const typeIssues = result.issues.filter(i => i.code === 'provenance-signature-missing-type');

      expect(typeIssues.length).toBe(1);
      expect(typeIssues[0].severity).toBe('error');
    });

    it('should reject signature with non-array type', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: 'invalid',
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const typeArrayIssues = result.issues.filter(i => i.code === 'provenance-signature-type-not-array');

      expect(typeArrayIssues.length).toBe(1);
      expect(typeArrayIssues[0].severity).toBe('error');
    });

    it('should reject signature with empty type array', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const emptyTypeIssues = result.issues.filter(i => i.code === 'provenance-signature-type-empty');

      expect(emptyTypeIssues.length).toBe(1);
      expect(emptyTypeIssues[0].severity).toBe('error');
    });

    it('should reject signature without when', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            who: { reference: 'Practitioner/prac-1' },
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const whenIssues = result.issues.filter(i => i.code === 'provenance-signature-missing-when');

      expect(whenIssues.length).toBe(1);
      expect(whenIssues[0].severity).toBe('error');
    });

    it('should reject signature without who', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const whoIssues = result.issues.filter(i => i.code === 'provenance-signature-missing-who');

      expect(whoIssues.length).toBe(1);
      expect(whoIssues[0].severity).toBe('error');
    });

    it('should reject signature with invalid who', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: 'invalid', // Should be Reference object
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const invalidWhoIssues = result.issues.filter(i => i.code === 'provenance-signature-invalid-who');

      expect(invalidWhoIssues.length).toBe(1);
      expect(invalidWhoIssues[0].severity).toBe('error');
    });

    it('should reject non-string signature data', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 12345,
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const dataTypeIssues = result.issues.filter(i => i.code === 'provenance-signature-invalid-data-type');

      expect(dataTypeIssues.length).toBe(1);
      expect(dataTypeIssues[0].severity).toBe('error');
    });

    it('should warn about invalid base64 data', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'invalid@#$%base64!',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const base64Issues = result.issues.filter(i => i.code === 'provenance-signature-invalid-base64');

      expect(base64Issues.length).toBe(1);
      expect(base64Issues[0].severity).toBe('warning');
    });

    it('should warn about very short signature data', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'ABC',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const shortDataIssues = result.issues.filter(i => i.code === 'provenance-signature-short-data');

      expect(shortDataIssues.length).toBe(1);
      expect(shortDataIssues[0].severity).toBe('warning');
    });

    it('should validate MIME type format in sigFormat', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZQ==',
            sigFormat: 'application/jose',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const mimeIssues = result.issues.filter(i => i.code === 'provenance-signature-invalid-mime-type');

      expect(mimeIssues.length).toBe(0);
    });

    it('should warn about invalid MIME type format', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZQ==',
            sigFormat: 'not a valid mime type',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const mimeIssues = result.issues.filter(i => i.code === 'provenance-signature-invalid-mime-type');

      expect(mimeIssues.length).toBe(1);
      expect(mimeIssues[0].severity).toBe('warning');
    });

    it('should reject non-string sigFormat', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            sigFormat: 123,
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const sigFormatIssues = result.issues.filter(i => i.code === 'provenance-signature-invalid-sigFormat-type');

      expect(sigFormatIssues.length).toBe(1);
      expect(sigFormatIssues[0].severity).toBe('error');
    });

    it('should accept signature without optional data field', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            // No data field
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const dataIssues = result.issues.filter(i => 
        i.path?.includes('signature') && i.path?.includes('data')
      );

      expect(dataIssues.length).toBe(0);
    });

    it('should accept multiple signatures', async () => {
      const resource = {
        resourceType: 'Provenance',
        id: 'prov-1',
        target: [{ reference: 'Patient/patient-123' }],
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        recorded: '2024-01-01T12:00:00Z',
        signature: [
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.1' }],
            when: '2024-01-01T12:00:00Z',
            who: { reference: 'Practitioner/prac-1' },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZQ==',
          },
          {
            type: [{ system: 'urn:iso-astm:E1762-95:2013', code: '1.2.840.10065.1.12.1.2' }],
            when: '2024-01-01T13:00:00Z',
            who: { reference: 'Practitioner/prac-2' },
            data: 'QW5vdGhlciBzaWduYXR1cmU=',
          },
        ],
      };

      const result = await validator.validate(resource, null, 'R4');

      const errorIssues = result.issues.filter(i => 
        i.path?.startsWith('signature') && i.severity === 'error'
      );

      expect(errorIssues.length).toBe(0);
      expect(result.hasSignature).toBe(true);
    });
  });
});

