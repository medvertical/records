/**
 * Batched Reference Checker Unit Tests
 * 
 * Tests for batched reference existence checking using parallel HTTP HEAD requests.
 * Validates batching, concurrency, caching, and error handling.
 * 
 * Task 6.10: Unit tests for batched reference existence checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  BatchedReferenceChecker,
  getBatchedReferenceChecker,
  resetBatchedReferenceChecker 
} from '../batched-reference-checker';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// ============================================================================
// Test Suite
// ============================================================================

describe('BatchedReferenceChecker', () => {
  let checker: BatchedReferenceChecker;
  let mockHead: any;

  beforeEach(() => {
    resetBatchedReferenceChecker();
    vi.clearAllMocks();
    
    // Setup axios mock with default head implementation
    mockHead = vi.fn().mockResolvedValue({ status: 200 });
    
    mockedAxios.create = vi.fn(() => ({
      head: mockHead,
    }));
    
    checker = new BatchedReferenceChecker({
      baseUrl: 'http://fhir.example.com',
      maxConcurrent: 3,
      enableCache: false, // Disable cache for most tests
    });
  });

  // ========================================================================
  // Basic Batch Checking Tests
  // ========================================================================

  describe('Basic Batch Checking', () => {
    it('should check single reference', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const result = await checker.checkBatch(['Patient/123']);

      expect(result.results.length).toBe(1);
      expect(result.results[0].exists).toBe(true);
      expect(result.results[0].statusCode).toBe(200);
      expect(result.existCount).toBe(1);
      expect(mockHead).toHaveBeenCalledWith('http://fhir.example.com/Patient/123');
    });

    it('should check multiple references', async () => {
      mockHead
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await checker.checkBatch([
        'Patient/123',
        'Patient/nonexistent',
        'Observation/456',
      ]);

      expect(result.results.length).toBe(3);
      expect(result.existCount).toBe(2);
      expect(result.notExistCount).toBe(1);
      expect(mockHead).toHaveBeenCalledTimes(3);
    });

    it('should handle 404 responses', async () => {
      mockHead.mockResolvedValue({ status: 404 });

      const result = await checker.checkBatch(['Patient/nonexistent']);

      expect(result.results[0].exists).toBe(false);
      expect(result.results[0].statusCode).toBe(404);
      expect(result.notExistCount).toBe(1);
    });

    it('should handle network errors', async () => {
      mockHead.mockRejectedValue(new Error('Network error'));

      const result = await checker.checkBatch(['Patient/123']);

      expect(result.results[0].exists).toBe(false);
      expect(result.results[0].errorMessage).toContain('Network error');
      expect(result.failedCount).toBe(1);
    });
  });

  // ========================================================================
  // Concurrency Tests
  // ========================================================================

  describe('Concurrency Control', () => {
    it('should respect max concurrent limit', async () => {
      let activeRequests = 0;
      let maxActive = 0;

      mockHead.mockImplementation(async () => {
        activeRequests++;
        maxActive = Math.max(maxActive, activeRequests);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeRequests--;
        return { status: 200 };
      });

      await checker.checkBatch([
        'Patient/1',
        'Patient/2',
        'Patient/3',
        'Patient/4',
        'Patient/5',
        'Patient/6',
      ]);

      expect(maxActive).toBeLessThanOrEqual(3); // maxConcurrent: 3
    });

    it('should process in batches', async () => {
      const mockHead2 = vi.fn().mockResolvedValue({ status: 200 });
      
      mockedAxios.create = vi.fn(() => ({
        head: mockHead2,
      }));

      const checker2 = new BatchedReferenceChecker({
        baseUrl: 'http://fhir.example.com',
        maxConcurrent: 2,
        enableCache: false,
      });

      await checker2.checkBatch(['Patient/1', 'Patient/2', 'Patient/3', 'Patient/4']);

      expect(mockHead2).toHaveBeenCalledTimes(4);
    });
  });

  // ========================================================================
  // Caching Tests
  // ========================================================================

  describe('Caching', () => {
    it('should use cache when enabled', async () => {
      const mockHeadCached = vi.fn().mockResolvedValue({ status: 200 });
      
      mockedAxios.create = vi.fn(() => ({
        head: mockHeadCached,
      }));

      const cachedChecker = new BatchedReferenceChecker({
        baseUrl: 'http://fhir.example.com',
        enableCache: true,
        cacheTtlMs: 60000,
      });

      // First call
      await cachedChecker.checkBatch(['Patient/123']);
      expect(mockHeadCached).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result = await cachedChecker.checkBatch(['Patient/123']);
      expect(mockHeadCached).toHaveBeenCalledTimes(1); // Not called again
      expect(result.results[0].fromCache).toBe(true);
      expect(result.cacheHitCount).toBe(1);
    });

    it('should expire cache after TTL', async () => {
      const mockHeadTtl = vi.fn().mockResolvedValue({ status: 200 });
      
      mockedAxios.create = vi.fn(() => ({
        head: mockHeadTtl,
      }));

      const cachedChecker = new BatchedReferenceChecker({
        baseUrl: 'http://fhir.example.com',
        enableCache: true,
        cacheTtlMs: 10, // Very short TTL
      });

      // First call
      await cachedChecker.checkBatch(['Patient/123']);
      expect(mockHeadTtl).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      // Second call - should not use expired cache
      await cachedChecker.checkBatch(['Patient/123']);
      expect(mockHeadTtl).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const mockHeadClear = vi.fn().mockResolvedValue({ status: 200 });
      
      mockedAxios.create = vi.fn(() => ({
        head: mockHeadClear,
      }));

      const cachedChecker = new BatchedReferenceChecker({
        baseUrl: 'http://fhir.example.com',
        enableCache: true,
      });

      // First call
      await cachedChecker.checkBatch(['Patient/123']);
      
      // Clear cache
      cachedChecker.clearCache();

      // Second call - should not use cache
      await cachedChecker.checkBatch(['Patient/123']);
      expect(mockHeadClear).toHaveBeenCalledTimes(2);
    });

    it('should get cache statistics', async () => {
      const mockHeadStats = vi.fn().mockResolvedValue({ status: 200 });
      
      mockedAxios.create = vi.fn(() => ({
        head: mockHeadStats,
      }));

      const cachedChecker = new BatchedReferenceChecker({
        baseUrl: 'http://fhir.example.com',
        enableCache: true,
      });

      await cachedChecker.checkBatch(['Patient/123', 'Patient/456']);

      const stats = cachedChecker.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries.length).toBe(2);
    });
  });

  // ========================================================================
  // URL Building Tests
  // ========================================================================

  describe('URL Building', () => {
    it('should build relative URL with base', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      await checker.checkBatch(['Patient/123']);

      expect(mockHead).toHaveBeenCalledWith('http://fhir.example.com/Patient/123');
    });

    it('should handle absolute URLs', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      await checker.checkBatch(['http://other-server.com/Patient/123']);

      expect(mockHead).toHaveBeenCalledWith('http://other-server.com/Patient/123');
    });

    it('should skip contained references', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const result = await checker.checkBatch(['#contained-123']);

      expect(mockHead).not.toHaveBeenCalled();
      expect(result.results[0].exists).toBe(false);
      expect(result.results[0].errorMessage).toContain('Cannot build URL');
    });
  });

  // ========================================================================
  // Resource Extraction Tests
  // ========================================================================

  describe('Reference Extraction', () => {
    it('should extract references from resource', () => {
      const resource = {
        resourceType: 'DiagnosticReport',
        subject: { reference: 'Patient/123' },
        performer: [
          { reference: 'Practitioner/456' },
          { reference: 'Organization/789' },
        ],
      };

      const refs = checker.extractReferences(resource);

      expect(refs).toContain('Patient/123');
      expect(refs).toContain('Practitioner/456');
      expect(refs).toContain('Organization/789');
      expect(refs.length).toBe(3);
    });

    it('should handle nested references', () => {
      const resource = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              subject: { reference: 'Patient/123' },
            },
          },
        ],
      };

      const refs = checker.extractReferences(resource);

      expect(refs).toContain('Patient/123');
    });

    it('should handle resource without references', () => {
      const resource = {
        resourceType: 'Patient',
        id: '123',
        name: [{ family: 'Test' }],
      };

      const refs = checker.extractReferences(resource);

      expect(refs.length).toBe(0);
    });
  });

  // ========================================================================
  // Resource Checking Tests
  // ========================================================================

  describe('Resource Checking', () => {
    it('should check all references in resource', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const resource = {
        resourceType: 'Observation',
        subject: { reference: 'Patient/123' },
        performer: [{ reference: 'Practitioner/456' }],
      };

      const result = await checker.checkResourceReferences(resource);

      expect(result.results.length).toBe(2);
      expect(mockHead).toHaveBeenCalledTimes(2);
    });

    it('should check all references in Bundle', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const bundle = {
        resourceType: 'Bundle',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              subject: { reference: 'Patient/123' },
            },
          },
          {
            resource: {
              resourceType: 'DiagnosticReport',
              subject: { reference: 'Patient/456' },
            },
          },
        ],
      };

      const result = await checker.checkBundleReferences(bundle);

      expect(result.results.length).toBe(2);
      expect(mockHead).toHaveBeenCalledTimes(2);
    });
  });

  // ========================================================================
  // Filtering Tests
  // ========================================================================

  describe('Reference Filtering', () => {
    it('should filter existing references', async () => {
      mockHead
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 200 });

      const existing = await checker.filterExistingReferences([
        'Patient/123',
        'Patient/nonexistent',
        'Observation/456',
      ]);

      expect(existing).toHaveLength(2);
      expect(existing).toContain('Patient/123');
      expect(existing).toContain('Observation/456');
    });

    it('should filter non-existing references', async () => {
      mockHead
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 200 });

      const nonExisting = await checker.filterNonExistingReferences([
        'Patient/123',
        'Patient/nonexistent',
        'Observation/456',
      ]);

      expect(nonExisting).toHaveLength(1);
      expect(nonExisting).toContain('Patient/nonexistent');
    });

    it('should check if all references exist', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const allExist = await checker.allReferencesExist([
        'Patient/123',
        'Observation/456',
      ]);

      expect(allExist).toBe(true);
    });

    it('should detect when not all references exist', async () => {
      mockHead
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 });

      const allExist = await checker.allReferencesExist([
        'Patient/123',
        'Patient/nonexistent',
      ]);

      expect(allExist).toBe(false);
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('Statistics', () => {
    it('should calculate correct statistics', async () => {
      mockHead
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 200 })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await checker.checkBatch([
        'Patient/1',
        'Patient/2',
        'Patient/3',
        'Patient/4',
      ]);

      expect(result.existCount).toBe(2);
      expect(result.notExistCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.results.length).toBe(4);
    });

    it('should calculate average response time', async () => {
      mockHead.mockResolvedValue({ status: 200 });

      const result = await checker.checkBatch(['Patient/1', 'Patient/2']);

      expect(result.averageResponseTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty reference array', async () => {
      const result = await checker.checkBatch([]);

      expect(result.results.length).toBe(0);
      expect(result.existCount).toBe(0);
    });

    it('should handle HTTP 3xx redirects', async () => {
      mockHead.mockResolvedValue({ status: 301 });

      const result = await checker.checkBatch(['Patient/123']);

      expect(result.results[0].exists).toBe(true); // 3xx is success
      expect(result.results[0].statusCode).toBe(301);
    });

    it('should handle HTTP 5xx errors', async () => {
      mockHead.mockResolvedValue({ status: 500 });

      const result = await checker.checkBatch(['Patient/123']);

      expect(result.results[0].exists).toBe(false); // 5xx is failure
      expect(result.results[0].statusCode).toBe(500);
    });
  });

  // ========================================================================
  // Singleton Tests
  // ========================================================================

  describe('Singleton', () => {
    it('should return singleton instance', () => {
      const instance1 = getBatchedReferenceChecker();
      const instance2 = getBatchedReferenceChecker();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getBatchedReferenceChecker();
      resetBatchedReferenceChecker();
      const instance2 = getBatchedReferenceChecker();

      expect(instance1).not.toBe(instance2);
    });
  });
});
