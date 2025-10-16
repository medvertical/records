/**
 * Validation Cache Manager Unit Tests
 * 
 * Tests for multi-layer caching system coordinating L1/L2/L3 caches.
 * Validates cache operations, statistics, and layer coordination.
 * 
 * Task 7.1 & 7.13: Unit tests for ValidationCacheManager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ValidationCacheManager,
  getValidationCacheManager,
  resetValidationCacheManager,
  type CacheConfig,
  type CacheCategory 
} from '../validation-cache-manager';

// ============================================================================
// Test Suite
// ============================================================================

describe('ValidationCacheManager', () => {
  let cacheManager: ValidationCacheManager;

  beforeEach(() => {
    resetValidationCacheManager();
    cacheManager = new ValidationCacheManager({
      layers: {
        L1: true,
        L2: false, // Database not setup in tests
        L3: false, // Filesystem not setup in tests
      },
    });
  });

  // ========================================================================
  // Initialization Tests
  // ========================================================================

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const manager = new ValidationCacheManager();
      const config = manager.getConfig();

      expect(config.layers.L1).toBe(true);
      expect(config.ttl.validationResults).toBe(300000); // 5 min
      expect(config.ttl.profiles).toBe(1800000); // 30 min
      expect(config.ttl.terminology).toBe(3600000); // 1 hr
    });

    it('should initialize with custom config', () => {
      const manager = new ValidationCacheManager({
        layers: { L1: false, L2: true, L3: true },
        ttl: { validationResults: 60000, profiles: 120000, terminology: 180000, igPackages: 240000 },
      });

      const config = manager.getConfig();
      expect(config.layers.L1).toBe(false);
      expect(config.layers.L2).toBe(true);
      expect(config.ttl.validationResults).toBe(60000);
    });
  });

  // ========================================================================
  // Basic Cache Operations
  // ========================================================================

  describe('Basic Cache Operations', () => {
    it('should set and get value from cache', async () => {
      const testData = { result: 'test-validation' };
      const key = 'test-key';

      await cacheManager.set(key, testData);
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', async () => {
      const result = await cacheManager.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should delete value from cache', async () => {
      const key = 'test-key-delete';
      await cacheManager.set(key, { data: 'test' });

      await cacheManager.delete(key);
      const result = await cacheManager.get(key);

      expect(result).toBeNull();
    });

    it('should clear entire cache', async () => {
      await cacheManager.set('key1', { data: 'value1' });
      await cacheManager.set('key2', { data: 'value2' });

      await cacheManager.clear();

      const result1 = await cacheManager.get('key1');
      const result2 = await cacheManager.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  // ========================================================================
  // Cache Key Generation Tests
  // ========================================================================

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same input', () => {
      const resource = { resourceType: 'Patient', id: '123' };
      const settings = { strict: true };

      const key1 = cacheManager.generateKey(resource, settings, 'R4');
      const key2 = cacheManager.generateKey(resource, settings, 'R4');

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different keys for different inputs', () => {
      const resource1 = { resourceType: 'Patient', id: '123' };
      const resource2 = { resourceType: 'Patient', id: '456' };

      const key1 = cacheManager.generateKey(resource1);
      const key2 = cacheManager.generateKey(resource2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different settings', () => {
      const resource = { resourceType: 'Patient', id: '123' };

      const key1 = cacheManager.generateKey(resource, { strict: true });
      const key2 = cacheManager.generateKey(resource, { strict: false });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different FHIR versions', () => {
      const resource = { resourceType: 'Patient', id: '123' };

      const key1 = cacheManager.generateKey(resource, null, 'R4');
      const key2 = cacheManager.generateKey(resource, null, 'R5');

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different categories', () => {
      const resource = { resourceType: 'Patient', id: '123' };

      const key1 = cacheManager.generateKey(resource, null, 'R4', 'validation');
      const key2 = cacheManager.generateKey(resource, null, 'R4', 'profile');

      expect(key1).not.toBe(key2);
    });
  });

  // ========================================================================
  // TTL Tests
  // ========================================================================

  describe('TTL Configuration', () => {
    it('should get correct TTL for validation category', () => {
      const ttl = cacheManager.getTtl('validation');

      expect(ttl).toBe(300000); // 5 min
    });

    it('should get correct TTL for profile category', () => {
      const ttl = cacheManager.getTtl('profile');

      expect(ttl).toBe(1800000); // 30 min
    });

    it('should get correct TTL for terminology category', () => {
      const ttl = cacheManager.getTtl('terminology');

      expect(ttl).toBe(3600000); // 1 hr
    });

    it('should get correct TTL for igPackage category', () => {
      const ttl = cacheManager.getTtl('igPackage');

      expect(ttl).toBe(86400000); // 24 hr
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('Statistics', () => {
    it('should track cache hits', async () => {
      await cacheManager.set('test-key', { data: 'test' });
      await cacheManager.get('test-key');
      await cacheManager.get('test-key');

      const stats = await cacheManager.getStats();

      expect(stats.layers.L1.hits).toBe(2);
      expect(stats.overall.totalHits).toBe(2);
    });

    it('should track cache misses', async () => {
      await cacheManager.get('nonexistent-1');
      await cacheManager.get('nonexistent-2');

      const stats = await cacheManager.getStats();

      expect(stats.layers.L1.misses).toBe(2);
      expect(stats.overall.totalMisses).toBe(2);
    });

    it('should calculate hit rate correctly', async () => {
      await cacheManager.set('key1', { data: 'value1' });
      
      await cacheManager.get('key1'); // Hit
      await cacheManager.get('key1'); // Hit
      await cacheManager.get('nonexistent'); // Miss

      const stats = await cacheManager.getStats();

      expect(stats.overall.hitRate).toBeCloseTo(2/3, 2);
    });

    it('should track cache size', async () => {
      await cacheManager.set('key1', { data: 'a'.repeat(1000) });
      await cacheManager.set('key2', { data: 'b'.repeat(2000) });

      const stats = await cacheManager.getStats();

      expect(stats.layers.L1.sizeMB).toBeGreaterThan(0);
      expect(stats.overall.totalSizeMB).toBeGreaterThan(0);
    });

    it('should count entries correctly', async () => {
      await cacheManager.set('key1', { data: 'value1' });
      await cacheManager.set('key2', { data: 'value2' });
      await cacheManager.set('key3', { data: 'value3' });

      const stats = await cacheManager.getStats();

      expect(stats.layers.L1.entries).toBe(3);
      expect(stats.overall.totalEntries).toBe(3);
    });
  });

  // ========================================================================
  // Configuration Tests
  // ========================================================================

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      cacheManager.updateConfig({
        ttl: { validationResults: 600000, profiles: 0, terminology: 0, igPackages: 0 },
      });

      const config = cacheManager.getConfig();
      expect(config.ttl.validationResults).toBe(600000);
    });

    it('should get current configuration', () => {
      const config = cacheManager.getConfig();

      expect(config.layers).toBeDefined();
      expect(config.ttl).toBeDefined();
      expect(config.limits).toBeDefined();
    });
  });

  // ========================================================================
  // Category Management Tests
  // ========================================================================

  describe('Category Management', () => {
    it('should check if key exists', async () => {
      await cacheManager.set('test-key', { data: 'test' });

      const exists = await cacheManager.has('test-key');
      expect(exists).toBe(true);

      const notExists = await cacheManager.has('nonexistent');
      expect(notExists).toBe(false);
    });

    it('should get keys from layer', async () => {
      await cacheManager.set('key1', { data: 'value1' });
      await cacheManager.set('key2', { data: 'value2' });

      const keys = await cacheManager.getKeys('L1');

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys.length).toBe(2);
    });
  });

  // ========================================================================
  // Singleton Tests
  // ========================================================================

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getValidationCacheManager();
      const instance2 = getValidationCacheManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getValidationCacheManager();
      resetValidationCacheManager();
      const instance2 = getValidationCacheManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ========================================================================
  // L2 Cache Specific Tests
  // ========================================================================

  describe('L2 Cache Operations (Database)', () => {
    it('should support metadata in cache entries', async () => {
      const testData = { validationResult: 'passed' };
      const key = 'test-key-with-metadata';
      const metadata = {
        resourceHash: 'abc123',
        settingsHash: 'def456',
        fhirVersion: 'R4',
        resourceType: 'Patient',
      };

      await cacheManager.set(key, testData, 'validation', metadata);
      const retrieved = await cacheManager.get(key);

      expect(retrieved).toEqual(testData);
    });

    it('should get by resource hash', async () => {
      const resourceHash = 'resource-hash-123';
      const result = await cacheManager.getByResourceHash(resourceHash);

      // L2 disabled in test setup, so should return null
      expect(result).toBeNull();
    });

    it('should invalidate by settings hash', async () => {
      const count = await cacheManager.invalidateBySettingsHash('settings-hash-123');

      // L2 disabled in test setup
      expect(count).toBe(0);
    });

    it('should cleanup expired entries', async () => {
      const count = await cacheManager.cleanupExpired();

      // L2 disabled in test setup
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should get entries by category', async () => {
      const entries = await cacheManager.getEntriesByCategory('validation');

      // L2 disabled in test setup
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBe(0);
    });
  });

  // ========================================================================
  // L3 Cache Specific Tests
  // ========================================================================

  describe('L3 Cache Operations (Filesystem)', () => {
    it('should have filesystem cache path configured', () => {
      expect((cacheManager as any).l3CachePath).toBeDefined();
      expect((cacheManager as any).l3CachePath).toContain('cache');
    });

    it('should handle filesystem operations when disabled', async () => {
      // L3 disabled in test setup
      const key = 'fs-test-key';
      
      // Should not throw even though L3 is disabled
      await expect(async () => {
        await (cacheManager as any).setInL3(key, { data: 'test' }, 'validation');
        await (cacheManager as any).getFromL3(key);
        await (cacheManager as any).deleteFromL3(key);
      }).not.toThrow();
    });

    it('should get L3 stats when disabled', async () => {
      const stats = await (cacheManager as any).getL3Stats();

      expect(stats.enabled).toBe(false);
      expect(stats.entries).toBe(0);
    });

    it('should create subdirectories for cache files', () => {
      const key = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const filePath = (cacheManager as any).getCacheFilePath(key);

      // Should include subdirectory based on first 2 chars
      expect(filePath).toContain('/ab/');
    });
  });

  // ========================================================================
  // Cache Warming
  // ========================================================================

  describe('Cache Warming', () => {
    it('should warm cache with common profiles', async () => {
      const result = await cacheManager.warmCache({
        categories: ['profile'],
      });

      expect(result.profilesWarmed).toBeGreaterThan(0);
      expect(result.terminologyWarmed).toBe(0);
      expect(result.totalWarmed).toBe(result.profilesWarmed);
      expect(result.errors.length).toBe(0);
    });

    it('should warm cache with common terminology', async () => {
      const result = await cacheManager.warmCache({
        categories: ['terminology'],
      });

      expect(result.profilesWarmed).toBe(0);
      expect(result.terminologyWarmed).toBeGreaterThan(0);
      expect(result.totalWarmed).toBe(result.terminologyWarmed);
      expect(result.errors.length).toBe(0);
    });

    it('should warm cache with both profiles and terminology', async () => {
      const result = await cacheManager.warmCache();

      expect(result.profilesWarmed).toBeGreaterThan(0);
      expect(result.terminologyWarmed).toBeGreaterThan(0);
      expect(result.totalWarmed).toBe(result.profilesWarmed + result.terminologyWarmed);
    });

    it('should warm cache with custom profiles', async () => {
      const customProfiles = [
        'http://example.com/fhir/StructureDefinition/CustomPatient',
        'http://example.com/fhir/StructureDefinition/CustomObservation',
      ];

      const result = await cacheManager.warmCache({
        profiles: customProfiles,
        categories: ['profile'],
      });

      expect(result.profilesWarmed).toBe(2);
      expect(result.errors.length).toBe(0);
    });

    it('should warm cache with custom terminology systems', async () => {
      const customSystems = [
        'http://example.com/custom-system',
      ];

      const result = await cacheManager.warmCache({
        terminologySystems: customSystems,
        categories: ['terminology'],
      });

      expect(result.terminologyWarmed).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should populate cache entries after warming', async () => {
      await cacheManager.warmCache({
        profiles: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        categories: ['profile'],
      });

      const stats = await cacheManager.getStats();
      expect(stats.layers.L1.entries).toBeGreaterThan(0);
    });

    it('should emit cache-warmed event', async () => {
      const eventPromise = new Promise((resolve) => {
        cacheManager.once('cache-warmed', resolve);
      });

      await cacheManager.warmCache({
        categories: ['profile'],
      });

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      await cacheManager.set('null-key', null);
      const result = await cacheManager.get('null-key');

      expect(result).toBeNull();
    });

    it('should handle large objects', async () => {
      const largeObject = {
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `value-${i}` })),
      };

      await cacheManager.set('large-key', largeObject);
      const result = await cacheManager.get('large-key');

      expect(result).toEqual(largeObject);
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key-with-special-chars-!@#$%^&*()';
      
      await cacheManager.set(specialKey, { data: 'test' });
      const result = await cacheManager.get(specialKey);

      expect(result).toEqual({ data: 'test' });
    });
  });
});
