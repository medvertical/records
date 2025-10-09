/**
 * Unit tests for VersionRouter
 * Task 2.6: Tests for version-based validation routing
 * 
 * Tests:
 * - Engine caching and lazy initialization
 * - Version detection logic
 * - Routing to correct engine
 * - Version availability checks
 * - Configuration handling
 * 
 * Target: 90%+ coverage
 * File size: <400 lines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VersionRouter, resetVersionRouter, getVersionRouter } from './version-router';
import type { VersionedValidationRequest, FhirVersion } from './version-router';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../core/validation-engine', () => ({
  ValidationEngine: vi.fn().mockImplementation((fhirClient, terminologyClient, version) => ({
    validateResource: vi.fn().mockResolvedValue({
      resourceId: 'test-id',
      resourceType: 'Patient',
      isValid: true,
      issueCount: 0,
      issues: [],
      aspectResults: [],
    }),
    getFhirVersion: vi.fn().mockReturnValue(version || 'R4'),
    setFhirVersion: vi.fn(),
  })),
}));

vi.mock('./hapi-validator-client', () => ({
  HapiValidatorClient: vi.fn().mockImplementation(() => ({
    isVersionAvailable: vi.fn((version: FhirVersion) => {
      // R4 always available, R5 available, R6 not available by default
      return version === 'R4' || version === 'R5';
    }),
    getVersionSupport: vi.fn((version: FhirVersion) => ({
      version,
      hasFullSupport: version === 'R4' || version === 'R5',
    })),
  })),
}));

vi.mock('../../../config/fhir-package-versions', () => ({
  isSupportedVersion: (version: string) => ['R4', 'R5', 'R6'].includes(version),
  hasFullSupport: (version: FhirVersion) => version === 'R4' || version === 'R5',
  getVersionConfig: (version: FhirVersion) => {
    const configs = {
      R4: { supportStatus: 'full', limitations: [] },
      R5: { supportStatus: 'full', limitations: [] },
      R6: { 
        supportStatus: 'partial', 
        limitations: ['No terminology validation', 'Limited profile support'] 
      },
    };
    return configs[version];
  },
}));

// ============================================================================
// Test Suite
// ============================================================================

describe('VersionRouter', () => {
  let router: VersionRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionRouter();
    router = new VersionRouter();
  });

  afterEach(() => {
    resetVersionRouter();
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const stats = router.getStats();
      
      expect(stats.config).toMatchObject({
        enableR5: true,
        enableR6: true,
        autoDetectVersion: true,
      });
      expect(stats.cachedEngines).toEqual([]);
      expect(stats.engineCount).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customRouter = new VersionRouter(undefined, undefined, {
        enableR5: false,
        enableR6: false,
        autoDetectVersion: false,
      });
      
      const stats = customRouter.getStats();
      
      expect(stats.config).toMatchObject({
        enableR5: false,
        enableR6: false,
        autoDetectVersion: false,
      });
    });
  });

  // ==========================================================================
  // Version Detection
  // ==========================================================================

  describe('Version Detection', () => {
    it('should use explicit version from request', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R5',
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R5');
    });

    it('should auto-detect R5 from resource with versionAlgorithm', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: {
          resourceType: 'Patient',
          id: 'test',
          meta: { versionAlgorithm: 'sha256' },
        },
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R5');
    });

    it('should auto-detect version from meta.fhirVersion', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: {
          resourceType: 'Patient',
          id: 'test',
          meta: { fhirVersion: '5.0.0' },
        },
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R5');
    });

    it('should default to R4 when version cannot be detected', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R4');
    });

    it('should fall back to R4 for unsupported version', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R3' as FhirVersion,
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R4');
    });
  });

  // ==========================================================================
  // Engine Caching
  // ==========================================================================

  describe('Engine Caching', () => {
    it('should create and cache engine on first use', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R4',
      };

      await router.routeValidation(request);

      const stats = router.getStats();
      expect(stats.cachedEngines).toContain('R4');
      expect(stats.engineCount).toBe(1);
    });

    it('should reuse cached engine on subsequent calls', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R4',
      };

      await router.routeValidation(request);
      await router.routeValidation(request);
      await router.routeValidation(request);

      const stats = router.getStats();
      expect(stats.engineCount).toBe(1); // Should only have 1 cached engine
    });

    it('should create separate engines for different versions', async () => {
      const requestR4: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test1' },
        fhirVersion: 'R4',
      };

      const requestR5: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test2' },
        fhirVersion: 'R5',
      };

      await router.routeValidation(requestR4);
      await router.routeValidation(requestR5);

      const stats = router.getStats();
      expect(stats.cachedEngines).toContain('R4');
      expect(stats.cachedEngines).toContain('R5');
      expect(stats.engineCount).toBe(2);
    });

    it('should clear cache when requested', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R4',
      };

      await router.routeValidation(request);
      expect(router.getStats().engineCount).toBe(1);

      router.clearCache();
      expect(router.getStats().engineCount).toBe(0);
    });
  });

  // ==========================================================================
  // Version Availability
  // ==========================================================================

  describe('Version Availability', () => {
    it('should report R4 as available', () => {
      expect(router.isVersionAvailable('R4')).toBe(true);
    });

    it('should report R5 as available', () => {
      expect(router.isVersionAvailable('R5')).toBe(true);
    });

    it('should report R6 as unavailable (HAPI not configured)', () => {
      expect(router.isVersionAvailable('R6')).toBe(false);
    });

    it('should respect enableR5 config', () => {
      const customRouter = new VersionRouter(undefined, undefined, {
        enableR5: false,
      });

      expect(customRouter.isVersionAvailable('R5')).toBe(false);
    });

    it('should respect enableR6 config', () => {
      const customRouter = new VersionRouter(undefined, undefined, {
        enableR6: false,
      });

      expect(customRouter.isVersionAvailable('R6')).toBe(false);
    });

    it('should list all available versions', () => {
      const versions = router.getAvailableVersions();

      expect(versions).toContain('R4');
      expect(versions).toContain('R5');
      expect(versions).not.toContain('R6'); // Not available in HAPI mock
    });
  });

  // ==========================================================================
  // Version Info
  // ==========================================================================

  describe('Version Info', () => {
    it('should provide version info for R4', () => {
      const info = router.getVersionInfo('R4');

      expect(info).toBeTruthy();
      expect(info?.version).toBe('R4');
      expect(info?.hasFullSupport).toBe(true);
      expect(info?.limitations).toEqual([]);
    });

    it('should provide version info for R5', () => {
      const info = router.getVersionInfo('R5');

      expect(info).toBeTruthy();
      expect(info?.version).toBe('R5');
      expect(info?.hasFullSupport).toBe(true);
      expect(info?.limitations).toEqual([]);
    });

    it('should provide version info for R6 with limitations', () => {
      const info = router.getVersionInfo('R6');

      expect(info).toBeTruthy();
      expect(info?.version).toBe('R6');
      expect(info?.hasFullSupport).toBe(false);
      expect(info?.limitations).toContain('No terminology validation');
      expect(info?.limitations).toContain('Limited profile support');
    });

    it('should return null for disabled version', () => {
      const customRouter = new VersionRouter(undefined, undefined, {
        enableR5: false,
      });

      const info = customRouter.getVersionInfo('R5');
      expect(info).toBeNull();
    });
  });

  // ==========================================================================
  // Routing Logic
  // ==========================================================================

  describe('Routing Logic', () => {
    it('should route R4 validation correctly', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R4',
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R4');
      expect(result.versionLimitations).toEqual([]);
    });

    it('should route R5 validation correctly', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R5',
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R5');
      expect(result.versionLimitations).toEqual([]);
    });

    it('should route R6 validation with limitations', async () => {
      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R6',
      };

      const result = await router.routeValidation(request);

      expect(result.fhirVersion).toBe('R6');
      expect(result.versionLimitations).toContain('No terminology validation');
      expect(result.versionLimitations).toContain('Limited profile support');
    });

    it('should throw error for disabled version', async () => {
      const customRouter = new VersionRouter(undefined, undefined, {
        enableR5: false,
      });

      const request: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test' },
        fhirVersion: 'R5',
      };

      await expect(customRouter.routeValidation(request)).rejects.toThrow(
        'FHIR R5 support is disabled'
      );
    });
  });

  // ==========================================================================
  // Singleton Pattern
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getVersionRouter();
      const instance2 = getVersionRouter();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton when requested', () => {
      const instance1 = getVersionRouter();
      resetVersionRouter();
      const instance2 = getVersionRouter();

      expect(instance1).not.toBe(instance2);
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('Statistics', () => {
    it('should provide accurate stats', async () => {
      const requestR4: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test1' },
        fhirVersion: 'R4',
      };

      const requestR5: VersionedValidationRequest = {
        resourceType: 'Patient',
        resource: { resourceType: 'Patient', id: 'test2' },
        fhirVersion: 'R5',
      };

      await router.routeValidation(requestR4);
      await router.routeValidation(requestR5);

      const stats = router.getStats();

      expect(stats.cachedEngines).toHaveLength(2);
      expect(stats.cachedEngines).toContain('R4');
      expect(stats.cachedEngines).toContain('R5');
      expect(stats.engineCount).toBe(2);
      expect(stats.availableVersions).toContain('R4');
      expect(stats.availableVersions).toContain('R5');
    });
  });
});

