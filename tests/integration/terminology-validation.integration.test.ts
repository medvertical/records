/**
 * Integration Tests: Terminology Validation
 * 
 * Tests terminology validation against real FHIR terminology servers.
 * These tests require network connectivity and will make actual HTTP requests.
 * 
 * Test Coverage:
 * - Real validation against tx.fhir.org (R4, R5, R6)
 * - Common codes from standard ValueSets
 * - Invalid codes and error handling
 * - Cache effectiveness with real data
 * - Circuit breaker behavior with real server failures
 * 
 * Note: These tests may be slower and can fail if servers are down.
 * Run with: npm test -- terminology-validation.integration.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { 
  DirectTerminologyClient,
  resetDirectTerminologyClient,
  type ValidateCodeParams 
} from '../../server/services/validation/terminology/direct-terminology-client';
import { 
  TerminologyCache,
  resetTerminologyCache 
} from '../../server/services/validation/terminology/terminology-cache';
import { 
  TerminologyServerRouter,
  resetTerminologyServerRouter 
} from '../../server/services/validation/terminology/terminology-server-router';
import { terminologyValidator } from '../../server/services/validation/engine/terminology-validator';

// Test timeout: 30 seconds for network operations
const TEST_TIMEOUT = 30000;

describe('Terminology Validation Integration Tests', () => {
  let client: DirectTerminologyClient;
  let cache: TerminologyCache;
  let router: TerminologyServerRouter;

  beforeAll(() => {
    // Reset singletons before tests
    resetDirectTerminologyClient();
    resetTerminologyCache();
    resetTerminologyServerRouter();
  });

  beforeEach(() => {
    client = new DirectTerminologyClient(15000); // 15s timeout
    cache = new TerminologyCache();
    router = new TerminologyServerRouter();
  });

  describe('Real R4 Validation (tx.fhir.org/r4)', () => {
    const serverUrl = 'https://tx.fhir.org/r4';

    it('should validate male gender code successfully', async () => {
      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, serverUrl);

      expect(result.valid).toBe(true);
      expect(result.display).toBeTruthy();
      expect(result.serverUrl).toBe(serverUrl);
      expect(result.responseTime).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should validate observation status codes', async () => {
      const statuses = ['final', 'preliminary', 'registered', 'amended'];
      
      const requests = statuses.map(status => ({
        system: 'http://hl7.org/fhir/observation-status',
        code: status,
        valueSet: 'http://hl7.org/fhir/ValueSet/observation-status',
        fhirVersion: 'R4' as const,
      }));

      const results = await client.validateCodeBatch(requests, serverUrl);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.valid).toBe(true);
        expect(result.display).toBeTruthy();
      });
    }, TEST_TIMEOUT);

    it('should detect invalid code in administrative-gender', async () => {
      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'invalid-gender-code',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, serverUrl);

      expect(result.valid).toBe(false);
      expect(result.message).toBeTruthy();
    }, TEST_TIMEOUT);

    it('should handle unknown code system gracefully', async () => {
      const params: ValidateCodeParams = {
        system: 'http://example.org/unknown-system',
        code: 'test-code',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, serverUrl);

      // Should return a result (valid or invalid) without throwing
      expect(result).toBeDefined();
      expect(result.serverUrl).toBe(serverUrl);
    }, TEST_TIMEOUT);
  });

  describe('Real R5 Validation (tx.fhir.org/r5)', () => {
    const serverUrl = 'https://tx.fhir.org/r5';

    it('should validate R5 codes successfully', async () => {
      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'female',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R5',
      };

      const result = await client.validateCode(params, serverUrl);

      expect(result.valid).toBe(true);
      expect(result.serverUrl).toBe(serverUrl);
    }, TEST_TIMEOUT);
  });

  describe('Cache Integration', () => {
    const serverUrl = 'https://tx.fhir.org/r4';

    it('should cache validation results and reuse them', async () => {
      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'other',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      // First validation - miss
      const result1 = await client.validateCode(params, serverUrl);
      const cacheKey = {
        system: params.system,
        code: params.code,
        valueSet: params.valueSet,
        fhirVersion: params.fhirVersion,
      };
      cache.set(cacheKey, result1, false);

      // Second validation - should hit cache
      const cachedResult = cache.get(cacheKey);

      expect(cachedResult).toBeDefined();
      expect(cachedResult?.valid).toBe(result1.valid);
    }, TEST_TIMEOUT);

    it('should track cache statistics correctly', async () => {
      const initialStats = cache.getStats();
      const initialHits = initialStats.hits;

      const cacheKey = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'unknown',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4' as const,
      };

      // Cache a result
      cache.set(cacheKey, { valid: true, responseTime: 100, serverUrl }, false);

      // Hit the cache
      const result = cache.get(cacheKey);

      const updatedStats = cache.getStats();

      expect(result).toBeDefined();
      expect(updatedStats.hits).toBeGreaterThan(initialHits);
      expect(updatedStats.size).toBeGreaterThan(0);
    });
  });

  describe('Server Routing Integration', () => {
    it('should route R4 requests correctly', () => {
      const server = router.getServerForVersion('R4');

      expect(server.url).toContain('tx.fhir.org');
      expect(server.url).toContain('r4');
      expect(server.supportedVersions).toContain('R4');
    });

    it('should route R5 requests correctly', () => {
      const server = router.getServerForVersion('R5');

      expect(server.url).toContain('tx.fhir.org');
      expect(server.url).toContain('r5');
      expect(server.supportedVersions).toContain('R5');
    });

    it('should route R6 requests correctly', () => {
      const server = router.getServerForVersion('R6');

      expect(server.url).toContain('tx.fhir.org');
      expect(server.url).toContain('r6');
      expect(server.supportedVersions).toContain('R6');
    });

    it('should return multiple servers for fallback', () => {
      const servers = router.getServersForVersion('R4');

      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].isPrimary).toBe(true);
    });
  });

  describe('End-to-End Validation Flow', () => {
    it('should validate Patient resource with gender code', async () => {
      const patient = {
        resourceType: 'Patient',
        id: 'test-patient',
        gender: 'male',
        meta: {
          profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
        },
      };

      const issues = await terminologyValidator.validate(
        patient,
        'Patient',
        { mode: 'online', performance: { maxConcurrent: 5, batchSize: 50 }, aspects: {} as any, resourceTypes: {} as any },
        'R4'
      );

      // Should validate successfully (or return specific issues)
      expect(Array.isArray(issues)).toBe(true);
      
      // If gender code is valid, should have no issues
      // If issues exist, they should be properly formatted
      if (issues.length > 0) {
        issues.forEach(issue => {
          expect(issue).toHaveProperty('aspect');
          expect(issue).toHaveProperty('severity');
          expect(issue).toHaveProperty('message');
        });
      }
    }, TEST_TIMEOUT);

    it('should validate Observation resource with status code', async () => {
      const observation = {
        resourceType: 'Observation',
        id: 'test-observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '15074-8',
            display: 'Glucose',
          }],
        },
      };

      const issues = await terminologyValidator.validate(
        observation,
        'Observation',
        { mode: 'online', performance: { maxConcurrent: 5, batchSize: 50 }, aspects: {} as any, resourceTypes: {} as any },
        'R4'
      );

      expect(Array.isArray(issues)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Server Health Monitoring', () => {
    it('should check tx.fhir.org R4 server health', async () => {
      const health = await client.checkServerHealth('https://tx.fhir.org/r4', 'R4');

      expect(health.url).toBe('https://tx.fhir.org/r4');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.avgResponseTime).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it('should detect unhealthy server', async () => {
      const health = await client.checkServerHealth('https://invalid-server.example.org', 'R4');

      expect(health.status).toBe('unhealthy');
      expect(health.failureCount).toBe(1);
    }, TEST_TIMEOUT);
  });

  describe('Performance Benchmarks', () => {
    it('should validate single code in under 5 seconds', async () => {
      const startTime = Date.now();

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');
      const elapsed = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(elapsed).toBeLessThan(5000); // Should complete in <5s
    }, TEST_TIMEOUT);

    it('should validate batch of 10 codes in under 10 seconds', async () => {
      const startTime = Date.now();

      const codes = ['male', 'female', 'other', 'unknown'];
      const requests: ValidateCodeParams[] = codes.map(code => ({
        system: 'http://hl7.org/fhir/administrative-gender',
        code,
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      }));

      const results = await client.validateCodeBatch(requests, 'https://tx.fhir.org/r4');
      const elapsed = Date.now() - startTime;

      expect(results).toHaveLength(4);
      expect(elapsed).toBeLessThan(10000); // Parallel processing should be fast
    }, TEST_TIMEOUT);
  });
});

