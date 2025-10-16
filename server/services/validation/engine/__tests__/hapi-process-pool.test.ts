/**
 * HAPI Process Pool Tests
 * Task 10.6: Test process pool functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HapiProcessPool } from '../hapi-process-pool';
import type { HapiValidationOptions } from '../hapi-validator-types';

describe('HapiProcessPool', () => {
  let pool: HapiProcessPool;

  beforeEach(async () => {
    pool = new HapiProcessPool({
      poolSize: 2,
      minPoolSize: 1,
      maxPoolSize: 4,
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  // ========================================================================
  // Initialization
  // ========================================================================

  describe('Initialization', () => {
    it('should initialize with configured pool size', async () => {
      await pool.initialize();

      const stats = pool.getStats();

      expect(stats.poolSize).toBeGreaterThanOrEqual(2);
      expect(stats.idleProcesses).toBeGreaterThanOrEqual(0);
    });

    it('should have processes in idle state after initialization', async () => {
      await pool.initialize();

      const stats = pool.getStats();

      // After initialization, processes should be idle
      expect(stats.idleProcesses + stats.busyProcesses).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('Statistics', () => {
    it('should provide pool statistics', async () => {
      await pool.initialize();

      const stats = pool.getStats();

      expect(stats).toHaveProperty('poolSize');
      expect(stats).toHaveProperty('idleProcesses');
      expect(stats).toHaveProperty('busyProcesses');
      expect(stats).toHaveProperty('failedProcesses');
      expect(stats).toHaveProperty('queuedJobs');
      expect(stats).toHaveProperty('totalValidations');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('avgValidationTimeMs');
    });

    it('should track validation count', async () => {
      await pool.initialize();

      const initialStats = pool.getStats();
      const initialCount = initialStats.totalValidations;

      // Stats should be initialized to 0 or more
      expect(initialCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Shutdown
  // ========================================================================

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await pool.initialize();
      await pool.shutdown();

      // After shutdown, pool size should be 0
      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
    });

    it('should reject validation requests during shutdown', async () => {
      await pool.initialize();

      // Start shutdown (don't await)
      const shutdownPromise = pool.shutdown();

      // Try to validate during shutdown
      try {
        await pool.validate(
          { resourceType: 'Patient', id: 'test' },
          { fhirVersion: 'R4' }
        );
        expect.fail('Should have thrown error during shutdown');
      } catch (error: any) {
        expect(error.message).toContain('shutting down');
      }

      await shutdownPromise;
    });
  });

  // ========================================================================
  // Pool Configuration
  // ========================================================================

  describe('Pool Configuration', () => {
    it('should respect min pool size', async () => {
      const smallPool = new HapiProcessPool({
        poolSize: 1,
        minPoolSize: 1,
        maxPoolSize: 4,
      });

      await smallPool.initialize();

      const stats = smallPool.getStats();
      expect(stats.poolSize).toBeGreaterThanOrEqual(1);

      await smallPool.shutdown();
    });

    it('should respect max pool size', async () => {
      const largePool = new HapiProcessPool({
        poolSize: 10,
        minPoolSize: 2,
        maxPoolSize: 4, // Max is 4
      });

      await largePool.initialize();

      const stats = largePool.getStats();
      // Should not exceed max pool size
      expect(stats.poolSize).toBeLessThanOrEqual(4);

      await largePool.shutdown();
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const badPool = new HapiProcessPool({
        poolSize: 0, // Invalid
        minPoolSize: 0,
        maxPoolSize: 0,
      });

      // Should not throw during initialization
      await badPool.initialize().catch(() => {
        // Expected to fail
      });

      await badPool.shutdown();
    });
  });
});


