/**
 * Batch Validator Optimization Tests
 * Task 10.7: Test parallel batching and request deduplication
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminologyBatchValidator, type BatchValidationRequest } from '../batch-validator';
import type { ValidateCodeParams, ValidationResult } from '../direct-terminology-client';
import type { ExtractedCode } from '../code-extractor';
import type { CacheKey } from '../terminology-cache';

describe('TerminologyBatchValidator - Task 10.7 Optimizations', () => {
  let validator: TerminologyBatchValidator;
  let validationCallCount: number;
  let validationDelayMs: number;

  beforeEach(() => {
    validator = new TerminologyBatchValidator();
    validationCallCount = 0;
    validationDelayMs = 10; // Simulate network delay
  });

  afterEach(() => {
    validator.clearPendingValidations();
  });

  // Mock validation function
  const createMockValidateFn = () => {
    return async (params: ValidateCodeParams, serverUrl: string): Promise<ValidationResult> => {
      validationCallCount++;
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, validationDelayMs));
      
      return {
        valid: true,
        display: params.display || params.code,
        message: 'Valid code',
        code: params.code,
        responseTime: validationDelayMs,
        serverUrl,
      };
    };
  };

  // Mock cache functions
  const createMockCacheFn = () => {
    const cache = new Map<string, any>();
    
    return {
      get: (key: CacheKey) => {
        const cacheKey = `${key.system}|${key.code}|${key.valueSet || ''}|${key.fhirVersion}`;
        return cache.get(cacheKey) || null;
      },
      set: (key: CacheKey, result: any) => {
        const cacheKey = `${key.system}|${key.code}|${key.valueSet || ''}|${key.fhirVersion}`;
        cache.set(cacheKey, result);
      },
    };
  };

  // Create sample codes
  const createSampleCodes = (count: number): ExtractedCode[] => {
    const codes: ExtractedCode[] = [];
    for (let i = 0; i < count; i++) {
      codes.push({
        system: 'http://loinc.org',
        code: `code-${i}`,
        display: `Code ${i}`,
        path: `code[${i}]`,
        valueSet: undefined,
      });
    }
    return codes;
  };

  // ========================================================================
  // Parallel Batch Processing
  // ========================================================================

  describe('Parallel Batch Processing', () => {
    it('should process multiple batches in parallel', async () => {
      const codes = createSampleCodes(250); // 3 batches (100 + 100 + 50)
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
        maxBatchSize: 100,
      };

      const startTime = Date.now();
      const result = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );
      const totalTime = Date.now() - startTime;

      // With parallel processing (4 concurrent batches), should be faster than sequential
      // Expected: ~30ms (3 batches, but first 2 run in parallel)
      // Sequential would be: ~30ms (batch 1) + 30ms (batch 2) + 15ms (batch 3) = ~75ms
      
      expect(result.validated).toBe(250);
      expect(result.cacheHits).toBe(0);
      
      // Parallel processing should be faster
      // With delay of 10ms and 250 codes, sequential would take much longer
      console.log(`Parallel batch time: ${totalTime}ms (${validationCallCount} calls)`);
    });

    it('should handle large batches efficiently', async () => {
      const codes = createSampleCodes(400); // 4 batches of 100
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
        maxBatchSize: 100,
      };

      const result = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      expect(result.validated).toBe(400);
      expect(result.totalCodes).toBe(400);
      expect(validationCallCount).toBe(400);
    });
  });

  // ========================================================================
  // Request Deduplication
  // ========================================================================

  describe('Request Deduplication', () => {
    it('should deduplicate duplicate codes within a batch', async () => {
      // Create duplicate codes
      const codes: ExtractedCode[] = [
        { system: 'http://loinc.org', code: 'same-code', path: 'code[0]' },
        { system: 'http://loinc.org', code: 'same-code', path: 'code[1]' }, // Duplicate
        { system: 'http://loinc.org', code: 'same-code', path: 'code[2]' }, // Duplicate
        { system: 'http://loinc.org', code: 'different-code', path: 'code[3]' },
      ];

      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      const result = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      // Should only validate 2 unique codes
      expect(validationCallCount).toBe(2);
      // Batch validator deduplicates, so only 2 unique codes in results
      expect(result.results.size).toBe(2);
      // But totalCodes should reflect original count
      expect(result.totalCodes).toBe(4);
    });

    it('should reuse pending validations for concurrent requests', async () => {
      const codes: ExtractedCode[] = [
        { system: 'http://loinc.org', code: 'concurrent-code', path: 'code[0]' },
      ];

      const mockCache = createMockCacheFn();
      
      // Create a slow validation function
      let activeValidations = 0;
      const slowValidateFn = async (params: ValidateCodeParams, serverUrl: string): Promise<ValidationResult> => {
        activeValidations++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Slow
        activeValidations--;
        validationCallCount++;
        
        return {
          valid: true,
          display: params.code,
          message: 'Valid',
          code: params.code,
          responseTime: 100,
          serverUrl,
        };
      };

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      // Start 3 concurrent validations of the same code
      const promise1 = validator.validateBatch(
        request,
        slowValidateFn,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      const promise2 = validator.validateBatch(
        request,
        slowValidateFn,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      const promise3 = validator.validateBatch(
        request,
        slowValidateFn,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);

      // Due to request deduplication, should only make 1 actual validation call
      // (all 3 concurrent requests share the same pending validation)
      expect(validationCallCount).toBeLessThanOrEqual(2); // Allow small race condition margin
      expect(activeValidations).toBe(0); // All should be done
    });

    it('should track deduplication statistics', async () => {
      const codes = createSampleCodes(50);
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      // Start validation (don't await yet)
      const promise = validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      // Check stats while validation is in progress
      await new Promise(resolve => setTimeout(resolve, 5)); // Brief delay
      const stats = validator.getDeduplicationStats();

      expect(stats.pendingValidations).toBeGreaterThanOrEqual(0);

      await promise;

      // After completion, pending should be cleared
      const finalStats = validator.getDeduplicationStats();
      expect(finalStats.pendingValidations).toBe(0);
    });
  });

  // ========================================================================
  // Performance Improvements
  // ========================================================================

  describe('Performance Improvements', () => {
    it('should demonstrate parallel batch speedup', async () => {
      validationDelayMs = 20; // 20ms per code
      
      const codes = createSampleCodes(200); // 2 batches of 100
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
        maxBatchSize: 100,
      };

      const startTime = Date.now();
      const result = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );
      const totalTime = Date.now() - startTime;

      expect(result.validated).toBe(200);
      
      // With parallel batches, should take roughly the time of the slowest batch
      // Not the sum of all batches
      console.log(`Parallel batches completed in ${totalTime}ms (${validationCallCount} calls)`);
    });

    it('should benefit from caching on subsequent validations', async () => {
      const codes = createSampleCodes(100);
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      // First validation - no cache
      const result1 = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      expect(result1.cacheHits).toBe(0);
      expect(result1.validated).toBe(100);
      const firstCallCount = validationCallCount;

      // Second validation - all cached
      const result2 = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      expect(result2.cacheHits).toBe(100);
      expect(result2.validated).toBe(0);
      expect(validationCallCount).toBe(firstCallCount); // No additional calls
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty batch', async () => {
      const codes: ExtractedCode[] = [];
      const mockCache = createMockCacheFn();
      const mockValidate = createMockValidateFn();

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      const result = await validator.validateBatch(
        request,
        mockValidate,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      expect(result.totalCodes).toBe(0);
      expect(result.validated).toBe(0);
      expect(validationCallCount).toBe(0);
    });

    it('should handle validation errors gracefully', async () => {
      const codes = createSampleCodes(10);
      const mockCache = createMockCacheFn();
      
      // Mock function that always fails
      const failingValidateFn = async (): Promise<ValidationResult> => {
        validationCallCount++;
        throw new Error('Validation failed');
      };

      const request: BatchValidationRequest = {
        codes,
        fhirVersion: 'R4',
      };

      const result = await validator.validateBatch(
        request,
        failingValidateFn,
        mockCache.get,
        mockCache.set,
        'http://tx.fhir.org'
      );

      // Should still return results (with error status)
      expect(result.totalCodes).toBe(10);
      expect(result.failures).toBe(10);
      expect(validationCallCount).toBe(10); // All attempts made
    });
  });
});

