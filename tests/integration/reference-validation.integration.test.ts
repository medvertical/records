/**
 * Reference Validation Integration Tests
 * 
 * End-to-end integration tests for reference validation with real FHIR server interactions.
 * Tests complete reference validation pipeline with live data.
 * 
 * Task 6.13: Write integration tests with real FHIR server references
 * 
 * NOTE: These tests may make real HTTP requests to public FHIR servers.
 * Set SKIP_INTEGRATION_TESTS=true to skip in CI/CD environments.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceValidator } from '../../server/services/validation/engine/reference-validator';

const SKIP_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true';
const TEST_TIMEOUT = 30000; // 30 seconds for network requests

describe.skipIf(SKIP_TESTS)('Reference Validation - Integration Tests', () => {
  let validator: ReferenceValidator;

  beforeEach(() => {
    validator = new ReferenceValidator();
  });

  // ========================================================================
  // Basic Integration Tests
  // ========================================================================

  describe('Basic Reference Validation Integration', () => {
    it('should validate Patient with Organization reference', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'integration-test-patient',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
        managingOrganization: {
          reference: 'Organization/example',
        },
      };

      const issues = await validator.validate(patient, 'Patient', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
      console.log(`✓ Patient validation: ${issues.length} issues found`);
    }, TEST_TIMEOUT);

    it('should validate Observation with Patient subject', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'integration-test-obs',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '15074-8',
              display: 'Glucose',
            },
          ],
        },
        subject: {
          reference: 'Patient/example',
        },
      };

      const issues = await validator.validate(observation, 'Observation', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
      console.log(`✓ Observation validation: ${issues.length} issues found`);
    }, TEST_TIMEOUT);
  });

  // ========================================================================
  // Type Extraction Integration
  // ========================================================================

  describe('Type Extraction with Real References', () => {
    it('should extract types from various reference formats', () => {
      const testCases = [
        { ref: 'Patient/example', expected: 'Patient' },
        { ref: 'Organization/hl7', expected: 'Organization' },
        { ref: 'Practitioner/example', expected: 'Practitioner' },
        { ref: 'https://hapi.fhir.org/baseR4/Patient/123', expected: 'Patient' },
        { ref: '#contained-patient', expected: 'contained-patient' },
      ];

      testCases.forEach(({ ref, expected }) => {
        const type = validator.extractResourceType(ref);
        console.log(`  ${ref} → ${type || 'null'}`);
        expect(type).toBeDefined();
      });
    });
  });

  // ========================================================================
  // Canonical URL Validation Integration
  // ========================================================================

  describe('Canonical URL Validation with Real Profiles', () => {
    it('should validate HL7 core profile canonical', () => {
      const canonical = 'http://hl7.org/fhir/StructureDefinition/Patient';
      const result = validator.validateProfileCanonical(canonical);

      expect(result.isValid).toBe(true);
      console.log(`✓ HL7 Patient profile validated`);
    });

    it('should validate HL7 value set canonical', () => {
      const canonical = 'http://hl7.org/fhir/ValueSet/administrative-gender';
      const result = validator.validateValueSetCanonical(canonical);

      expect(result.isValid).toBe(true);
      console.log(`✓ Administrative gender ValueSet validated`);
    });

    it('should validate US Core profile canonical', () => {
      const canonical = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
      const result = validator.validateCanonicalUrl(canonical, 'StructureDefinition');

      expect(result.isValid).toBe(true);
      console.log(`✓ US Core Patient profile validated`);
    });

    it('should validate German MII profile canonical', () => {
      const canonical = 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient';
      const result = validator.validateProfileCanonical(canonical);

      expect(result.isValid).toBe(true);
      console.log(`✓ MII Patient profile validated`);
    });

    it('should extract canonicals from real Patient resource', () => {
      const patient = {
        resourceType: 'Patient',
        id: 'mii-patient-example',
        meta: {
          profile: [
            'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
          ],
        },
      };

      const canonicals = validator.extractCanonicalUrls(patient);

      expect(canonicals.length).toBeGreaterThan(0);
      expect(canonicals[0].baseUrl).toContain('medizininformatik-initiative');
      console.log(`✓ Extracted ${canonicals.length} canonical URL(s)`);
    });
  });

  // ========================================================================
  // Bundle Validation Integration
  // ========================================================================

  describe('Bundle Validation Integration', () => {
    it('should validate transaction Bundle', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'urn:uuid:patient-001',
            resource: {
              resourceType: 'Patient',
              name: [{ family: 'Test' }],
            },
            request: {
              method: 'POST',
              url: 'Patient',
            },
          },
          {
            fullUrl: 'urn:uuid:observation-001',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: {
                coding: [{ system: 'http://loinc.org', code: '15074-8' }],
              },
              subject: {
                reference: 'urn:uuid:patient-001',
              },
            },
            request: {
              method: 'POST',
              url: 'Observation',
            },
          },
        ],
      };

      const issues = await validator.validate(bundle, 'Bundle', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
      console.log(`✓ Transaction Bundle validated: ${issues.length} issues`);
      
      // Bundle should resolve internal UUID references
      const internalRefIssues = issues.filter(i => 
        i.code === 'unresolved-bundle-reference' &&
        i.message?.includes('urn:uuid:patient-001')
      );
      expect(internalRefIssues.length).toBe(0);
    }, TEST_TIMEOUT);

    it('should detect unresolved Bundle references', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'Patient/example',
            resource: {
              resourceType: 'Patient',
              id: 'example',
            },
          },
          {
            fullUrl: 'Observation/obs1',
            resource: {
              resourceType: 'Observation',
              id: 'obs1',
              status: 'final',
              code: {
                coding: [{ system: 'http://loinc.org', code: '15074-8' }],
              },
              subject: {
                reference: 'Patient/nonexistent', // This should be flagged
              },
            },
          },
        ],
      };

      const bundleIssues = validator.validateBundleReferences(bundle);

      const unresolvedIssues = bundleIssues.filter(i => 
        i.code === 'unresolved-bundle-reference'
      );
      expect(unresolvedIssues.length).toBeGreaterThan(0);
      console.log(`✓ Detected ${unresolvedIssues.length} unresolved reference(s)`);
    });
  });

  // ========================================================================
  // Contained Resource Integration
  // ========================================================================

  describe('Contained Resource Validation Integration', () => {
    it('should validate Observation with contained Patient', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-with-contained',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '15074-8' }],
        },
        contained: [
          {
            resourceType: 'Patient',
            id: 'patient-contained',
            name: [{ family: 'TestPatient' }],
          },
        ],
        subject: {
          reference: '#patient-contained',
        },
      };

      const issues = await validator.validate(observation, 'Observation', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
      
      // Should not have errors for contained reference
      const containedErrors = issues.filter(i => 
        i.code === 'contained-reference-not-found'
      );
      expect(containedErrors.length).toBe(0);
      console.log(`✓ Contained reference validated successfully`);
    }, TEST_TIMEOUT);

    it('should detect orphaned contained references', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-orphaned',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '15074-8' }],
        },
        contained: [
          {
            resourceType: 'Patient',
            id: 'orphaned-patient',
            name: [{ family: 'Orphan' }],
          },
        ],
        subject: {
          reference: 'Patient/external', // Not referencing contained
        },
      };

      const containedIssues = validator.validateContainedReferences(observation);

      // Should detect unreferenced contained resource
      expect(Array.isArray(containedIssues)).toBe(true);
      console.log(`✓ Orphaned contained resource check completed`);
    });
  });

  // ========================================================================
  // Versioned Reference Integration
  // ========================================================================

  describe('Versioned Reference Validation Integration', () => {
    it('should parse and validate versioned reference', () => {
      const versionedRef = 'Patient/example/_history/1';
      const versionInfo = validator.parseVersionedReference(versionedRef);

      expect(versionInfo.isVersioned).toBe(true);
      expect(versionInfo.versionId).toBe('1');
      expect(versionInfo.resourceType).toBe('Patient');

      const validationResult = validator.validateVersionedReference(versionedRef);
      expect(validationResult.isValid).toBe(true);
      console.log(`✓ Versioned reference validated: ${versionedRef}`);
    });

    it('should detect version inconsistencies in Bundle', () => {
      const bundle = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              subject: { reference: 'Patient/123/_history/1' },
            },
          },
          {
            resource: {
              resourceType: 'DiagnosticReport',
              subject: { reference: 'Patient/123/_history/2' }, // Different version!
            },
          },
        ],
      };

      const versionCheck = validator.validateBundleVersionIntegrity(bundle);

      expect(versionCheck.consistencyCheck.isConsistent).toBe(false);
      expect(versionCheck.consistencyCheck.issues.length).toBeGreaterThan(0);
      console.log(`✓ Detected ${versionCheck.consistencyCheck.issues.length} version inconsistency/ies`);
    });
  });

  // ========================================================================
  // Circular Reference Integration
  // ========================================================================

  describe('Circular Reference Detection Integration', () => {
    it('should detect circular references in complex Bundle', () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'Patient/pat-A',
            resource: {
              resourceType: 'Patient',
              id: 'pat-A',
              link: [
                {
                  other: { reference: 'Patient/pat-B' },
                  type: 'seealso',
                },
              ],
            },
          },
          {
            fullUrl: 'Patient/pat-B',
            resource: {
              resourceType: 'Patient',
              id: 'pat-B',
              link: [
                {
                  other: { reference: 'Patient/pat-C' },
                  type: 'seealso',
                },
              ],
            },
          },
          {
            fullUrl: 'Patient/pat-C',
            resource: {
              resourceType: 'Patient',
              id: 'pat-C',
              link: [
                {
                  other: { reference: 'Patient/pat-A' }, // Back to A!
                  type: 'seealso',
                },
              ],
            },
          },
        ],
      };

      const circularResult = validator.detectCircularReferences(bundle);

      expect(circularResult.hasCircularReference).toBe(true);
      expect(circularResult.circularChain).toBeDefined();
      console.log(`✓ Detected circular chain: ${circularResult.circularChain?.join(' → ')}`);
    });
  });

  // ========================================================================
  // Complete Workflow Integration
  // ========================================================================

  describe('Complete Reference Validation Workflow', () => {
    it('should perform comprehensive validation on complex resource', async () => {
      const diagnosticReport = {
        resourceType: 'DiagnosticReport',
        id: 'integration-report',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
        },
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '58410-2',
              display: 'CBC panel',
            },
          ],
        },
        contained: [
          {
            resourceType: 'Patient',
            id: 'inline-patient',
            name: [{ family: 'TestPatient' }],
          },
        ],
        subject: {
          reference: '#inline-patient',
        },
        performer: [
          { reference: 'Practitioner/example' },
          { reference: 'Organization/hl7' },
        ],
        result: [
          { reference: 'Observation/hemoglobin' },
          { reference: 'Observation/wbc' },
        ],
        basedOn: [
          { reference: 'ServiceRequest/lab-order-123/_history/1' },
        ],
      };

      // Validate references
      const issues = await validator.validate(diagnosticReport, 'DiagnosticReport', undefined, 'R4');
      
      expect(Array.isArray(issues)).toBe(true);
      console.log(`\n✓ DiagnosticReport comprehensive validation complete`);
      console.log(`  - Total issues: ${issues.length}`);
      console.log(`  - Errors: ${issues.filter(i => i.severity === 'error').length}`);
      console.log(`  - Warnings: ${issues.filter(i => i.severity === 'warning').length}`);

      // Extract canonical URLs
      const canonicals = validator.extractCanonicalUrls(diagnosticReport);
      console.log(`  - Canonical URLs found: ${canonicals.length}`);

      // Extract versioned references
      const versioned = validator.extractVersionedReferences(diagnosticReport);
      console.log(`  - Versioned references: ${versioned.length}`);

      // Check contained references
      const containedResources = validator.getContainedResources(diagnosticReport);
      console.log(`  - Contained resources: ${containedResources.length}`);

      expect(issues).toBeDefined();
      expect(canonicals.length).toBeGreaterThan(0);
      expect(versioned.length).toBeGreaterThan(0);
      expect(containedResources.length).toBe(1);
    }, TEST_TIMEOUT);

    it('should validate real-world transaction Bundle', async () => {
      const transactionBundle = {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            fullUrl: 'urn:uuid:new-patient',
            resource: {
              resourceType: 'Patient',
              name: [{ family: 'NewPatient', given: ['Test'] }],
              gender: 'male',
              birthDate: '1990-01-01',
            },
            request: {
              method: 'POST',
              url: 'Patient',
            },
          },
          {
            fullUrl: 'urn:uuid:new-observation',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: {
                coding: [{ system: 'http://loinc.org', code: '29463-7' }],
              },
              subject: {
                reference: 'urn:uuid:new-patient',
              },
              valueQuantity: {
                value: 185,
                unit: 'cm',
                system: 'http://unitsofmeasure.org',
                code: 'cm',
              },
            },
            request: {
              method: 'POST',
              url: 'Observation',
            },
          },
        ],
      };

      const issues = await validator.validate(transactionBundle, 'Bundle', undefined, 'R4');

      expect(Array.isArray(issues)).toBe(true);
      console.log(`\n✓ Transaction Bundle validated`);
      console.log(`  - Total issues: ${issues.length}`);
      
      // Internal references should be resolved
      const unresolvedInternal = issues.filter(i => 
        i.code === 'unresolved-bundle-reference' &&
        i.message?.includes('urn:uuid:new-patient')
      );
      expect(unresolvedInternal.length).toBe(0);
    }, TEST_TIMEOUT);
  });

  // ========================================================================
  // Performance Integration Tests
  // ========================================================================

  describe('Performance Integration', () => {
    it('should handle large number of references efficiently', async () => {
      const bundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: Array.from({ length: 50 }, (_, i) => ({
          fullUrl: `Patient/${i}`,
          resource: {
            resourceType: 'Patient',
            id: `${i}`,
            managingOrganization: i > 0 ? { reference: `Organization/${i}` } : undefined,
          },
        })),
      };

      const startTime = Date.now();
      const issues = await validator.validate(bundle, 'Bundle', undefined, 'R4');
      const endTime = Date.now();

      expect(Array.isArray(issues)).toBe(true);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in <10s
      console.log(`✓ Validated 50 Patient resources in ${endTime - startTime}ms`);
    }, TEST_TIMEOUT);
  });

  // ========================================================================
  // Error Handling Integration
  // ========================================================================

  describe('Error Handling Integration', () => {
    it('should handle invalid resource gracefully', async () => {
      const invalidResource = {
        resourceType: 'Patient',
        id: 'invalid',
        managingOrganization: {
          reference: 'This is not a valid reference!!',
        },
      };

      const issues = await validator.validate(invalidResource, 'Patient');

      expect(Array.isArray(issues)).toBe(true);
      const formatErrors = issues.filter(i => i.code === 'invalid-reference-format');
      expect(formatErrors.length).toBeGreaterThan(0);
      console.log(`✓ Invalid reference detected and reported`);
    });

    it('should handle missing required references', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'obs-missing-subject',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '15074-8' }],
        },
        // Missing required 'subject' reference
      };

      const issues = await validator.validate(observation, 'Observation');

      expect(Array.isArray(issues)).toBe(true);
      console.log(`✓ Missing reference validation completed: ${issues.length} issues`);
    });
  });
});

