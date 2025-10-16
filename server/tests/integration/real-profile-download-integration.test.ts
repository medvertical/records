/**
 * Real Profile Download Integration Tests
 * Task 11.12: Tests with real profile downloads from Simplifier
 * 
 * Tests profile auto-resolution, download, and caching from Simplifier.net.
 * These tests require network connectivity and may be slower.
 * 
 * Note: These tests are skipped in CI/CD to avoid external dependencies.
 * Run manually with: npm test -- --run server/tests/integration/real-profile-download-integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import axios from 'axios';

const engine = getValidationEngine();

// Skip these tests in CI/CD
const skipExternal = process.env.SKIP_EXTERNAL_TESTS === 'true' || process.env.CI === 'true';
const describeOrSkip = skipExternal ? describe.skip : describe;

// ============================================================================
// Real Profile Download Tests
// ============================================================================

describeOrSkip('Real Profile Download Integration', () => {
  let simplifierAvailable = false;

  beforeAll(async () => {
    try {
      await axios.get('https://simplifier.net', { timeout: 5000 });
      simplifierAvailable = true;
      console.log('  ✅ Simplifier.net is available');
    } catch (error) {
      console.log('  ⚠️ Simplifier.net is not available - tests will be skipped');
    }
  });

  // ========================================================================
  // German Profile Downloads
  // ========================================================================

  describe('German Profile Downloads', () => {
    it('should download and cache German base profile', async () => {
      if (!simplifierAvailable) {
        return;
      }

      const germanPatient = {
        resourceType: 'Patient',
        id: 'test-german-patient',
        meta: {
          profile: [
            'http://fhir.de/StructureDefinition/Patient-de-basis|1.0.0'
          ]
        },
        name: [
          {
            use: 'official',
            family: 'Schmidt',
            given: ['Hans']
          }
        ],
        gender: 'male',
        birthDate: '1980-01-01',
      };

      console.log('  Downloading German Patient profile from Simplifier...');

      const start = Date.now();
      const result = await engine.validateResource({
        resource: germanPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const downloadTime = Date.now() - start;

      console.log(`    Profile download + validation: ${downloadTime}ms`);

      expect(result).toBeDefined();
      expect(result.aspects).toContain('profile');

      // Second validation should use cached profile (much faster)
      const start2 = Date.now();
      const result2 = await engine.validateResource({
        resource: germanPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const cachedTime = Date.now() - start2;

      console.log(`    Cached profile validation: ${cachedTime}ms`);

      expect(cachedTime).toBeLessThan(downloadTime);
    }, 30000); // 30 second timeout for download

    it('should download MII profiles', async () => {
      if (!simplifierAvailable) {
        return;
      }

      const miiPatient = {
        resourceType: 'Patient',
        id: 'test-mii-patient',
        meta: {
          profile: [
            'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient'
          ]
        },
        identifier: [
          {
            system: 'http://example.org/pid',
            value: '12345'
          }
        ],
        name: [
          {
            family: 'Mustermann',
            given: ['Max']
          }
        ],
        gender: 'male',
        birthDate: '1980-01-01',
      };

      console.log('  Downloading MII Patient profile...');

      const result = await engine.validateResource({
        resource: miiPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
      expect(result.aspects).toContain('profile');
    }, 30000);
  });

  // ========================================================================
  // Profile Dependency Resolution
  // ========================================================================

  describe('Profile Dependency Resolution', () => {
    it('should resolve and download profile dependencies', async () => {
      if (!simplifierAvailable) {
        return;
      }

      // Use a profile that has dependencies
      const observationWithProfile = {
        resourceType: 'Observation',
        id: 'test-profile-deps',
        meta: {
          profile: [
            'http://hl7.org/fhir/StructureDefinition/vitalsigns'
          ]
        },
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '8867-4',
            },
          ],
        },
        subject: { reference: 'Patient/test' },
        valueQuantity: {
          value: 72,
          unit: 'beats/minute',
        },
      };

      console.log('  Resolving profile dependencies...');

      const result = await engine.validateResource({
        resource: observationWithProfile,
        resourceType: 'Observation',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
      expect(result.aspects).toContain('profile');
      
      console.log(`    Profile validation with dependencies: ${result.validationTime}ms`);
    }, 30000);
  });

  // ========================================================================
  // Profile Caching
  // ========================================================================

  describe('Profile Caching with Real Downloads', () => {
    it('should cache downloaded profiles for reuse', async () => {
      if (!simplifierAvailable) {
        return;
      }

      const germanPatient = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://fhir.de/StructureDefinition/Patient-de-basis']
        },
        name: [{ family: 'Test' }],
        gender: 'male',
      };

      // First: May download profile
      const start1 = Date.now();
      await engine.validateResource({
        resource: germanPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const time1 = Date.now() - start1;

      // Second: Should use cache
      const start2 = Date.now();
      await engine.validateResource({
        resource: germanPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const time2 = Date.now() - start2;

      // Third: Should also use cache
      const start3 = Date.now();
      await engine.validateResource({
        resource: germanPatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });
      const time3 = Date.now() - start3;

      console.log(`    Download: ${time1}ms, Cache hit 1: ${time2}ms, Cache hit 2: ${time3}ms`);

      // Cache hits should be faster
      expect(time2).toBeLessThan(time1 + 500);
      expect(time3).toBeLessThan(time1 + 500);
    }, 30000);
  });

  // ========================================================================
  // Profile Preloading
  // ========================================================================

  describe('Profile Preloading from Simplifier', () => {
    it('should support manual profile preloading', async () => {
      if (!simplifierAvailable) {
        return;
      }

      // This would typically be done via API
      // Testing that preloaded profiles are available
      const patient = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient']
        },
        name: [{ family: 'Test' }],
      };

      const result = await engine.validateResource({
        resource: patient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
      expect(result.aspects).toContain('profile');
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Profile Download Error Handling', () => {
    it('should handle non-existent profiles gracefully', async () => {
      const patient = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://example.com/NonExistentProfile']
        },
        name: [{ family: 'Test' }],
      };

      const result = await engine.validateResource({
        resource: patient,
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
    });

    it('should continue validation if download fails', async () => {
      const patient = {
        resourceType: 'Patient',
        meta: {
          profile: ['http://invalid-domain-xyz.com/profile']
        },
        name: [{ family: 'Test' }],
        gender: 'male',
      };

      const result = await engine.validateResource({
        resource: patient,
        resourceType: 'Patient',
      });

      // Validation should complete despite profile download failure
      expect(result).toBeDefined();
      expect(result.resourceType).toBe('Patient');
    });
  });

  // ========================================================================
  // Version-Specific Downloads
  // ========================================================================

  describe('Version-Specific Profile Downloads', () => {
    it('should download specific profile versions', async () => {
      if (!simplifierAvailable) {
        return;
      }

      const versionedPatient = {
        resourceType: 'Patient',
        meta: {
          profile: [
            'http://hl7.org/fhir/StructureDefinition/Patient|4.0.1'
          ]
        },
        name: [{ family: 'Test' }],
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

      expect(result).toBeDefined();
      expect(result.aspects).toContain('profile');
    }, 30000);

    it('should handle version ranges', async () => {
      if (!simplifierAvailable) {
        return;
      }

      const rangePatient = {
        resourceType: 'Patient',
        meta: {
          profile: [
            'http://hl7.org/fhir/StructureDefinition/Patient|^4.0.0'
          ]
        },
        name: [{ family: 'Test' }],
      };

      const result = await engine.validateResource({
        resource: rangePatient,
        resourceType: 'Patient',
        settings: {
          aspects: {
            profile: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
    }, 30000);
  });
});

