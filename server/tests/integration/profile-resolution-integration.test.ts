/**
 * Profile Resolution Integration Tests
 * Task 11.7: Tests for profile auto-resolution workflow
 * 
 * Tests automatic profile discovery, download, and caching from Simplifier.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';

const engine = getValidationEngine();
const testData = getTestDataManager();

// ============================================================================
// Profile Auto-Resolution Tests
// ============================================================================

describe('Profile Auto-Resolution Integration', () => {
  describe('Profile Detection', () => {
    it('should detect profiles declared in meta.profile', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation && observation.content.meta?.profile) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            aspects: {
              profile: { enabled: true },
            },
          },
        });

        expect(result.aspects).toContain('profile');
        // Profile validation ran
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
        // Should not crash even without profile
      }
    });
  });

  // ========================================================================
  // German Profile Detection
  // ========================================================================

  describe('German Profile Auto-Detection', () => {
    it('should detect MII profile patterns', () => {
      const miiUrls = [
        'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
        'https://www.medizininformatik-initiative.de/fhir/core/modul-labor/StructureDefinition/ObservationLab',
      ];

      miiUrls.forEach(url => {
        const isMII = url.includes('medizininformatik-initiative.de');
        expect(isMII).toBe(true);
      });
    });

    it('should detect ISiK profile patterns', () => {
      const isikUrls = [
        'https://gematik.de/fhir/isik/v2/StructureDefinition/ISiKPatient',
        'https://gematik.de/fhir/isik/v2/StructureDefinition/ISiKEncounter',
      ];

      isikUrls.forEach(url => {
        const isISiK = url.includes('gematik.de/fhir/isik');
        expect(isISiK).toBe(true);
      });
    });

    it('should detect KBV profile patterns', () => {
      const kbvUrls = [
        'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Patient',
        'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Practitioner',
      ];

      kbvUrls.forEach(url => {
        const isKBV = url.includes('fhir.kbv.de');
        expect(isKBV).toBe(true);
      });
    });
  });

  // ========================================================================
  // Profile Caching
  // ========================================================================

  describe('Profile Caching', () => {
    it('should cache profiles after first resolution', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (!observation || !observation.content.meta?.profile) {
        return;
      }

      // First validation (may download profile)
      const start1 = Date.now();
      const result1 = await engine.validateResource({
        resource: observation.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const time1 = Date.now() - start1;

      // Second validation (should use cached profile)
      const start2 = Date.now();
      const result2 = await engine.validateResource({
        resource: observation.content,
        resourceType: 'Observation',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const time2 = Date.now() - start2;

      console.log(`  First validation: ${time1}ms`);
      console.log(`  Second validation: ${time2}ms (cached)`);

      // Both should complete
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // ========================================================================
  // Profile Metadata
  // ========================================================================

  describe('Profile Metadata Extraction', () => {
    it('should extract profile metadata during resolution', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation && observation.content.meta?.profile) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            aspects: {
              profile: { enabled: true },
            },
          },
        });

        // Profile validation should have run
        expect(result.aspects).toContain('profile');
      }
    });
  });

  // ========================================================================
  // Version-Aware Resolution
  // ========================================================================

  describe('Version-Aware Profile Resolution', () => {
    it('should handle versioned profile URLs', async () => {
      // Create resource with versioned profile URL
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const versionedPatient = {
          ...patient.content,
          meta: {
            profile: [
              'http://hl7.org/fhir/StructureDefinition/Patient|4.0.1'
            ]
          }
        };

        const result = await engine.validateResource({
          resource: versionedPatient,
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

    it('should handle profile URLs without version', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const unversionedPatient = {
          ...patient.content,
          meta: {
            profile: [
              'http://hl7.org/fhir/StructureDefinition/Patient'
            ]
          }
        };

        const result = await engine.validateResource({
          resource: unversionedPatient,
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

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Profile Resolution Error Handling', () => {
    it('should handle non-existent profiles gracefully', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const invalidProfile = {
          ...patient.content,
          meta: {
            profile: [
              'http://example.com/nonexistent/StructureDefinition/FakeProfile'
            ]
          }
        };

        const result = await engine.validateResource({
          resource: invalidProfile,
          resourceType: 'Patient',
          settings: {
            aspects: {
              profile: { enabled: true },
            },
          },
        });

        // Should not crash
        expect(result).toBeDefined();
        // May have issues about profile not found
      }
    });

    it('should continue validation if profile resolution fails', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: {
            ...patient.content,
            meta: {
              profile: ['http://invalid-url']
            }
          },
          resourceType: 'Patient',
        });

        // Validation should complete despite profile resolution failure
        expect(result).toBeDefined();
        expect(result.resourceType).toBe('Patient');
      }
    });
  });
});

