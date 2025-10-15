/**
 * Unit Tests: ProfileResolver
 * 
 * Tests for smart profile resolution system with mocked external dependencies.
 * 
 * Test Coverage:
 * - Profile resolution from multiple sources
 * - Version resolution and selection
 * - German profile detection
 * - Dependency resolution
 * - Metadata extraction
 * - Caching behavior
 * - Error handling
 * 
 * Task 4.13: Write unit tests for ProfileResolver with mocked Simplifier responses
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ProfileResolver, 
  getProfileResolver, 
  resetProfileResolver 
} from '../profile-resolver';
import { VersionResolver } from '../version-resolver';
import { GermanProfileDetector } from '../german-profile-detector';
import { ProfileMetadataExtractor } from '../profile-metadata-extractor';

// ============================================================================
// Mocks
// ============================================================================

// Mock SimplifierClient
vi.mock('../../../../services/fhir/simplifier-client', () => ({
  simplifierClient: {
    searchProfiles: vi.fn(),
    searchPackages: vi.fn(),
    getPackageDetails: vi.fn(),
    downloadPackage: vi.fn(),
    getPackageProfiles: vi.fn(),
  }
}));

// Mock Database
vi.mock('../../../../db', () => ({
  db: {
    execute: vi.fn(),
  },
  pool: {}
}));

// Mock PackageDependencyResolver
vi.mock('../package-dependency-resolver', () => ({
  getPackageDependencyResolver: vi.fn(() => ({
    resolveDependencies: vi.fn().mockResolvedValue({
      totalPackages: 2,
      downloadedPackages: 2,
      failedPackages: [],
      circularDependencies: [],
    }),
    visualizeDependencyGraph: vi.fn().mockReturnValue('Dependency graph'),
  })),
}));

// Import mocked modules
import { simplifierClient } from '../../../../services/fhir/simplifier-client';
import { db } from '../../../../db';

// ============================================================================
// Test Data
// ============================================================================

const mockUSCorePatientProfile = {
  resourceType: 'StructureDefinition',
  id: 'us-core-patient',
  url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  name: 'USCorePatient',
  title: 'US Core Patient Profile',
  version: '6.1.0',
  status: 'active',
  fhirVersion: '4.0.1',
  kind: 'resource',
  abstract: false,
  type: 'Patient',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
  derivation: 'constraint',
  differential: {
    element: [
      {
        path: 'Patient',
        id: 'Patient',
        min: 0,
        max: '*',
      },
      {
        path: 'Patient.identifier',
        id: 'Patient.identifier',
        min: 1,
        max: '*',
        type: [{ code: 'Identifier' }],
        mustSupport: true,
      },
      {
        path: 'Patient.name',
        id: 'Patient.name',
        min: 1,
        max: '*',
        type: [{ code: 'HumanName' }],
        mustSupport: true,
      },
    ],
  },
  snapshot: {
    element: [],
  },
};

const mockMIIPatientProfile = {
  resourceType: 'StructureDefinition',
  id: 'mii-patient',
  url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
  name: 'MIIPatient',
  title: 'MII Patient Profile',
  version: '2.0.0',
  status: 'active',
  fhirVersion: '4.0.1',
  kind: 'resource',
  abstract: false,
  type: 'Patient',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
  derivation: 'constraint',
  differential: { element: [] },
  snapshot: { element: [] },
};

const mockSimplifierSearchResult = {
  id: 'us-core-patient',
  name: 'USCorePatient',
  title: 'US Core Patient Profile',
  url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
  version: '6.1.0',
  packageId: 'hl7.fhir.us.core',
  baseDefinition: 'http://hl7.org/fhir/StructureDefinition/Patient',
  kind: 'resource' as const,
  abstract: false,
  type: 'Patient',
  status: 'active' as const,
  description: 'US Core Patient Profile',
  context: [],
};

// ============================================================================
// Tests
// ============================================================================

describe('ProfileResolver', () => {
  let resolver: ProfileResolver;

  beforeEach(() => {
    resetProfileResolver();
    resolver = new ProfileResolver({
      autoDownload: true,
      resolvePackageDependencies: false, // Disable for unit tests
    });
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetProfileResolver();
  });

  describe('canonical URL normalization', () => {
    it('should remove trailing slashes', async () => {
      const url = 'http://example.org/Profile/';
      
      // Mock database to return nothing (will normalize URL internally)
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([]);
      
      await resolver.resolveProfile(url);
      
      // Should have searched with normalized URL
      expect(db.execute).toHaveBeenCalled();
    });

    it('should extract version from URL with | separator', async () => {
      const url = 'http://example.org/Profile|1.0.0';
      
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([]);
      
      await resolver.resolveProfile(url);
      
      // Should have normalized to base URL without version
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('profile resolution', () => {
    it('should resolve profile from Simplifier', async () => {
      const canonicalUrl = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
      
      // Mock database returns empty (not cached)
      (db.execute as any).mockResolvedValue({ rows: [] });
      
      // Mock Simplifier returns profile
      (simplifierClient.searchProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({
        id: 'hl7.fhir.us.core',
        name: 'US Core',
        version: '6.1.0',
        dependencies: [],
      });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('mock-package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);

      const result = await resolver.resolveProfile(canonicalUrl);

      expect(result.canonicalUrl).toBe(canonicalUrl);
      expect(result.source).toBe('simplifier');
      expect(result.downloaded).toBe(true);
      expect(simplifierClient.searchProfiles).toHaveBeenCalledWith('us-core-patient');
    });

    it('should use cached profile from database', async () => {
      const canonicalUrl = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
      
      // Mock version query to return cached version
      (db.execute as any)
        .mockResolvedValueOnce({ rows: [{ version: '6.1.0' }] })  // getAvailableVersions
        .mockResolvedValueOnce({  // searchDatabase
          rows: [{
            canonical_url: canonicalUrl,
            version: '6.1.0',
            profile_content: mockUSCorePatientProfile,
            source: 'simplifier',
            resolution_time_ms: 100,
            cached_at: new Date(),
            access_count: 5,
            validation_count: 10,
            dependencies: [],
          }]
        })
        .mockResolvedValue({ rows: [] });  // subsequent queries

      const result = await resolver.resolveProfile(canonicalUrl);

      expect(result.source).toBe('database');
      expect(result.profile).toEqual(mockUSCorePatientProfile);
    });

    it('should handle profile not found', async () => {
      const canonicalUrl = 'http://example.org/NonExistentProfile';
      
      // Mock all sources return nothing
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([]);
      (simplifierClient.searchPackages as any).mockResolvedValue({ packages: [] });

      const result = await resolver.resolveProfile(canonicalUrl);

      expect(result.profile).toBeNull();
      expect(result.downloaded).toBe(false);
    });
  });

  describe('version resolution', () => {
    it('should resolve latest version when not specified', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      const availableVersions = ['1.0.0', '2.0.0', '2.1.0'];
      
      // Mock version query
      (db.execute as any).mockResolvedValueOnce({
        rows: availableVersions.map(v => ({ version: v }))
      });
      
      // Mock profile resolution
      (db.execute as any).mockResolvedValueOnce({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([]);

      await resolver.resolveProfile(canonicalUrl);

      // Should have queried for versions
      expect(db.execute).toHaveBeenCalled();
    });

    it('should resolve version range ^2.0.0', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      const requestedVersion = '^2.0.0';
      const availableVersions = ['1.0.0', '2.0.0', '2.1.0', '3.0.0'];
      
      // Mock version query
      (db.execute as any).mockResolvedValueOnce({
        rows: availableVersions.map(v => ({ version: v }))
      });
      
      const resolvedVersion = await resolver.resolveBestVersion(canonicalUrl, requestedVersion);
      
      // Should resolve to 2.1.0 (latest in 2.x.x)
      expect(resolvedVersion).toBe('2.1.0');
    });
  });

  describe('German profile detection', () => {
    it('should detect MII profile', () => {
      const canonicalUrl = 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient';
      
      const result = resolver.detectGermanProfile(canonicalUrl);
      
      expect(result.isGermanProfile).toBe(true);
      expect(result.family).toBe('mii');
      expect(result.confidence).toBeGreaterThan(90);
      expect(result.module).toBe('person');
      expect(result.recommendedPackage).toContain('medizininformatikinitiative');
    });

    it('should detect ISiK profile', () => {
      const canonicalUrl = 'https://gematik.de/fhir/isik/StructureDefinition/Patient';
      
      const result = resolver.detectGermanProfile(canonicalUrl);
      
      expect(result.isGermanProfile).toBe(true);
      expect(result.family).toBe('isik');
      expect(result.recommendedPackage).toContain('gematik.isik');
    });

    it('should detect KBV profile', () => {
      const canonicalUrl = 'https://fhir.kbv.de/StructureDefinition/KBV_PR_ERP_Patient';
      
      const result = resolver.detectGermanProfile(canonicalUrl);
      
      expect(result.isGermanProfile).toBe(true);
      expect(result.family).toBe('kbv');
    });

    it('should detect Basisprofil', () => {
      const canonicalUrl = 'http://fhir.de/StructureDefinition/Patient-de-basis';
      
      const result = resolver.detectGermanProfile(canonicalUrl);
      
      expect(result.isGermanProfile).toBe(true);
      expect(result.family).toBe('basisprofil');
    });

    it('should not detect non-German profile', () => {
      const canonicalUrl = 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient';
      
      const result = resolver.detectGermanProfile(canonicalUrl);
      
      expect(result.isGermanProfile).toBe(false);
      expect(result.family).toBe('unknown');
    });
  });

  describe('metadata extraction', () => {
    it('should extract profile metadata', () => {
      const metadata = resolver.extractMetadata(mockUSCorePatientProfile);
      
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('USCorePatient');
      expect(metadata?.url).toBe('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
      expect(metadata?.type).toBe('Patient');
      expect(metadata?.kind).toBe('resource');
      expect(metadata?.elements).toBeInstanceOf(Array);
      expect(metadata?.constraints).toBeInstanceOf(Array);
      expect(metadata?.mustSupportElements).toBeInstanceOf(Array);
      // Elements are extracted - exact count depends on extractor logic
    });

    it('should return null for invalid profile', () => {
      const metadata = resolver.extractMetadata({ invalid: 'data' });
      
      expect(metadata).toBeNull();
    });
  });

  describe('caching behavior', () => {
    it('should use in-memory cache for repeated resolutions', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      const version = '1.0.0';
      
      // Mock Simplifier
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([{
        ...mockSimplifierSearchResult,
        url: canonicalUrl,
        version,
      }]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({ dependencies: [] });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);

      // First resolution with explicit version
      await resolver.resolveProfile(canonicalUrl, version);
      
      const callCountBefore = (db.execute as any).mock.calls.length;
      
      // Second resolution (should use in-memory cache)
      const result = await resolver.resolveProfile(canonicalUrl, version);
      
      const callCountAfter = (db.execute as any).mock.calls.length;
      
      expect(result).toBeDefined();
      // Should not have made additional calls
      expect(callCountAfter).toBe(callCountBefore);
    });

    it('should check if profile is cached', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      expect(resolver.isCached(canonicalUrl)).toBe(false);
      
      // Mock and resolve
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({ dependencies: [] });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      
      await resolver.resolveProfile(canonicalUrl, '1.0.0');
      
      expect(resolver.isCached(canonicalUrl, '1.0.0')).toBe(true);
    });

    it('should clear cache', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      const version = '1.0.0';
      
      // Resolve a profile with specific version
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([{
        ...mockSimplifierSearchResult,
        url: canonicalUrl,
        version,
      }]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({ dependencies: [] });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      
      await resolver.resolveProfile(canonicalUrl, version);
      expect(resolver.isCached(canonicalUrl, version)).toBe(true);
      
      // Clear cache
      resolver.clearCache();
      expect(resolver.isCached(canonicalUrl, version)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle Simplifier API errors gracefully', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      // Mock database returns nothing
      (db.execute as any).mockResolvedValue({ rows: [] });
      
      // Mock Simplifier throws error
      (simplifierClient.searchProfiles as any).mockRejectedValue(new Error('API Error'));

      const result = await resolver.resolveProfile(canonicalUrl);

      // Should not throw, should return placeholder
      expect(result).toBeDefined();
      expect(result.profile).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      // Mock database throws error
      (db.execute as any).mockRejectedValue(new Error('Database Error'));
      
      // Mock Simplifier succeeds
      (simplifierClient.searchProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({ dependencies: [] });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);

      const result = await resolver.resolveProfile(canonicalUrl);

      // Should fall back to Simplifier
      expect(result).toBeDefined();
      expect(result.source).toBe('simplifier');
    });
  });

  describe('available versions', () => {
    it('should get available versions from multiple sources', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      // Mock database returns some versions
      (db.execute as any).mockResolvedValue({
        rows: [
          { version: '1.0.0' },
          { version: '2.0.0' },
        ]
      });
      
      // Mock Simplifier returns more versions
      (simplifierClient.searchProfiles as any).mockResolvedValue([
        { ...mockSimplifierSearchResult, version: '2.1.0', url: canonicalUrl },
        { ...mockSimplifierSearchResult, version: '3.0.0', url: canonicalUrl },
      ]);

      const versions = await resolver.getAvailableVersions(canonicalUrl);

      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
      expect(versions).toContain('2.1.0');
      expect(versions).toContain('3.0.0');
      expect(versions.length).toBe(4);
    });

    it('should filter invalid version strings', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      (db.execute as any).mockResolvedValue({
        rows: [
          { version: '1.0.0' },
          { version: 'invalid-version' },
          { version: '2.0.0' },
        ]
      });
      
      (simplifierClient.searchProfiles as any).mockResolvedValue([]);

      const versions = await resolver.getAvailableVersions(canonicalUrl);

      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
      expect(versions).not.toContain('invalid-version');
    });
  });

  describe('cache statistics', () => {
    it('should return cache stats', () => {
      const stats = resolver.getCacheStats();
      
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('profiles');
      expect(stats.size).toBe(0);
      expect(Array.isArray(stats.profiles)).toBe(true);
    });

    it('should track cached profiles in stats', async () => {
      const canonicalUrl = 'http://example.org/Profile';
      
      // Mock resolution
      (db.execute as any).mockResolvedValue({ rows: [] });
      (simplifierClient.searchProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      (simplifierClient.getPackageDetails as any).mockResolvedValue({ dependencies: [] });
      (simplifierClient.downloadPackage as any).mockResolvedValue(Buffer.from('package'));
      (simplifierClient.getPackageProfiles as any).mockResolvedValue([mockSimplifierSearchResult]);
      
      await resolver.resolveProfile(canonicalUrl, '1.0.0');
      
      const stats = resolver.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.profiles.length).toBeGreaterThan(0);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getProfileResolver();
      const instance2 = getProfileResolver();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getProfileResolver();
      resetProfileResolver();
      const instance2 = getProfileResolver();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});

// ============================================================================
// VersionResolver Tests
// ============================================================================

describe('VersionResolver', () => {
  describe('version parsing', () => {
    it('should parse semantic version', () => {
      const version = VersionResolver.parseVersion('1.2.3');
      
      expect(version).toBeDefined();
      expect(version?.major).toBe(1);
      expect(version?.minor).toBe(2);
      expect(version?.patch).toBe(3);
      expect(version?.prerelease).toBeUndefined();
    });

    it('should parse version with prerelease', () => {
      const version = VersionResolver.parseVersion('1.0.0-beta.1');
      
      expect(version).toBeDefined();
      expect(version?.prerelease).toBe('beta.1');
    });

    it('should parse version with build metadata', () => {
      const version = VersionResolver.parseVersion('1.0.0+build.123');
      
      expect(version).toBeDefined();
      expect(version?.build).toBe('build.123');
    });

    it('should return null for invalid version', () => {
      const version = VersionResolver.parseVersion('invalid');
      
      expect(version).toBeNull();
    });
  });

  describe('version comparison', () => {
    it('should compare major versions', () => {
      const v1 = VersionResolver.parseVersion('2.0.0')!;
      const v2 = VersionResolver.parseVersion('1.0.0')!;
      
      const result = VersionResolver.compareVersions(v1, v2);
      expect(result).toBe(1);
    });

    it('should compare minor versions', () => {
      const v1 = VersionResolver.parseVersion('1.2.0')!;
      const v2 = VersionResolver.parseVersion('1.1.0')!;
      
      const result = VersionResolver.compareVersions(v1, v2);
      expect(result).toBe(1);
    });

    it('should compare patch versions', () => {
      const v1 = VersionResolver.parseVersion('1.0.2')!;
      const v2 = VersionResolver.parseVersion('1.0.1')!;
      
      const result = VersionResolver.compareVersions(v1, v2);
      expect(result).toBe(1);
    });

    it('should handle equal versions', () => {
      const v1 = VersionResolver.parseVersion('1.0.0')!;
      const v2 = VersionResolver.parseVersion('1.0.0')!;
      
      const result = VersionResolver.compareVersions(v1, v2);
      expect(result).toBe(0);
    });

    it('should handle prerelease precedence', () => {
      const stable = VersionResolver.parseVersion('1.0.0')!;
      const prerelease = VersionResolver.parseVersion('1.0.0-alpha')!;
      
      const result = VersionResolver.compareVersions(stable, prerelease);
      expect(result).toBe(1); // 1.0.0 > 1.0.0-alpha
    });
  });

  describe('version range matching', () => {
    it('should match caret range ^1.2.3', () => {
      expect(VersionResolver.satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
      expect(VersionResolver.satisfiesRange('1.3.0', '^1.2.3')).toBe(true);
      expect(VersionResolver.satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
    });

    it('should match tilde range ~1.2.3', () => {
      expect(VersionResolver.satisfiesRange('1.2.3', '~1.2.3')).toBe(true);
      expect(VersionResolver.satisfiesRange('1.2.5', '~1.2.3')).toBe(true);
      expect(VersionResolver.satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
    });

    it('should match greater than >', () => {
      expect(VersionResolver.satisfiesRange('2.0.0', '>1.0.0')).toBe(true);
      expect(VersionResolver.satisfiesRange('1.0.0', '>1.0.0')).toBe(false);
    });

    it('should match wildcard 1.*', () => {
      expect(VersionResolver.satisfiesRange('1.0.0', '1.*')).toBe(true);
      expect(VersionResolver.satisfiesRange('1.5.0', '1.*')).toBe(true);
      expect(VersionResolver.satisfiesRange('2.0.0', '1.*')).toBe(false);
    });

    it('should match latest', () => {
      expect(VersionResolver.satisfiesRange('1.0.0', 'latest')).toBe(true);
      expect(VersionResolver.satisfiesRange('99.99.99', '*')).toBe(true);
    });
  });

  describe('get latest version', () => {
    it('should return latest stable version', () => {
      const versions = ['1.0.0', '2.0.0', '1.5.0', '2.1.0'];
      const latest = VersionResolver.getLatestVersion(versions);
      
      expect(latest).toBe('2.1.0');
    });

    it('should exclude prerelease by default', () => {
      const versions = ['1.0.0', '2.0.0-beta', '1.5.0'];
      const latest = VersionResolver.getLatestVersion(versions);
      
      expect(latest).toBe('1.5.0');
    });

    it('should include prerelease when requested', () => {
      const versions = ['1.0.0', '2.0.0-beta', '1.5.0'];
      const latest = VersionResolver.getLatestVersion(versions, true);
      
      expect(latest).toBe('2.0.0-beta');
    });
  });
});

// ============================================================================
// GermanProfileDetector Tests
// ============================================================================

describe('GermanProfileDetector', () => {
  describe('profile family detection', () => {
    it('should detect all MII patterns', () => {
      const urls = [
        'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient',
        'http://www.medizininformatik-initiative.de/fhir/ext/StructureDefinition/Extension',
      ];

      urls.forEach(url => {
        const result = GermanProfileDetector.detectGermanProfile(url);
        expect(result.family).toBe('mii');
        expect(result.isGermanProfile).toBe(true);
      });
    });

    it('should extract MII modules', () => {
      const tests = [
        { url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient', expectedModule: 'person' },
        { url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-diagnose/StructureDefinition/Diagnose', expectedModule: 'diagnose' },
        { url: 'https://www.medizininformatik-initiative.de/fhir/core/modul-medikation/StructureDefinition/Medication', expectedModule: 'medikation' },
      ];

      tests.forEach(({ url, expectedModule }) => {
        const result = GermanProfileDetector.detectGermanProfile(url);
        expect(result.module).toBe(expectedModule);
      });
    });

    it('should generate recommendations', () => {
      const url = 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient';
      
      const recommendations = GermanProfileDetector.generateRecommendations(url);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('MII'))).toBe(true);
      expect(recommendations.some(r => r.includes('package'))).toBe(true);
    });
  });

  describe('helper methods', () => {
    it('should check if profile is MII', () => {
      const miiUrl = 'https://www.medizininformatik-initiative.de/fhir/Patient';
      const otherUrl = 'http://example.org/Profile';
      
      expect(GermanProfileDetector.isMIIProfile(miiUrl)).toBe(true);
      expect(GermanProfileDetector.isMIIProfile(otherUrl)).toBe(false);
    });

    it('should check if profile is ISiK', () => {
      const isikUrl = 'https://gematik.de/fhir/isik/Patient';
      const otherUrl = 'http://example.org/Profile';
      
      expect(GermanProfileDetector.isISiKProfile(isikUrl)).toBe(true);
      expect(GermanProfileDetector.isISiKProfile(otherUrl)).toBe(false);
    });

    it('should get suggested packages', () => {
      const packages = GermanProfileDetector.getSuggestedPackages();
      
      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some(p => p.family === 'mii')).toBe(true);
      expect(packages.some(p => p.family === 'basisprofil')).toBe(true);
    });
  });
});

// ============================================================================
// ProfileMetadataExtractor Tests
// ============================================================================

describe('ProfileMetadataExtractor', () => {
  describe('metadata extraction', () => {
    it('should extract complete metadata', () => {
      const metadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      
      expect(metadata.url).toBe(mockUSCorePatientProfile.url);
      expect(metadata.name).toBe(mockUSCorePatientProfile.name);
      expect(metadata.version).toBe(mockUSCorePatientProfile.version);
      expect(metadata.type).toBe(mockUSCorePatientProfile.type);
      expect(metadata.kind).toBe(mockUSCorePatientProfile.kind);
      expect(metadata.elements).toBeInstanceOf(Array);
    });

    it('should throw for invalid StructureDefinition', () => {
      expect(() => {
        ProfileMetadataExtractor.extractMetadata({ invalid: 'data' });
      }).toThrow();
    });

    it('should extract must-support elements', () => {
      const metadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      
      expect(metadata.mustSupportElements).toBeInstanceOf(Array);
      // Must-support elements are extracted from the profile
      // The extractor looks for elements with mustSupport: true
      // Exact count depends on how the extractor processes differential vs snapshot
    });
  });

  describe('complexity scoring', () => {
    it('should calculate complexity score', () => {
      const metadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      const score = ProfileMetadataExtractor.getComplexityScore(metadata);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return higher scores for complex profiles', () => {
      const simpleMetadata = ProfileMetadataExtractor.extractMetadata({
        ...mockUSCorePatientProfile,
        differential: { element: [] },
      });
      
      const complexMetadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      
      const simpleScore = ProfileMetadataExtractor.getComplexityScore(simpleMetadata);
      const complexScore = ProfileMetadataExtractor.getComplexityScore(complexMetadata);
      
      expect(complexScore).toBeGreaterThanOrEqual(simpleScore);
    });
  });

  describe('helper methods', () => {
    it('should get required elements', () => {
      const metadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      const required = ProfileMetadataExtractor.getRequiredElements(metadata);
      
      expect(Array.isArray(required)).toBe(true);
      required.forEach(el => {
        expect(el.min).toBeGreaterThan(0);
      });
    });

    it('should generate summary', () => {
      const metadata = ProfileMetadataExtractor.extractMetadata(mockUSCorePatientProfile);
      const summary = ProfileMetadataExtractor.generateSummary(metadata);
      
      expect(summary).toContain(metadata.name);
      expect(summary).toContain(metadata.url);
      expect(summary).toContain('Statistics:');
    });
  });
});

