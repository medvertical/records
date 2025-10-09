/**
 * Unit tests for TerminologyValidator Version-Specific Routing
 * Task 2.9: Tests for version-specific terminology server routing
 * 
 * Tests:
 * - Version-specific terminology server URL selection
 * - Online vs Offline mode routing
 * - R4, R5, R6 endpoint differentiation
 * - Terminology server availability queries
 * 
 * Target: 90%+ coverage
 * File size: <400 lines
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminologyValidator } from './terminology-validator';

// ============================================================================
// Mocks
// ============================================================================

// Mock hapiValidatorClient
vi.mock('./hapi-validator-client', () => ({
  hapiValidatorClient: {
    validateResource: vi.fn().mockResolvedValue([]),
    testSetup: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock hapi-validator-config
vi.mock('../../../config/hapi-validator-config', () => ({
  hapiValidatorConfig: {
    terminologyServers: {
      online: {
        r4: 'https://tx.fhir.org/r4',
        r5: 'https://tx.fhir.org/r5',
        r6: 'https://tx.fhir.org/r6',
      },
      offline: {
        r4: 'http://localhost:8081/fhir',
        r5: 'http://localhost:8082/fhir',
        r6: 'http://localhost:8083/fhir',
      },
    },
  },
  getTerminologyServerUrl: (version: 'R4' | 'R5' | 'R6', mode: 'online' | 'offline', config: any) => {
    const versionKey = version.toLowerCase() as 'r4' | 'r5' | 'r6';
    return config.terminologyServers[mode][versionKey];
  },
}));

// Mock TerminologyAdapter
vi.mock('../terminology/terminology-adapter', () => ({
  TerminologyAdapter: vi.fn().mockImplementation(() => ({
    validateCode: vi.fn().mockResolvedValue({ valid: true }),
  })),
}));

// ============================================================================
// Test Suite
// ============================================================================

describe('TerminologyValidator - Version-Specific Routing (Task 2.9)', () => {
  let validator: TerminologyValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new TerminologyValidator();
  });

  // ==========================================================================
  // Terminology Server URL Selection
  // ==========================================================================

  describe('Terminology Server URL Selection', () => {
    it('should return R4 online terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R4', 'online');
      expect(url).toBe('https://tx.fhir.org/r4');
    });

    it('should return R5 online terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R5', 'online');
      expect(url).toBe('https://tx.fhir.org/r5');
    });

    it('should return R6 online terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R6', 'online');
      expect(url).toBe('https://tx.fhir.org/r6');
    });

    it('should return R4 offline terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R4', 'offline');
      expect(url).toBe('http://localhost:8081/fhir');
    });

    it('should return R5 offline terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R5', 'offline');
      expect(url).toBe('http://localhost:8082/fhir');
    });

    it('should return R6 offline terminology server URL', () => {
      const url = validator.getTerminologyServerUrl('R6', 'offline');
      expect(url).toBe('http://localhost:8083/fhir');
    });
  });

  // ==========================================================================
  // Online vs Offline Mode Differentiation
  // ==========================================================================

  describe('Online vs Offline Mode Differentiation', () => {
    it('should use different URLs for online vs offline R4', () => {
      const onlineUrl = validator.getTerminologyServerUrl('R4', 'online');
      const offlineUrl = validator.getTerminologyServerUrl('R4', 'offline');

      expect(onlineUrl).not.toBe(offlineUrl);
      expect(onlineUrl).toContain('tx.fhir.org');
      expect(offlineUrl).toContain('localhost');
    });

    it('should use different URLs for online vs offline R5', () => {
      const onlineUrl = validator.getTerminologyServerUrl('R5', 'online');
      const offlineUrl = validator.getTerminologyServerUrl('R5', 'offline');

      expect(onlineUrl).not.toBe(offlineUrl);
      expect(onlineUrl).toContain('tx.fhir.org/r5');
      expect(offlineUrl).toContain('localhost:8082');
    });

    it('should use different URLs for online vs offline R6', () => {
      const onlineUrl = validator.getTerminologyServerUrl('R6', 'online');
      const offlineUrl = validator.getTerminologyServerUrl('R6', 'offline');

      expect(onlineUrl).not.toBe(offlineUrl);
      expect(onlineUrl).toContain('tx.fhir.org/r6');
      expect(offlineUrl).toContain('localhost:8083');
    });
  });

  // ==========================================================================
  // Version Differentiation
  // ==========================================================================

  describe('Version Differentiation', () => {
    it('should use different online URLs for R4, R5, R6', () => {
      const r4Url = validator.getTerminologyServerUrl('R4', 'online');
      const r5Url = validator.getTerminologyServerUrl('R5', 'online');
      const r6Url = validator.getTerminologyServerUrl('R6', 'online');

      // All different
      expect(r4Url).not.toBe(r5Url);
      expect(r5Url).not.toBe(r6Url);
      expect(r4Url).not.toBe(r6Url);

      // All use tx.fhir.org
      expect(r4Url).toContain('tx.fhir.org');
      expect(r5Url).toContain('tx.fhir.org');
      expect(r6Url).toContain('tx.fhir.org');

      // Version-specific paths
      expect(r4Url).toContain('/r4');
      expect(r5Url).toContain('/r5');
      expect(r6Url).toContain('/r6');
    });

    it('should use different offline URLs for R4, R5, R6', () => {
      const r4Url = validator.getTerminologyServerUrl('R4', 'offline');
      const r5Url = validator.getTerminologyServerUrl('R5', 'offline');
      const r6Url = validator.getTerminologyServerUrl('R6', 'offline');

      // All different
      expect(r4Url).not.toBe(r5Url);
      expect(r5Url).not.toBe(r6Url);
      expect(r4Url).not.toBe(r6Url);

      // All use localhost
      expect(r4Url).toContain('localhost');
      expect(r5Url).toContain('localhost');
      expect(r6Url).toContain('localhost');

      // Different ports
      expect(r4Url).toContain('8081');
      expect(r5Url).toContain('8082');
      expect(r6Url).toContain('8083');
    });
  });

  // ==========================================================================
  // All Terminology Servers Query
  // ==========================================================================

  describe('All Terminology Servers Query', () => {
    it('should list all available terminology servers', () => {
      const servers = validator.getAllTerminologyServers();

      // Should have 6 servers (3 versions × 2 modes)
      expect(servers.length).toBe(6);

      // Check structure
      const firstServer = servers[0];
      expect(firstServer).toHaveProperty('fhirVersion');
      expect(firstServer).toHaveProperty('mode');
      expect(firstServer).toHaveProperty('url');
    });

    it('should include all FHIR versions', () => {
      const servers = validator.getAllTerminologyServers();

      const r4Servers = servers.filter(s => s.fhirVersion === 'R4');
      const r5Servers = servers.filter(s => s.fhirVersion === 'R5');
      const r6Servers = servers.filter(s => s.fhirVersion === 'R6');

      expect(r4Servers.length).toBe(2); // online + offline
      expect(r5Servers.length).toBe(2);
      expect(r6Servers.length).toBe(2);
    });

    it('should include all modes', () => {
      const servers = validator.getAllTerminologyServers();

      const onlineServers = servers.filter(s => s.mode === 'online');
      const offlineServers = servers.filter(s => s.mode === 'offline');

      expect(onlineServers.length).toBe(3); // R4 + R5 + R6
      expect(offlineServers.length).toBe(3);
    });

    it('should have correct URLs for online servers', () => {
      const servers = validator.getAllTerminologyServers();
      const onlineServers = servers.filter(s => s.mode === 'online');

      const r4Online = onlineServers.find(s => s.fhirVersion === 'R4');
      const r5Online = onlineServers.find(s => s.fhirVersion === 'R5');
      const r6Online = onlineServers.find(s => s.fhirVersion === 'R6');

      expect(r4Online?.url).toBe('https://tx.fhir.org/r4');
      expect(r5Online?.url).toBe('https://tx.fhir.org/r5');
      expect(r6Online?.url).toBe('https://tx.fhir.org/r6');
    });

    it('should have correct URLs for offline servers', () => {
      const servers = validator.getAllTerminologyServers();
      const offlineServers = servers.filter(s => s.mode === 'offline');

      const r4Offline = offlineServers.find(s => s.fhirVersion === 'R4');
      const r5Offline = offlineServers.find(s => s.fhirVersion === 'R5');
      const r6Offline = offlineServers.find(s => s.fhirVersion === 'R6');

      expect(r4Offline?.url).toBe('http://localhost:8081/fhir');
      expect(r5Offline?.url).toBe('http://localhost:8082/fhir');
      expect(r6Offline?.url).toBe('http://localhost:8083/fhir');
    });
  });

  // ==========================================================================
  // URL Format Validation
  // ==========================================================================

  describe('URL Format Validation', () => {
    it('should return valid HTTP URLs for online mode', () => {
      const r4Url = validator.getTerminologyServerUrl('R4', 'online');
      const r5Url = validator.getTerminologyServerUrl('R5', 'online');
      const r6Url = validator.getTerminologyServerUrl('R6', 'online');

      expect(r4Url).toMatch(/^https?:\/\//);
      expect(r5Url).toMatch(/^https?:\/\//);
      expect(r6Url).toMatch(/^https?:\/\//);
    });

    it('should return valid HTTP URLs for offline mode', () => {
      const r4Url = validator.getTerminologyServerUrl('R4', 'offline');
      const r5Url = validator.getTerminologyServerUrl('R5', 'offline');
      const r6Url = validator.getTerminologyServerUrl('R6', 'offline');

      expect(r4Url).toMatch(/^https?:\/\//);
      expect(r5Url).toMatch(/^https?:\/\//);
      expect(r6Url).toMatch(/^https?:\/\//);
    });

    it('should return non-empty URLs for all combinations', () => {
      const versions: Array<'R4' | 'R5' | 'R6'> = ['R4', 'R5', 'R6'];
      const modes: Array<'online' | 'offline'> = ['online', 'offline'];

      for (const version of versions) {
        for (const mode of modes) {
          const url = validator.getTerminologyServerUrl(version, mode);
          expect(url.length).toBeGreaterThan(0);
          expect(url).not.toContain('undefined');
          expect(url).not.toContain('null');
        }
      }
    });
  });
});

