/**
 * Unit tests for HapiValidatorClient
 * 
 * Tests HAPI FHIR validator integration, error handling,
 * retry logic, and OperationOutcome parsing.
 * 
 * Target: 90%+ coverage
 * File size: <500 lines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HapiValidatorClient } from './hapi-validator-client';
import type { HapiValidationOptions } from './hapi-validator-types';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true), // Mock JAR exists
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  default: {
    existsSync: vi.fn(() => true),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));
vi.mock('fs/promises');
vi.mock('child_process');

// Mock fhir-package-versions (Task 2.5)
vi.mock('../../../config/fhir-package-versions', () => ({
  getCorePackage: (version: 'R4' | 'R5' | 'R6') => {
    const packages = {
      R4: { version: '4.0', corePackage: 'hl7.fhir.r4.core@4.0.1', fhirVersion: '4.0.1', status: 'stable' },
      R5: { version: '5.0', corePackage: 'hl7.fhir.r5.core@5.0.0', fhirVersion: '5.0.0', status: 'trial-use' },
      R6: { version: '6.0', corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2', fhirVersion: '6.0.0-ballot2', status: 'ballot' },
    };
    return packages[version];
  },
  getCorePackageId: (version: 'R4' | 'R5' | 'R6') => {
    const ids = {
      R4: 'hl7.fhir.r4.core@4.0.1',
      R5: 'hl7.fhir.r5.core@5.0.0',
      R6: 'hl7.fhir.r6.core@6.0.0-ballot2',
    };
    return ids[version];
  },
  getVersionConfig: (version: 'R4' | 'R5' | 'R6') => {
    const configs = {
      R4: { supportStatus: 'full', limitations: [] },
      R5: { supportStatus: 'full', limitations: [] },
      R6: { supportStatus: 'partial', limitations: ['No terminology validation', 'Limited profile support'] },
    };
    return configs[version];
  },
  isSupportedVersion: (version: string) => ['R4', 'R5', 'R6'].includes(version),
  hasFullSupport: (version: 'R4' | 'R5' | 'R6') => ['R4', 'R5'].includes(version),
}));

vi.mock('../../../config/hapi-validator-config', () => ({
  hapiValidatorConfig: {
    jarPath: '/mock/path/validator_cli.jar',
    timeout: 30000,
    maxParallelValidations: 4,
    defaultFhirVersion: 'R4',
    supportR5: true,
    supportR6: false,
    terminologyServerOnlineR4: 'https://tx.fhir.org/r4',
    terminologyServerOnlineR5: 'https://tx.fhir.org/r5',
    terminologyServerOnlineR6: 'https://tx.fhir.org/r6',
    terminologyServerOfflineR4: 'http://localhost:8081/fhir',
    terminologyServerOfflineR5: 'http://localhost:8081/fhir',
    terminologyServerOfflineR6: 'http://localhost:8081/fhir',
    igCachePath: '/mock/igs',
    terminologyCachePath: '/mock/terminology',
  },
  getTerminologyServerUrl: () => 'https://tx.fhir.org/r4',
  FHIR_VERSION_IG_MAP: {
    R4: { version: '4.0', corePackage: 'hl7.fhir.r4.core@4.0.1' },
    R5: { version: '5.0', corePackage: 'hl7.fhir.r5.core@5.0.0' },
    R6: { version: '6.0', corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2' },
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const VALID_PATIENT = {
  resourceType: 'Patient',
  id: 'example',
  name: [{ family: 'Doe', given: ['John'] }],
  gender: 'male',
  birthDate: '1974-12-25',
};

const HAPI_SUCCESS_OUTCOME = {
  resourceType: 'OperationOutcome',
  issue: [{
    severity: 'information',
    code: 'informational',
    diagnostics: 'No issues detected',
  }],
};

const HAPI_ERROR_OUTCOME = {
  resourceType: 'OperationOutcome',
  issue: [{
    severity: 'error',
    code: 'structure',
    diagnostics: 'Patient.gender: Invalid value',
    location: ['Patient.gender'],
  }],
};

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSpawn(stdout: string, stderr: string, exitCode: number = 0) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event, handler) => {
        if (event === 'data') handler(Buffer.from(stdout));
      }),
    },
    stderr: {
      on: vi.fn((event, handler) => {
        if (event === 'data' && stderr) handler(Buffer.from(stderr));
      }),
    },
    on: vi.fn((event, handler) => {
      if (event === 'close') setTimeout(() => handler(exitCode), 10);
    }),
  };
  return mockProcess;
}

// ============================================================================
// Tests
// ============================================================================

describe('HapiValidatorClient', () => {
  let client: HapiValidatorClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new HapiValidatorClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  describe('Initialization', () => {
    it('should initialize successfully when JAR exists', () => {
      expect(client).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Validation - Success Cases
  // --------------------------------------------------------------------------

  describe('Validation - Success', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    it('should validate valid resource successfully', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      const issues = await promise;

      expect(issues).toBeInstanceOf(Array);
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalled();
      expect(vi.mocked(fs.unlink)).toHaveBeenCalled();
    });

    it('should return validation issues for invalid resource', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_ERROR_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      const issues = await promise;

      expect(issues).toBeInstanceOf(Array);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should support profile validation', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        profile: 'http://hl7.org/fhir/StructureDefinition/Patient',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      const issues = await promise;

      expect(issues).toBeInstanceOf(Array);
    });

    it('should work in offline mode', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'offline',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      const issues = await promise;

      expect(issues).toBeInstanceOf(Array);
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    it('should provide Java installation instructions when Java not found', async () => {
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('spawn java ENOENT');
      });

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      await expect(async () => {
        const promise = client.validateResource(VALID_PATIENT, options);
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow(/Java Runtime not found/);
    });

    it('should handle invalid JSON in response', async () => {
      const mockSpawn = createMockSpawn('invalid json {{{', '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      await expect(async () => {
        const promise = client.validateResource(VALID_PATIENT, options);
        await vi.runAllTimersAsync();
        await promise;
      }).rejects.toThrow(/Failed to parse HAPI OperationOutcome/);
    });

    it('should throw error for missing FHIR version', async () => {
      const options = { mode: 'online' } as any;

      await expect(
        client.validateResource(VALID_PATIENT, options)
      ).rejects.toThrow('FHIR version is required');
    });
  });

  // --------------------------------------------------------------------------
  // Retry Integration
  // --------------------------------------------------------------------------

  describe('Retry Integration', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    it('should retry on timeout errors', async () => {
      let attemptCount = 0;
      vi.mocked(spawn).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Operation timed out');
        }
        return createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0) as any;
      });

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      const issues = await promise;

      expect(attemptCount).toBe(3);
      expect(issues).toBeInstanceOf(Array);
    });
  });

  // --------------------------------------------------------------------------
  // Temp File Management
  // --------------------------------------------------------------------------

  describe('Temp File Management', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    it('should create temp file with resource JSON', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      await promise;

      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
        expect.stringContaining('.json'),
        JSON.stringify(VALID_PATIENT, null, 2),
        'utf-8'
      );
    });

    it('should cleanup temp file after validation', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      await promise;

      expect(vi.mocked(fs.unlink)).toHaveBeenCalled();
    });

    it('should cleanup temp file even on error', async () => {
      vi.mocked(spawn).mockImplementation(() => {
        throw new Error('validation error');
      });

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      try {
        const promise = client.validateResource(VALID_PATIENT, options);
        await vi.runAllTimersAsync();
        await promise;
      } catch {
        // Expected to throw
      }

      expect(vi.mocked(fs.unlink)).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Version-Specific Features
  // --------------------------------------------------------------------------

  describe('Version-Specific Features', () => {
    beforeEach(() => {
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.unlink).mockResolvedValue(undefined);
    });

    it('should load R4 core package for R4 validation', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R4',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      await promise;

      expect(vi.mocked(spawn)).toHaveBeenCalledWith(
        'java',
        expect.arrayContaining([
          expect.stringContaining('hl7.fhir.r4.core@4.0.1'),
        ]),
        expect.any(Object)
      );
    });

    it('should load R5 core package for R5 validation', async () => {
      const mockSpawn = createMockSpawn(JSON.stringify(HAPI_SUCCESS_OUTCOME), '', 0);
      vi.mocked(spawn).mockReturnValue(mockSpawn as any);

      const options: HapiValidationOptions = {
        fhirVersion: 'R5',
        mode: 'online',
      };

      const promise = client.validateResource(VALID_PATIENT, options);
      await vi.runAllTimersAsync();
      await promise;

      expect(vi.mocked(spawn)).toHaveBeenCalledWith(
        'java',
        expect.arrayContaining([
          expect.stringContaining('hl7.fhir.r5.core@5.0.0'),
        ]),
        expect.any(Object)
      );
    });
  });

  describe('Version Support Information (Task 2.5)', () => {
    it('should return version support info for R4', () => {
      const support = client.getVersionSupport('R4');
      
      expect(support).toMatchObject({
        version: 'R4',
        corePackage: 'hl7.fhir.r4.core@4.0.1',
        fhirVersion: '4.0.1',
        status: 'stable',
        supportStatus: 'full',
        hasFullSupport: true,
        isConfigured: true,
      });
      expect(support.limitations).toEqual([]);
    });

    it('should return version support info for R5', () => {
      const support = client.getVersionSupport('R5');
      
      expect(support).toMatchObject({
        version: 'R5',
        corePackage: 'hl7.fhir.r5.core@5.0.0',
        fhirVersion: '5.0.0',
        status: 'trial-use',
        supportStatus: 'full',
        hasFullSupport: true,
        isConfigured: true, // Config mock has supportR5: true
      });
    });

    it('should return version support info for R6 with limitations', () => {
      const support = client.getVersionSupport('R6');
      
      expect(support).toMatchObject({
        version: 'R6',
        corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2',
        status: 'ballot',
        supportStatus: 'partial',
        hasFullSupport: false,
        isConfigured: false, // Config mock has supportR6: false
      });
      expect(support.limitations).toContain('No terminology validation');
      expect(support.limitations).toContain('Limited profile support');
    });

    it('should throw error for unsupported version', () => {
      expect(() => client.getVersionSupport('R3' as any)).toThrow('Unsupported FHIR version');
    });

    it('should check if R4 is available', () => {
      expect(client.isVersionAvailable('R4')).toBe(true);
    });

    it('should check if R5 is available', () => {
      expect(client.isVersionAvailable('R5')).toBe(true);
    });

    it('should check if R6 is available (disabled in config)', () => {
      expect(client.isVersionAvailable('R6')).toBe(false); // supportR6: false in mock config
    });

    it('should return false for unsupported version', () => {
      expect(client.isVersionAvailable('R3' as any)).toBe(false);
    });
  });
});
