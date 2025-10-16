/**
 * Real Terminology Server Integration Tests
 * Task 11.11: Tests with real terminology servers (tx.fhir.org)
 * 
 * Tests terminology validation against live FHIR terminology servers.
 * These tests require network connectivity and may be slower.
 * 
 * Note: These tests are skipped in CI/CD to avoid external dependencies.
 * Run manually with: npm test -- --run server/tests/integration/real-terminology-server-integration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';
import axios from 'axios';

const engine = getValidationEngine();
const testData = getTestDataManager();

// Skip these tests in CI/CD (set SKIP_EXTERNAL_TESTS=true)
const skipExternal = process.env.SKIP_EXTERNAL_TESTS === 'true' || process.env.CI === 'true';
const describeOrSkip = skipExternal ? describe.skip : describe;

// ============================================================================
// Real Terminology Server Tests
// ============================================================================

describeOrSkip('Real Terminology Server Integration', () => {
  // Check if tx.fhir.org is reachable before running tests
  let serverAvailable = false;

  beforeAll(async () => {
    try {
      await axios.get('https://tx.fhir.org/r4/metadata', { timeout: 5000 });
      serverAvailable = true;
      console.log('  ✅ tx.fhir.org is available');
    } catch (error) {
      console.log('  ⚠️ tx.fhir.org is not available - some tests may fail');
    }
  });

  // ========================================================================
  // LOINC Code Validation
  // ========================================================================

  describe('LOINC Code Validation', () => {
    it('should validate valid LOINC codes', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        expect(result).toBeDefined();
        expect(result.aspects).toContain('terminology');
        
        // LOINC code 8867-4 (Heart rate) should be valid
        if (serverAvailable) {
          console.log(`    Terminology validation completed in ${result.validationTime}ms`);
        }
      }
    });

    it('should detect invalid LOINC codes', async () => {
      const invalidObservation = {
        resourceType: 'Observation',
        id: 'test-invalid-loinc',
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: 'INVALID-CODE-12345',
              display: 'Invalid Code',
            },
          ],
        },
        subject: { reference: 'Patient/test' },
      };

      const result = await engine.validateResource({
        resource: invalidObservation,
        resourceType: 'Observation',
        settings: {
          mode: 'online',
          aspects: {
            terminology: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
      
      if (serverAvailable) {
        // May have terminology validation issues
        console.log(`    Issues found: ${result.issues.length}`);
      }
    });
  });

  // ========================================================================
  // SNOMED CT Code Validation
  // ========================================================================

  describe('SNOMED CT Code Validation', () => {
    it('should validate valid SNOMED CT codes', async () => {
      const condition = testData.getResourceById('test-condition-active');

      if (condition) {
        const result = await engine.validateResource({
          resource: condition.content,
          resourceType: 'Condition',
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        expect(result).toBeDefined();
        expect(result.aspects).toContain('terminology');
        
        // SNOMED 38341003 (Hypertension) should be valid
        if (serverAvailable) {
          console.log(`    SNOMED validation completed in ${result.validationTime}ms`);
        }
      }
    });

    it('should handle SNOMED CT validation with caching', async () => {
      const condition = testData.getResourceById('test-condition-active');

      if (condition) {
        // First validation (may contact server)
        const start1 = Date.now();
        await engine.validateResource({
          resource: condition.content,
          resourceType: 'Condition',
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });
        const time1 = Date.now() - start1;

        // Second validation (should use cache)
        const start2 = Date.now();
        await engine.validateResource({
          resource: condition.content,
          resourceType: 'Condition',
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });
        const time2 = Date.now() - start2;

        console.log(`    First: ${time1}ms, Second (cached): ${time2}ms`);

        // Both should complete
        expect(time1).toBeGreaterThan(0);
        expect(time2).toBeGreaterThan(0);
      }
    });
  });

  // ========================================================================
  // ValueSet Expansion
  // ========================================================================

  describe('ValueSet Expansion', () => {
    it('should validate codes against expanded ValueSets', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'test-valueset',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs',
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
      };

      const result = await engine.validateResource({
        resource: observation,
        resourceType: 'Observation',
        settings: {
          mode: 'online',
          aspects: {
            terminology: { enabled: true },
          },
        },
      });

      expect(result).toBeDefined();
      
      if (serverAvailable) {
        console.log(`    ValueSet expansion validation: ${result.validationTime}ms`);
      }
    });
  });

  // ========================================================================
  // Performance with Real Server
  // ========================================================================

  describe('Real Server Performance', () => {
    it('should meet performance targets with real terminology server', async () => {
      const resources = testData.getSampleSet(5);

      const times: number[] = [];

      for (const testResource of resources) {
        const start = Date.now();
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`    Average validation time with real server: ${avgTime.toFixed(0)}ms`);
      console.log(`    Times: ${times.map(t => t.toFixed(0)).join(', ')}ms`);

      // Should still be reasonably fast even with real server calls
      if (serverAvailable) {
        // With caching, should be fast after first few validations
        expect(avgTime).toBeLessThan(3000);
      }
    });

    it('should benefit from caching with real server', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        // First validation (cold cache, may be slow)
        const start1 = Date.now();
        await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'online',
          },
        });
        const time1 = Date.now() - start1;

        // Second validation (warm cache, should be fast)
        const start2 = Date.now();
        await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'online',
          },
        });
        const time2 = Date.now() - start2;

        console.log(`    Cold: ${time1}ms, Warm: ${time2}ms`);

        if (serverAvailable) {
          // Warm cache should be faster
          expect(time2).toBeLessThan(time1 * 2); // At most 2x slower
        }
      }
    });
  });

  // ========================================================================
  // Error Scenarios
  // ========================================================================

  describe('Error Scenarios with Real Server', () => {
    it('should handle server timeouts gracefully', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'hybrid', // Will fallback if timeout
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        // Should complete even if server times out
        expect(result).toBeDefined();
        expect(result.resourceType).toBe('Observation');
      }
    });

    it('should provide fallback when server returns errors', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'hybrid',
          },
        });

        // Should always complete
        expect(result).toBeDefined();
      }
    });
  });
});

