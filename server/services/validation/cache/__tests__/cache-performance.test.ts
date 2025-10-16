/**
 * Cache Performance Tests
 * Task 7.14: Measure cache effectiveness and performance characteristics
 * 
 * Tests cache performance under various conditions:
 * - Hit/miss rates
 * - Response time improvements
 * - Throughput (operations per second)
 * - Memory efficiency
 * - Performance under load
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValidationCacheManager } from '../validation-cache-manager';
import fs from 'fs/promises';

describe('Cache Performance Tests', () => {
  let cacheManager: ValidationCacheManager;
  const testCacheDir = './cache/test-performance';

  beforeEach(async () => {
    cacheManager = new ValidationCacheManager({
      L1: 'enabled',
      L2: 'disabled',
      L3: 'enabled',
      l1MaxSizeMb: 50,
      l3MaxSizeGb: 1,
      ttl: {
        validation: 60000,    // 1 minute
        profile: 300000,      // 5 minutes
        terminology: 600000,  // 10 minutes
        igPackage: 3600000,   // 1 hour
        default: 30000,       // 30 seconds
      },
    });

    (cacheManager as any).l3CachePath = testCacheDir;
  });

  afterEach(async () => {
    try {
      const exists = await fs.stat(testCacheDir).then(() => true).catch(() => false);
      if (exists) {
        await fs.rm(testCacheDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // ========================================================================
  // Hit Rate Performance
  // ========================================================================

  describe('Hit Rate Performance', () => {
    it('should achieve high hit rate with repeated access', async () => {
      const keys = Array.from({ length: 10 }, (_, i) => 
        cacheManager.generateKey({ id: i }, null, 'R4', 'validation')
      );
      const values = Array.from({ length: 10 }, (_, i) => ({ data: `value-${i}` }));

      // Populate cache
      for (let i = 0; i < 10; i++) {
        await cacheManager.set(keys[i], values[i], 'validation');
      }

      // Access each entry 10 times
      for (let round = 0; round < 10; round++) {
        for (let i = 0; i < 10; i++) {
          await cacheManager.get(keys[i]);
        }
      }

      const stats = await cacheManager.getStats();
      const hitRate = stats.overall.hitRate;

      // Should have very high hit rate (> 90%)
      expect(hitRate).toBeGreaterThan(0.9);
      console.log(`✓ Hit rate: ${(hitRate * 100).toFixed(2)}%`);
    });

    it('should handle cache misses gracefully', async () => {
      const existingKey = cacheManager.generateKey({ id: 1 }, null, 'R4', 'validation');
      await cacheManager.set(existingKey, { data: 'exists' }, 'validation');

      // Access existing (hit)
      await cacheManager.get(existingKey);

      // Access non-existing (misses)
      for (let i = 0; i < 50; i++) {
        await cacheManager.get(`nonexistent-${i}`);
      }

      const stats = await cacheManager.getStats();
      
      expect(stats.overall.totalHits).toBeGreaterThan(0);
      expect(stats.overall.totalMisses).toBeGreaterThan(0);
      console.log(`✓ Hits: ${stats.overall.totalHits}, Misses: ${stats.overall.totalMisses}`);
    });
  });

  // ========================================================================
  // Response Time Performance
  // ========================================================================

  describe('Response Time Performance', () => {
    it('should provide fast cache hits', async () => {
      const key = cacheManager.generateKey({ large: 'data' }, null, 'R4', 'validation');
      const value = { data: 'x'.repeat(10000) }; // 10KB of data

      await cacheManager.set(key, value, 'validation');

      // Measure cache hit time
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await cacheManager.get(key);
      }
      const end = performance.now();

      const avgTime = (end - start) / 100;

      // Should be very fast (< 1ms per operation)
      expect(avgTime).toBeLessThan(1);
      console.log(`✓ Average cache hit time: ${avgTime.toFixed(3)}ms`);
    });

    it('should handle large datasets efficiently', async () => {
      const largeValue = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
          metadata: { timestamp: Date.now() }
        }))
      };

      const key = cacheManager.generateKey(largeValue, null, 'R4', 'validation');

      // Measure set operation
      const setStart = performance.now();
      await cacheManager.set(key, largeValue, 'validation');
      const setEnd = performance.now();

      // Measure get operation
      const getStart = performance.now();
      const retrieved = await cacheManager.get(key);
      const getEnd = performance.now();

      expect(retrieved).toEqual(largeValue);
      expect(setEnd - setStart).toBeLessThan(50); // < 50ms to set
      expect(getEnd - getStart).toBeLessThan(10); // < 10ms to get

      console.log(`✓ Large dataset set: ${(setEnd - setStart).toFixed(2)}ms, get: ${(getEnd - getStart).toFixed(2)}ms`);
    });
  });

  // ========================================================================
  // Throughput Performance
  // ========================================================================

  describe('Throughput Performance', () => {
    it('should handle high throughput operations', async () => {
      const operationCount = 1000;
      const keys = Array.from({ length: operationCount }, (_, i) => 
        cacheManager.generateKey({ id: i }, null, 'R4', 'validation')
      );
      const values = Array.from({ length: operationCount }, (_, i) => ({ data: i }));

      // Measure write throughput
      const writeStart = performance.now();
      for (let i = 0; i < operationCount; i++) {
        await cacheManager.set(keys[i], values[i], 'validation');
      }
      const writeEnd = performance.now();
      const writeDuration = (writeEnd - writeStart) / 1000; // seconds
      const writeOpsPerSec = operationCount / writeDuration;

      // Measure read throughput
      const readStart = performance.now();
      for (let i = 0; i < operationCount; i++) {
        await cacheManager.get(keys[i]);
      }
      const readEnd = performance.now();
      const readDuration = (readEnd - readStart) / 1000; // seconds
      const readOpsPerSec = operationCount / readDuration;

      expect(writeOpsPerSec).toBeGreaterThan(100); // At least 100 ops/sec
      expect(readOpsPerSec).toBeGreaterThan(1000); // At least 1000 ops/sec (reads are faster)

      console.log(`✓ Write throughput: ${writeOpsPerSec.toFixed(0)} ops/sec`);
      console.log(`✓ Read throughput: ${readOpsPerSec.toFixed(0)} ops/sec`);
    });

    it('should handle concurrent operations efficiently', async () => {
      const concurrency = 50;
      const operationsPerBatch = 20;

      const start = performance.now();

      // Run concurrent batches
      const batches = Array.from({ length: concurrency }, async (_, batchId) => {
        for (let i = 0; i < operationsPerBatch; i++) {
          const key = cacheManager.generateKey(
            { batch: batchId, op: i },
            null,
            'R4',
            'validation'
          );
          await cacheManager.set(key, { batchId, i }, 'validation');
          await cacheManager.get(key);
        }
      });

      await Promise.all(batches);

      const end = performance.now();
      const duration = (end - start) / 1000;
      const totalOps = concurrency * operationsPerBatch * 2; // set + get
      const opsPerSec = totalOps / duration;

      expect(opsPerSec).toBeGreaterThan(100);
      console.log(`✓ Concurrent throughput (${concurrency} batches): ${opsPerSec.toFixed(0)} ops/sec`);
    });
  });

  // ========================================================================
  // Memory Efficiency
  // ========================================================================

  describe('Memory Efficiency', () => {
    it('should track cache size accurately', async () => {
      const entries = 100;
      const dataSize = 1000; // ~1KB per entry

      for (let i = 0; i < entries; i++) {
        const key = cacheManager.generateKey({ id: i }, null, 'R4', 'validation');
        const value = { data: 'x'.repeat(dataSize) };
        await cacheManager.set(key, value, 'validation');
      }

      const stats = await cacheManager.getStats();

      expect(stats.overall.totalEntries).toBe(entries);
      expect(stats.overall.totalSizeMB).toBeGreaterThan(0);
      
      console.log(`✓ ${entries} entries using ${stats.overall.totalSizeMB.toFixed(2)} MB`);
    });

    it('should handle cache clearing efficiently', async () => {
      // Populate cache
      for (let i = 0; i < 100; i++) {
        const key = cacheManager.generateKey({ id: i }, null, 'R4', 'validation');
        await cacheManager.set(key, { data: i }, 'validation');
      }

      // Measure clear operation
      const start = performance.now();
      await cacheManager.clear();
      const end = performance.now();

      const stats = await cacheManager.getStats();

      expect(stats.overall.totalEntries).toBe(0);
      expect(end - start).toBeLessThan(100); // Should be fast (< 100ms)

      console.log(`✓ Cache clear time: ${(end - start).toFixed(2)}ms`);
    });
  });

  // ========================================================================
  // Cache Warming Performance
  // ========================================================================

  describe('Cache Warming Performance', () => {
    it('should warm cache efficiently', async () => {
      const profiles = [
        'http://hl7.org/fhir/StructureDefinition/Patient',
        'http://hl7.org/fhir/StructureDefinition/Observation',
        'http://hl7.org/fhir/StructureDefinition/Condition',
      ];

      const start = performance.now();
      const result = await cacheManager.warmCache({
        profiles,
        categories: ['profile'],
      });
      const end = performance.now();

      expect(result.profilesWarmed).toBe(profiles.length);
      expect(result.errors.length).toBe(0);
      expect(end - start).toBeLessThan(1000); // Should be fast (< 1 second)

      console.log(`✓ Warmed ${result.profilesWarmed} profiles in ${(end - start).toFixed(0)}ms`);
    });

    it('should improve hit rate after warming', async () => {
      // Warm cache
      await cacheManager.warmCache({
        profiles: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        categories: ['profile'],
      });

      // Access warmed entries
      const key = cacheManager.generateKey(
        { profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient' },
        null,
        'R4',
        'profile'
      );

      // Multiple accesses should all hit
      for (let i = 0; i < 10; i++) {
        const result = await cacheManager.get(key);
        expect(result).not.toBeNull();
      }

      const stats = await cacheManager.getStats();
      expect(stats.overall.hitRate).toBeGreaterThan(0);

      console.log(`✓ Hit rate after warming: ${(stats.overall.hitRate * 100).toFixed(2)}%`);
    });
  });

  // ========================================================================
  // Category-Specific Performance
  // ========================================================================

  describe('Category-Specific Performance', () => {
    it('should handle different categories efficiently', async () => {
      const categories: Array<'validation' | 'profile' | 'terminology' | 'igPackage'> = [
        'validation',
        'profile',
        'terminology',
        'igPackage',
      ];

      const timings: Record<string, number> = {};

      for (const category of categories) {
        const keys = Array.from({ length: 50 }, (_, i) => 
          cacheManager.generateKey({ id: i }, null, 'R4', category)
        );
        const values = Array.from({ length: 50 }, (_, i) => ({ data: `${category}-${i}` }));

        const start = performance.now();
        for (let i = 0; i < 50; i++) {
          await cacheManager.set(keys[i], values[i], category);
        }
        const end = performance.now();

        timings[category] = end - start;
      }

      // All categories should perform similarly
      Object.entries(timings).forEach(([category, time]) => {
        expect(time).toBeLessThan(500); // < 500ms for 50 operations
        console.log(`✓ ${category}: ${time.toFixed(2)}ms for 50 ops`);
      });
    });
  });

  // ========================================================================
  // Performance Under Load
  // ========================================================================

  describe('Performance Under Load', () => {
    it('should maintain performance with many entries', async () => {
      const entryCount = 500;

      // Populate cache
      const populateStart = performance.now();
      for (let i = 0; i < entryCount; i++) {
        const key = cacheManager.generateKey({ id: i }, null, 'R4', 'validation');
        await cacheManager.set(key, { data: i }, 'validation');
      }
      const populateEnd = performance.now();
      const populateTime = populateEnd - populateStart;

      // Access random entries
      const accessStart = performance.now();
      for (let i = 0; i < 100; i++) {
        const randomId = Math.floor(Math.random() * entryCount);
        const key = cacheManager.generateKey({ id: randomId }, null, 'R4', 'validation');
        await cacheManager.get(key);
      }
      const accessEnd = performance.now();
      const accessTime = accessEnd - accessStart;

      expect(populateTime).toBeLessThan(5000); // < 5 seconds to populate
      expect(accessTime).toBeLessThan(100); // < 100ms for 100 random accesses

      const stats = await cacheManager.getStats();
      console.log(`✓ Populated ${entryCount} entries in ${populateTime.toFixed(0)}ms`);
      console.log(`✓ Random access (100 ops) in ${accessTime.toFixed(0)}ms`);
      console.log(`✓ Hit rate: ${(stats.overall.hitRate * 100).toFixed(2)}%`);
    });

    it('should handle mixed read/write workload', async () => {
      const operations = 200;
      const writeRatio = 0.3; // 30% writes, 70% reads

      const start = performance.now();

      for (let i = 0; i < operations; i++) {
        const isWrite = Math.random() < writeRatio;
        const key = cacheManager.generateKey(
          { op: i, type: isWrite ? 'write' : 'read' },
          null,
          'R4',
          'validation'
        );

        if (isWrite) {
          await cacheManager.set(key, { op: i }, 'validation');
        } else {
          await cacheManager.get(key);
        }
      }

      const end = performance.now();
      const duration = end - start;
      const opsPerSec = (operations / duration) * 1000;

      expect(duration).toBeLessThan(2000); // < 2 seconds for 200 ops
      expect(opsPerSec).toBeGreaterThan(100);

      console.log(`✓ Mixed workload: ${operations} ops in ${duration.toFixed(0)}ms (${opsPerSec.toFixed(0)} ops/sec)`);
    });
  });

  // ========================================================================
  // Key Generation Performance
  // ========================================================================

  describe('Key Generation Performance', () => {
    it('should generate keys efficiently', async () => {
      const keyCount = 1000;

      const start = performance.now();
      for (let i = 0; i < keyCount; i++) {
        cacheManager.generateKey(
          { id: i, data: `value-${i}` },
          { setting: 'test' },
          'R4',
          'validation'
        );
      }
      const end = performance.now();

      const duration = end - start;
      const keysPerSec = (keyCount / duration) * 1000;

      expect(duration).toBeLessThan(500); // < 500ms for 1000 keys
      expect(keysPerSec).toBeGreaterThan(1000); // > 1000 keys/sec

      console.log(`✓ Key generation: ${keyCount} keys in ${duration.toFixed(0)}ms (${keysPerSec.toFixed(0)} keys/sec)`);
    });
  });
});


