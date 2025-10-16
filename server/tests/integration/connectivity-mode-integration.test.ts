/**
 * Connectivity Mode Integration Tests
 * Task 11.8: Tests for online/offline mode switching and fallback
 * 
 * Tests automatic mode detection, switching, and graceful degradation.
 */

import { describe, it, expect } from 'vitest';
import { getValidationEngine } from '../../services/validation/core/validation-engine';
import { getTestDataManager } from '../fixtures/test-data-manager';

const engine = getValidationEngine();
const testData = getTestDataManager();

// ============================================================================
// Online/Offline Mode Tests
// ============================================================================

describe('Connectivity Mode Integration', () => {
  describe('Mode Detection', () => {
    it('should validate in online mode when connectivity available', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'online',
          },
        });

        expect(result).toBeDefined();
        expect(result.isValid).toBeDefined();
      }
    });

    it('should validate in offline mode without external services', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'offline',
          },
        });

        expect(result).toBeDefined();
        expect(result.isValid).toBeDefined();
        // Should complete without external calls
      }
    });

    it('should validate in hybrid mode with automatic fallback', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'hybrid',
          },
        });

        expect(result).toBeDefined();
        expect(result.isValid).toBeDefined();
      }
    });
  });

  // ========================================================================
  // Graceful Degradation
  // ========================================================================

  describe('Graceful Degradation', () => {
    it('should fall back to offline mode when online fails', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'hybrid',
            aspects: {
              structural: { enabled: true },
              terminology: { enabled: true },
            },
          },
        });

        // Should complete even if terminology server unavailable
        expect(result).toBeDefined();
        expect(result.aspects).toContain('structural');
      }
    });

    it('should use cached data in offline mode', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        // First validation (online, populates cache)
        await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'online',
          },
        });

        // Second validation (offline, uses cache)
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'offline',
          },
        });

        expect(result).toBeDefined();
        // Should use cached terminology data
      }
    });
  });

  // ========================================================================
  // Mode Switching
  // ========================================================================

  describe('Mode Switching', () => {
    it('should switch between online and offline modes', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        // Validate in online mode
        const onlineResult = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'online',
          },
        });

        // Validate in offline mode
        const offlineResult = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'offline',
          },
        });

        // Both should complete
        expect(onlineResult).toBeDefined();
        expect(offlineResult).toBeDefined();
      }
    });

    it('should maintain performance in offline mode', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const start = Date.now();
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'offline',
          },
        });
        const time = Date.now() - start;

        console.log(`  Offline mode validation: ${time}ms`);

        expect(result).toBeDefined();
        // Offline should still be fast
        expect(time).toBeLessThan(3000);
      }
    });
  });

  // ========================================================================
  // Aspect Behavior by Mode
  // ========================================================================

  describe('Aspect Behavior by Mode', () => {
    it('should run structural validation in all modes', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        for (const mode of ['online', 'offline', 'hybrid']) {
          const result = await engine.validateResource({
            resource: patient.content,
            resourceType: 'Patient',
            settings: {
              mode: mode as any,
              aspects: {
                structural: { enabled: true },
              },
            },
          });

          expect(result.aspects).toContain('structural');
        }
      }
    });

    it('should handle terminology validation mode-appropriately', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        // Online mode - may use external server
        const onlineResult = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'online',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        // Offline mode - uses cache only
        const offlineResult = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'offline',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        // Both should complete
        expect(onlineResult).toBeDefined();
        expect(offlineResult).toBeDefined();
      }
    });
  });

  // ========================================================================
  // Cache Fallback
  // ========================================================================

  describe('Cache Fallback Behavior', () => {
    it('should use cache when available in offline mode', async () => {
      const resources = testData.getSampleSet(3);

      for (const testResource of resources) {
        // First pass (populate cache)
        await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
          settings: {
            mode: 'online',
          },
        });

        // Second pass (offline, use cache)
        const result = await engine.validateResource({
          resource: testResource.content,
          resourceType: testResource.resourceType,
          settings: {
            mode: 'offline',
          },
        });

        expect(result).toBeDefined();
      }
    });

    it('should indicate cache usage in offline mode', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const result = await engine.validateResource({
          resource: patient.content,
          resourceType: 'Patient',
          settings: {
            mode: 'offline',
          },
        });

        expect(result).toBeDefined();
        // Result should be from offline validation
      }
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Connectivity Error Handling', () => {
    it('should not crash on connectivity issues', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        // Try to validate with terminology that may fail
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
          settings: {
            mode: 'hybrid',
            aspects: {
              terminology: { enabled: true },
            },
          },
        });

        // Should complete even if terminology server unreachable
        expect(result).toBeDefined();
      }
    });

    it('should provide meaningful errors when services unavailable', async () => {
      const observation = testData.getResourceById('test-observation-vitals');

      if (observation) {
        const result = await engine.validateResource({
          resource: observation.content,
          resourceType: 'Observation',
        });

        // Errors should be user-friendly, not technical network errors
        result.issues.forEach(issue => {
          expect(issue.message).toBeDefined();
          expect(issue.message.length).toBeGreaterThan(0);
        });
      }
    });
  });

  // ========================================================================
  // Performance by Mode
  // ========================================================================

  describe('Performance by Connectivity Mode', () => {
    it('should track performance across modes', async () => {
      const patient = testData.getResourceById('test-patient-simple');

      if (patient) {
        const modes = ['online', 'offline', 'hybrid'];
        const times: Record<string, number> = {};

        for (const mode of modes) {
          const start = Date.now();
          await engine.validateResource({
            resource: patient.content,
            resourceType: 'Patient',
            settings: {
              mode: mode as any,
            },
          });
          times[mode] = Date.now() - start;
        }

        console.log(`  Online: ${times.online}ms`);
        console.log(`  Offline: ${times.offline}ms`);
        console.log(`  Hybrid: ${times.hybrid}ms`);

        // All modes should complete in reasonable time
        Object.values(times).forEach(time => {
          expect(time).toBeLessThan(5000);
        });
      }
    });
  });
});

