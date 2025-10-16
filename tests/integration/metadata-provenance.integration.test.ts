/**
 * Integration Tests: Metadata and Provenance Validation
 * Task 8.13: Integration tests with resources containing provenance chains
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MetadataValidator } from '../../server/services/validation/engine/metadata-validator';
import { ProvenanceValidator } from '../../server/services/validation/utils/provenance-validator';

describe('Metadata and Provenance Integration Tests', () => {
  let metadataValidator: MetadataValidator;
  let provenanceValidator: ProvenanceValidator;

  beforeAll(() => {
    metadataValidator = new MetadataValidator();
    provenanceValidator = new ProvenanceValidator();
  });

  // ========================================================================
  // Complete Provenance Chain Scenarios
  // ========================================================================

  describe('Complete Provenance Chain Validation', () => {
    it('should validate a simple provenance chain', async () => {
      // Original Patient resource
      const patient = {
        resourceType: 'Patient',
        id: 'patient-1',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T10:00:00Z',
        },
        name: [{ given: ['John'], family: 'Doe' }],
      };

      // Provenance for the Patient creation
      const provenance1 = {
        resourceType: 'Provenance',
        id: 'prov-1',
        meta: {
          lastUpdated: '2024-01-01T10:01:00Z',
        },
        target: [{ reference: 'Patient/patient-1' }],
        recorded: '2024-01-01T10:00:00Z',
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-1',
              display: 'Dr. Smith',
            },
          },
        ],
      };

      // Updated Patient resource
      const patientUpdated = {
        ...patient,
        meta: {
          versionId: '2',
          lastUpdated: '2024-01-02T15:00:00Z',
        },
        name: [{ given: ['John', 'Michael'], family: 'Doe' }],
      };

      // Provenance for the Patient update
      const provenance2 = {
        resourceType: 'Provenance',
        id: 'prov-2',
        meta: {
          lastUpdated: '2024-01-02T15:01:00Z',
        },
        target: [{ reference: 'Patient/patient-1' }],
        recorded: '2024-01-02T15:00:00Z',
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-2',
              display: 'Dr. Jones',
            },
          },
        ],
        entity: [
          {
            role: 'revision',
            what: {
              reference: 'Provenance/prov-1',
            },
          },
        ],
      };

      // Validate metadata
      const patientIssues = await metadataValidator.validate(patient, 'Patient', 'R4');
      const patientUpdatedIssues = await metadataValidator.validate(patientUpdated, 'Patient', 'R4');
      const prov1Issues = await provenanceValidator.validate(provenance1, null, 'R4');
      const prov2Issues = await provenanceValidator.validate(provenance2, null, 'R4');

      // Should have no critical errors
      expect(patientIssues.filter(i => i.severity === 'error').length).toBe(0);
      expect(patientUpdatedIssues.filter(i => i.severity === 'error').length).toBe(0);
      expect(prov1Issues.issues.filter(i => i.severity === 'error').length).toBe(0);
      expect(prov2Issues.issues.filter(i => i.severity === 'error').length).toBe(0);

      // Traverse chain
      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-1') return provenance1;
        return null;
      };

      const chainResult = await provenanceValidator.traverseChain(provenance2, mockFetcher);

      expect(chainResult.chain.length).toBe(2);
      expect(chainResult.chain[0].provenanceReference).toBe('Provenance/prov-2');
      expect(chainResult.chain[1].provenanceReference).toBe('Provenance/prov-1');
      expect(chainResult.hasCircular).toBe(false);
    });

    it('should validate provenance chain with signatures', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'patient-signed',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T12:00:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'R',
              display: 'Restricted',
            },
          ],
        },
        name: [{ given: ['Jane'], family: 'Smith' }],
      };

      const provenance = {
        resourceType: 'Provenance',
        id: 'prov-signed',
        meta: {
          lastUpdated: '2024-01-01T12:01:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'R',
              display: 'Restricted',
            },
          ],
        },
        target: [{ reference: 'Patient/patient-signed' }],
        recorded: '2024-01-01T12:00:00Z',
        agent: [
          {
            who: {
              reference: 'Practitioner/prac-sign',
              display: 'Dr. Signer',
            },
          },
        ],
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
              reference: 'Practitioner/prac-sign',
            },
            data: 'VGhpcyBpcyBhIHNpZ25hdHVyZSBmb3IgdGVzdGluZw==',
            sigFormat: 'application/jose',
          },
        ],
      };

      // Validate
      const patientIssues = await metadataValidator.validate(patient, 'Patient', 'R4');
      const provIssues = await provenanceValidator.validate(provenance, null, 'R4');

      // Check security labels are valid
      const securityErrors = patientIssues.filter(
        i => i.path?.includes('security') && i.severity === 'error'
      );
      expect(securityErrors.length).toBe(0);

      // Check signature is valid
      const signatureErrors = provIssues.issues.filter(
        i => i.path?.includes('signature') && i.severity === 'error'
      );
      expect(signatureErrors.length).toBe(0);

      // Check that provenance has signature
      expect(provIssues.hasSignature).toBe(true);
    });

    it('should detect circular reference in provenance chain', async () => {
      const prov1 = {
        resourceType: 'Provenance',
        id: 'prov-circular-1',
        target: [{ reference: 'Patient/patient-1' }],
        recorded: '2024-01-01T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'revision',
            what: { reference: 'Provenance/prov-circular-3' },
          },
        ],
      };

      const prov2 = {
        resourceType: 'Provenance',
        id: 'prov-circular-2',
        target: [{ reference: 'Patient/patient-1' }],
        recorded: '2024-01-01T11:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'revision',
            what: { reference: 'Provenance/prov-circular-1' },
          },
        ],
      };

      const prov3 = {
        resourceType: 'Provenance',
        id: 'prov-circular-3',
        target: [{ reference: 'Patient/patient-1' }],
        recorded: '2024-01-01T12:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
        entity: [
          {
            role: 'revision',
            what: { reference: 'Provenance/prov-circular-2' },
          },
        ],
      };

      const mockFetcher = async (ref: string) => {
        if (ref === 'Provenance/prov-circular-1') return prov1;
        if (ref === 'Provenance/prov-circular-2') return prov2;
        if (ref === 'Provenance/prov-circular-3') return prov3;
        return null;
      };

      const chainResult = await provenanceValidator.traverseChain(prov3, mockFetcher);

      expect(chainResult.hasCircular).toBe(true);
      expect(chainResult.circularReferences.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Metadata Consistency Across Related Resources
  // ========================================================================

  describe('Metadata Consistency Validation', () => {
    it('should validate consistent security labels across patient and provenance', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'patient-secure',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T10:00:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'V',
              display: 'Very Restricted',
            },
          ],
        },
      };

      const provenance = {
        resourceType: 'Provenance',
        id: 'prov-secure',
        meta: {
          lastUpdated: '2024-01-01T10:01:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'V',
              display: 'Very Restricted',
            },
          ],
        },
        target: [{ reference: 'Patient/patient-secure' }],
        recorded: '2024-01-01T10:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
      };

      const patientIssues = await metadataValidator.validate(patient, 'Patient', 'R4');
      const provIssues = await provenanceValidator.validate(provenance, null, 'R4');

      // Both should have valid security labels
      const patientSecurityErrors = patientIssues.filter(
        i => i.code?.includes('security') && i.severity === 'error'
      );
      const provSecurityErrors = provIssues.issues.filter(
        i => i.code?.includes('security') && i.severity === 'error'
      );

      expect(patientSecurityErrors.length).toBe(0);
      expect(provSecurityErrors.length).toBe(0);
    });

    it('should validate timestamp consistency between resource and provenance', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-1',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T14:00:00Z',
        },
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '12345-6' }] },
      };

      const provenance = {
        resourceType: 'Provenance',
        id: 'prov-obs',
        meta: {
          lastUpdated: '2024-01-01T14:01:00Z',
        },
        target: [{ reference: 'Observation/obs-1' }],
        recorded: '2024-01-01T14:00:00Z',
        occurredDateTime: '2024-01-01T14:00:00Z',
        agent: [{ who: { reference: 'Practitioner/prac-1' } }],
      };

      const obsIssues = await metadataValidator.validate(observation, 'Observation', 'R4');
      const provIssues = await provenanceValidator.validate(provenance, null, 'R4');

      // Timestamps should be consistent
      const timestampErrors = provIssues.issues.filter(
        i => i.code?.includes('timestamp') && i.severity === 'error'
      );

      expect(timestampErrors.length).toBe(0);
    });
  });

  // ========================================================================
  // Required Metadata by Resource Type
  // ========================================================================

  describe('Required Metadata Validation Scenarios', () => {
    it('should validate complete medication request with provenance', async () => {
      const medRequest = {
        resourceType: 'MedicationRequest',
        id: 'medreq-1',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T09:00:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'N',
              display: 'Normal',
            },
          ],
        },
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '123456' }],
        },
        subject: { reference: 'Patient/patient-1' },
      };

      const provenance = {
        resourceType: 'Provenance',
        id: 'prov-medreq',
        meta: {
          lastUpdated: '2024-01-01T09:01:00Z',
        },
        target: [{ reference: 'MedicationRequest/medreq-1' }],
        recorded: '2024-01-01T09:00:00Z',
        agent: [
          {
            who: {
              reference: 'Practitioner/prescriber-1',
              display: 'Dr. Prescriber',
            },
          },
        ],
        signature: [
          {
            type: [
              {
                system: 'urn:iso-astm:E1762-95:2013',
                code: '1.2.840.10065.1.12.1.7',
                display: 'Consent Signature',
              },
            ],
            when: '2024-01-01T09:00:00Z',
            who: { reference: 'Practitioner/prescriber-1' },
            data: 'U2lnbmF0dXJlIGRhdGEgZm9yIHByZXNjcmlwdGlvbg==',
          },
        ],
      };

      const medReqIssues = await metadataValidator.validate(medRequest, 'MedicationRequest', 'R4');
      const provIssues = await provenanceValidator.validate(provenance, null, 'R4');

      // Should not have required metadata missing (has versionId, lastUpdated, security)
      const requiredIssues = medReqIssues.filter(i => i.code?.startsWith('required-metadata-missing-'));
      expect(requiredIssues.length).toBe(0);

      // Provenance should be valid with signature
      expect(provIssues.hasSignature).toBe(true);
      expect(provIssues.issues.filter(i => i.severity === 'error').length).toBe(0);
    });

    it('should validate allergy intolerance with complete metadata', async () => {
      const allergy = {
        resourceType: 'AllergyIntolerance',
        id: 'allergy-1',
        meta: {
          versionId: '2',
          lastUpdated: '2024-01-01T16:30:00Z',
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'N',
              display: 'Normal',
            },
          ],
          tag: [
            {
              system: 'http://example.org/tags',
              code: 'allergy-verified',
              display: 'Allergy Verified',
            },
          ],
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
              code: 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
              code: 'confirmed',
            },
          ],
        },
        patient: { reference: 'Patient/patient-1' },
      };

      const provenance = {
        resourceType: 'Provenance',
        id: 'prov-allergy',
        meta: {
          lastUpdated: '2024-01-01T16:31:00Z',
        },
        target: [{ reference: 'AllergyIntolerance/allergy-1' }],
        recorded: '2024-01-01T16:30:00Z',
        agent: [
          {
            who: {
              reference: 'Practitioner/allergist-1',
              display: 'Dr. Allergist',
            },
          },
        ],
      };

      const allergyIssues = await metadataValidator.validate(allergy, 'AllergyIntolerance', 'R4');
      const provIssues = await provenanceValidator.validate(provenance, null, 'R4');

      // Should have all required metadata
      const requiredIssues = allergyIssues.filter(i => 
        i.code?.startsWith('required-metadata-missing-')
      );
      expect(requiredIssues.length).toBe(0);

      // Should have no critical errors
      expect(allergyIssues.filter(i => i.severity === 'error').length).toBe(0);
      expect(provIssues.issues.filter(i => i.severity === 'error').length).toBe(0);
    });
  });

  // ========================================================================
  // Profile Validation with Metadata
  // ========================================================================

  describe('Profile and Metadata Integration', () => {
    it('should validate resource with declared profile', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'patient-profiled',
        meta: {
          versionId: '1',
          lastUpdated: '2024-01-01T10:00:00Z',
          profile: [
            'http://hl7.org/fhir/StructureDefinition/Patient',
            'http://example.org/fhir/StructureDefinition/Patient-custom',
          ],
        },
        name: [{ given: ['Test'], family: 'Patient' }],
      };

      const issues = await metadataValidator.validate(patient, 'Patient', 'R4');

      // Profile URLs should be valid
      const profileErrors = issues.filter(
        i => i.code?.includes('profile') && i.severity === 'error'
      );
      expect(profileErrors.length).toBe(0);
    });

    it('should warn about profile resource type mismatch', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-wrong-profile',
        meta: {
          lastUpdated: '2024-01-01T10:00:00Z',
          profile: [
            'http://hl7.org/fhir/StructureDefinition/Patient', // Wrong type!
          ],
        },
        status: 'final',
        code: { coding: [{ system: 'http://loinc.org', code: '123' }] },
      };

      const issues = await metadataValidator.validate(observation, 'Observation', 'R4');

      // Should warn about mismatch
      const mismatchIssues = issues.filter(i => i.code === 'profile-resource-type-mismatch');
      expect(mismatchIssues.length).toBe(1);
      expect(mismatchIssues[0].severity).toBe('warning');
    });
  });

  // ========================================================================
  // Complex Multi-Resource Scenarios
  // ========================================================================

  describe('Complex Multi-Resource Validation', () => {
    it('should validate bundle with multiple resources and provenance', async () => {
      const bundle = {
        resourceType: 'Bundle',
        id: 'bundle-1',
        type: 'transaction',
        meta: {
          lastUpdated: '2024-01-01T12:00:00Z',
        },
        entry: [
          {
            fullUrl: 'urn:uuid:patient-1',
            resource: {
              resourceType: 'Patient',
              meta: {
                versionId: '1',
                lastUpdated: '2024-01-01T12:00:00Z',
              },
              name: [{ given: ['John'], family: 'Doe' }],
            },
          },
          {
            fullUrl: 'urn:uuid:prov-1',
            resource: {
              resourceType: 'Provenance',
              meta: {
                lastUpdated: '2024-01-01T12:00:00Z',
              },
              target: [{ reference: 'urn:uuid:patient-1' }],
              recorded: '2024-01-01T12:00:00Z',
              agent: [{ who: { reference: 'Practitioner/prac-1' } }],
            },
          },
        ],
      };

      // Validate bundle metadata
      const bundleIssues = await metadataValidator.validate(bundle, 'Bundle', 'R4');

      // Validate each entry
      for (const entry of bundle.entry) {
        if (entry.resource) {
          const resource = entry.resource as any;
          if (resource.resourceType === 'Patient') {
            const patientIssues = await metadataValidator.validate(resource, 'Patient', 'R4');
            expect(patientIssues.filter(i => i.severity === 'error').length).toBe(0);
          } else if (resource.resourceType === 'Provenance') {
            const provIssues = await provenanceValidator.validate(resource, null, 'R4');
            expect(provIssues.issues.filter(i => i.severity === 'error').length).toBe(0);
          }
        }
      }

      expect(bundleIssues.filter(i => i.severity === 'error').length).toBe(0);
    });
  });
});

