/**
 * Unit Tests: DirectTerminologyClient
 * 
 * Tests for direct HTTP terminology validation client.
 * Uses mocked axios to avoid external dependencies.
 * 
 * Test Coverage:
 * - validateCode() with valid and invalid codes
 * - validateCodeBatch() with multiple codes
 * - checkServerHealth() for server monitoring
 * - Error handling (timeout, network, HTTP errors)
 * - Response parsing (Parameters resource)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import {
  DirectTerminologyClient,
  getDirectTerminologyClient,
  resetDirectTerminologyClient,
  type ValidateCodeParams,
} from '../direct-terminology-client';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('DirectTerminologyClient', () => {
  let client: DirectTerminologyClient;

  beforeEach(() => {
    resetDirectTerminologyClient();
    client = new DirectTerminologyClient(5000); // 5s timeout for tests
    
    // Setup axios mock
    mockedAxios.create = vi.fn().mockReturnValue({
      get: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateCode', () => {
    it('should validate a valid code successfully', async () => {
      const mockResponse = {
        data: {
          resourceType: 'Parameters',
          parameter: [
            { name: 'result', valueBoolean: true },
            { name: 'display', valueString: 'Male' },
          ],
        },
      };

      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue(mockResponse);
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(true);
      expect(result.display).toBe('Male');
      expect(result.serverUrl).toBe('https://tx.fhir.org/r4');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate an invalid code', async () => {
      const mockResponse = {
        data: {
          resourceType: 'Parameters',
          parameter: [
            { name: 'result', valueBoolean: false },
            { name: 'message', valueString: 'Code not found in ValueSet' },
          ],
        },
      };

      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue(mockResponse);
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'invalid-code',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Code not found in ValueSet');
    });

    it('should handle timeout errors', async () => {
      const httpClient = mockedAxios.create();
      const timeoutError: any = new Error('timeout');
      timeoutError.code = 'ECONNABORTED';
      timeoutError.isAxiosError = true;
      httpClient.get.mockRejectedValue(timeoutError);
      (client as any).httpClient = httpClient;
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TIMEOUT');
      expect(result.message).toContain('timeout');
    });

    it('should handle network errors', async () => {
      const httpClient = mockedAxios.create();
      const networkError: any = new Error('network error');
      networkError.code = 'ECONNREFUSED';
      networkError.isAxiosError = true;
      httpClient.get.mockRejectedValue(networkError);
      (client as any).httpClient = httpClient;
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(false);
      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toContain('Cannot reach');
    });

    it('should handle HTTP error responses', async () => {
      const httpClient = mockedAxios.create();
      const httpError: any = new Error('HTTP error');
      httpError.isAxiosError = true;
      httpError.response = {
        status: 404,
        data: {
          issue: [{ diagnostics: 'ValueSet not found' }],
        },
      };
      httpClient.get.mockRejectedValue(httpError);
      (client as any).httpClient = httpClient;
      mockedAxios.isAxiosError = vi.fn().mockReturnValue(true);

      const params: ValidateCodeParams = {
        system: 'http://example.org/unknown',
        code: 'test',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(false);
      expect(result.code).toBe('HTTP_404');
      expect(result.message).toContain('404');
    });

    it('should use ValueSet/$validate-code when valueSet is specified', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(httpClient.get).toHaveBeenCalledWith(
        'https://tx.fhir.org/r4/ValueSet/$validate-code',
        expect.objectContaining({
          params: expect.objectContaining({
            code: 'male',
            system: 'http://hl7.org/fhir/administrative-gender',
            url: 'http://hl7.org/fhir/ValueSet/administrative-gender',
          }),
        })
      );
    });

    it('should use CodeSystem/$validate-code when valueSet is not specified', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        fhirVersion: 'R4',
      };

      await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(httpClient.get).toHaveBeenCalledWith(
        'https://tx.fhir.org/r4/CodeSystem/$validate-code',
        expect.any(Object)
      );
    });
  });

  describe('validateCodeBatch', () => {
    it('should validate multiple codes in parallel', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const requests: ValidateCodeParams[] = [
        {
          system: 'http://hl7.org/fhir/administrative-gender',
          code: 'male',
          fhirVersion: 'R4',
        },
        {
          system: 'http://hl7.org/fhir/administrative-gender',
          code: 'female',
          fhirVersion: 'R4',
        },
      ];

      const results = await client.validateCodeBatch(requests, 'https://tx.fhir.org/r4');

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(true);
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed success and failure in batch', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get
        .mockResolvedValueOnce({
          data: {
            resourceType: 'Parameters',
            parameter: [{ name: 'result', valueBoolean: true }],
          },
        })
        .mockResolvedValueOnce({
          data: {
            resourceType: 'Parameters',
            parameter: [
              { name: 'result', valueBoolean: false },
              { name: 'message', valueString: 'Invalid code' },
            ],
          },
        });
      (client as any).httpClient = httpClient;

      const requests: ValidateCodeParams[] = [
        { system: 'http://test.org', code: 'valid', fhirVersion: 'R4' },
        { system: 'http://test.org', code: 'invalid', fhirVersion: 'R4' },
      ];

      const results = await client.validateCodeBatch(requests, 'https://tx.fhir.org/r4');

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[1].message).toBe('Invalid code');
    });
  });

  describe('checkServerHealth', () => {
    it('should return healthy status for fast response', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: { resourceType: 'CapabilityStatement' },
      });
      (client as any).httpClient = httpClient;

      const health = await client.checkServerHealth('https://tx.fhir.org/r4', 'R4');

      expect(health.status).toBe('healthy');
      expect(health.url).toBe('https://tx.fhir.org/r4');
      expect(health.failureCount).toBe(0);
      expect(health.avgResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on error', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockRejectedValue(new Error('Connection failed'));
      (client as any).httpClient = httpClient;

      const health = await client.checkServerHealth('https://tx.fhir.org/r4', 'R4');

      expect(health.status).toBe('unhealthy');
      expect(health.failureCount).toBe(1);
    });

    it('should return degraded status for slow response', async () => {
      const httpClient = mockedAxios.create();
      // Simulate slow response
      httpClient.get.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { resourceType: 'CapabilityStatement' } }), 2500)
        )
      );
      (client as any).httpClient = httpClient;

      const health = await client.checkServerHealth('https://tx.fhir.org/r4', 'R4');

      expect(health.status).toBe('degraded');
      expect(health.avgResponseTime).toBeGreaterThan(2000);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance from getDirectTerminologyClient', () => {
      const instance1 = getDirectTerminologyClient();
      const instance2 = getDirectTerminologyClient();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getDirectTerminologyClient();
      resetDirectTerminologyClient();
      const instance2 = getDirectTerminologyClient();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed Parameters response', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'OperationOutcome', // Wrong type
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://test.org',
        code: 'test',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });

    it('should handle missing result parameter', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [], // Empty parameters
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://test.org',
        code: 'test',
        fhirVersion: 'R4',
      };

      const result = await client.validateCode(params, 'https://tx.fhir.org/r4');

      // Should handle gracefully
      expect(result.valid).toBe(false); // No result parameter means invalid
    });
  });

  describe('request parameter building', () => {
    it('should include display when provided', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://hl7.org/fhir/administrative-gender',
        code: 'male',
        display: 'Male',
        valueSet: 'http://hl7.org/fhir/ValueSet/administrative-gender',
        fhirVersion: 'R4',
      };

      await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            display: 'Male',
          }),
        })
      );
    });

    it('should include context parameters when provided', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://test.org',
        code: 'test',
        fhirVersion: 'R4',
        context: {
          date: '2024-01-01',
          customParam: 'value',
        },
      };

      await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            date: '2024-01-01',
            customParam: 'value',
          }),
        })
      );
    });
  });

  describe('version-specific routing', () => {
    it('should route R4 codes to R4 server', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://test.org',
        code: 'test',
        fhirVersion: 'R4',
      };

      await client.validateCode(params, 'https://tx.fhir.org/r4');

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('https://tx.fhir.org/r4'),
        expect.any(Object)
      );
    });

    it('should route R5 codes to R5 server', async () => {
      const httpClient = mockedAxios.create();
      httpClient.get.mockResolvedValue({
        data: {
          resourceType: 'Parameters',
          parameter: [{ name: 'result', valueBoolean: true }],
        },
      });
      (client as any).httpClient = httpClient;

      const params: ValidateCodeParams = {
        system: 'http://test.org',
        code: 'test',
        fhirVersion: 'R5',
      };

      await client.validateCode(params, 'https://tx.fhir.org/r5');

      expect(httpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('https://tx.fhir.org/r5'),
        expect.any(Object)
      );
    });
  });
});

