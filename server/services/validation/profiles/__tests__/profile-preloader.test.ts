/**
 * Profile Preloader Tests
 * Task 10.8: Test profile preloading functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfilePreloader, ALL_COMMON_PROFILES } from '../profile-preloader';

// Mock dependencies
vi.mock('../../utils/profile-resolver', () => ({
  getProfileResolver: () => ({
    resolve: vi.fn().mockResolvedValue({
      found: true,
      source: 'simplifier',
      profile: { resourceType: 'StructureDefinition' },
    }),
  }),
}));

vi.mock('../../../fhir/profile-indexer', () => ({
  getProfileIndexer: () => ({
    findProfileByCanonical: vi.fn().mockResolvedValue(null), // Simulate not cached
  }),
}));

describe('ProfilePreloader', () => {
  let preloader: ProfilePreloader;

  beforeEach(() => {
    preloader = new ProfilePreloader();
  });

  // ========================================================================
  // Common Profile Counts
  // ========================================================================

  describe('Common Profiles', () => {
    it('should have defined common German profiles', () => {
      expect(ALL_COMMON_PROFILES.length).toBeGreaterThan(0);
      expect(ALL_COMMON_PROFILES.length).toBeGreaterThanOrEqual(15); // At least 15 profiles
    });

    it('should include MII profiles', () => {
      const miiProfiles = ALL_COMMON_PROFILES.filter(url => 
        url.includes('medizininformatik-initiative')
      );
      expect(miiProfiles.length).toBeGreaterThan(0);
    });

    it('should include ISiK profiles', () => {
      const isikProfiles = ALL_COMMON_PROFILES.filter(url =>
        url.includes('gematik.de/fhir/isik')
      );
      expect(isikProfiles.length).toBeGreaterThan(0);
    });

    it('should include KBV profiles', () => {
      const kbvProfiles = ALL_COMMON_PROFILES.filter(url =>
        url.includes('fhir.kbv.de')
      );
      expect(kbvProfiles.length).toBeGreaterThan(0);
    });

    it('should include Basisprofil DE profiles', () => {
      const basisProfiles = ALL_COMMON_PROFILES.filter(url =>
        url.includes('fhir.de/StructureDefinition')
      );
      expect(basisProfiles.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Preload Status
  // ========================================================================

  describe('Preload Status', () => {
    it('should track preload in progress status', () => {
      expect(preloader.isPreloadInProgress()).toBe(false);
    });

    it('should return null stats before preload', () => {
      const stats = preloader.getLastPreloadStats();
      expect(stats).toBeNull();
    });
  });

  // ========================================================================
  // Custom Profile Preloading
  // ========================================================================

  describe('Custom Profile Preloading', () => {
    it('should preload custom profiles', async () => {
      const customProfiles = [
        'http://example.org/fhir/StructureDefinition/CustomPatient',
        'http://example.org/fhir/StructureDefinition/CustomObservation',
      ];

      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      expect(stats.totalProfiles).toBe(2);
      expect(stats.results.size).toBe(2);
    });

    it('should handle empty profile list', async () => {
      const stats = await preloader.preloadProfiles([], 'R4');

      expect(stats.totalProfiles).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });

    it('should provide detailed results per profile', async () => {
      const customProfiles = [
        'http://example.org/fhir/StructureDefinition/Profile1',
      ];

      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      const result = stats.results.get(customProfiles[0]);
      expect(result).toBeDefined();
      expect(result?.canonicalUrl).toBe(customProfiles[0]);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('cached');
      expect(result).toHaveProperty('timeMs');
    });
  });

  // ========================================================================
  // Statistics
  // ========================================================================

  describe('Statistics', () => {
    it('should track success count', async () => {
      const customProfiles = [
        'http://example.org/fhir/StructureDefinition/Profile1',
        'http://example.org/fhir/StructureDefinition/Profile2',
      ];

      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      expect(stats.successCount + stats.cachedCount + stats.failureCount).toBe(stats.totalProfiles);
    });

    it('should measure total time', async () => {
      const customProfiles = [
        'http://example.org/fhir/StructureDefinition/Profile1',
      ];

      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      expect(stats.totalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should store last preload stats', async () => {
      const customProfiles = [
        'http://example.org/fhir/StructureDefinition/Profile1',
      ];

      await preloader.preloadProfiles(customProfiles, 'R4');

      const lastStats = preloader.getLastPreloadStats();
      expect(lastStats).not.toBeNull();
    });
  });

  // ========================================================================
  // Error Handling
  // ========================================================================

  describe('Error Handling', () => {
    it('should handle resolution errors gracefully', async () => {
      const customProfiles = [
        'http://invalid.example.org/missing-profile',
      ];

      // Should not throw, but collect errors
      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      expect(stats.totalProfiles).toBe(1);
      // Either success or failure, but should complete
      expect(stats.successCount + stats.failureCount + stats.cachedCount).toBe(1);
    });

    it('should collect error messages', async () => {
      const customProfiles = [
        'http://invalid.example.org/missing-profile',
      ];

      const stats = await preloader.preloadProfiles(customProfiles, 'R4');

      // May or may not have errors depending on mock behavior
      expect(stats.errors).toBeDefined();
      expect(Array.isArray(stats.errors)).toBe(true);
    });
  });
});

