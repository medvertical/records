/**
 * Unit tests for ProfileValidator IG Package Loading
 * Task 2.8: Tests for version-specific IG package selection
 * 
 * Tests:
 * - Version-specific IG package loading
 * - Profile URL pattern matching (MII, ISiK, KBV, UV)
 * - Package availability queries
 * - HAPI integration with IG packages
 * 
 * Target: 90%+ coverage
 * File size: <400 lines
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileValidator } from './profile-validator';

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

// Mock fhir-package-versions
vi.mock('../../../config/fhir-package-versions', () => ({
  getPackagesForVersion: (version: 'R4' | 'R5' | 'R6') => {
    const packages = {
      R4: [
        { id: 'hl7.fhir.uv.extensions.r4', version: '1.0.0', name: 'HL7 UV Extensions', fhirVersion: 'R4', status: 'active' },
        { id: 'de.gematik.isik-basismodul', version: '3.0.0', name: 'ISiK Basismodul', fhirVersion: 'R4', status: 'active' },
      ],
      R5: [
        { id: 'hl7.fhir.uv.extensions.r5', version: '1.0.0', name: 'HL7 UV Extensions', fhirVersion: 'R5', status: 'active' },
      ],
      R6: [],
    };
    return packages[version] || [];
  },
  getGermanPackagesForVersion: (version: 'R4' | 'R5' | 'R6') => {
    const packages = {
      R4: [
        { id: 'de.medizininformatikinitiative.kerndatensatz.person', version: '2024.0.0', name: 'MII KDS Person', fhirVersion: 'R4', status: 'active' },
        { id: 'de.gematik.isik-basismodul', version: '3.0.0', name: 'ISiK Basismodul', fhirVersion: 'R4', status: 'active' },
        { id: 'kbv.basis', version: '1.4.0', name: 'KBV Basis', fhirVersion: 'R4', status: 'active' },
      ],
      R5: [
        { id: 'de.medizininformatikinitiative.kerndatensatz.person', version: '2025.0.0', name: 'MII KDS Person R5', fhirVersion: 'R5', status: 'active' },
      ],
      R6: [],
    };
    return packages[version] || [];
  },
  getCorePackageId: (version: 'R4' | 'R5' | 'R6') => {
    const ids = {
      R4: 'hl7.fhir.r4.core@4.0.1',
      R5: 'hl7.fhir.r5.core@5.0.0',
      R6: 'hl7.fhir.r6.core@6.0.0-ballot2',
    };
    return ids[version];
  },
}));

// ============================================================================
// Test Suite
// ============================================================================

describe('ProfileValidator - IG Package Loading (Task 2.8)', () => {
  let validator: ProfileValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new ProfileValidator();
  });

  // ==========================================================================
  // IG Package Selection
  // ==========================================================================

  describe('IG Package Selection', () => {
    it('should load MII packages for MII profiles (R4)', () => {
      const profileUrl = 'https://www.medizininformatik-initiative.de/fhir/core/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some(pkg => pkg.includes('medizininformatik'))).toBe(true);
    });

    it('should load ISiK packages for ISiK profiles (R4)', () => {
      const profileUrl = 'https://gematik.de/fhir/isik/StructureDefinition/ISiKPatient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some(pkg => pkg.includes('isik') || pkg.includes('gematik'))).toBe(true);
    });

    it('should load KBV packages for KBV profiles (R4)', () => {
      const profileUrl = 'https://fhir.kbv.de/StructureDefinition/KBV_PR_Base_Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some(pkg => pkg.includes('kbv'))).toBe(true);
    });

    it('should load UV extensions for UV profiles (R4)', () => {
      const profileUrl = 'http://hl7.org/fhir/uv/extensions/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.length).toBeGreaterThan(0);
      expect(packages.some(pkg => pkg.includes('hl7.fhir.uv'))).toBe(true);
    });

    it('should load minimal packages for core FHIR profiles', () => {
      const profileUrl = 'http://hl7.org/fhir/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      // Core profiles should load fallback German profiles
      // (as the system is designed for German healthcare context)
      expect(Array.isArray(packages)).toBe(true);
      // Should be limited (max 2 for fallback)
      expect(packages.length).toBeLessThanOrEqual(2);
    });

    it('should load fallback packages for unknown profiles (R4)', () => {
      const profileUrl = 'https://example.org/fhir/StructureDefinition/CustomPatient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      // Should load common German profiles as fallback
      expect(packages.length).toBeGreaterThan(0);
      expect(packages.length).toBeLessThanOrEqual(2); // Limited to top 2
    });
  });

  // ==========================================================================
  // Version-Specific Package Loading
  // ==========================================================================

  describe('Version-Specific Package Loading', () => {
    it('should load R4-specific MII packages', () => {
      const profileUrl = 'https://www.medizininformatik-initiative.de/fhir/core/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.length).toBeGreaterThan(0);
      // Check that version is included
      expect(packages[0]).toContain('@');
      expect(packages[0]).toContain('2024.0.0'); // R4 version
    });

    it('should load R5-specific MII packages', () => {
      const profileUrl = 'https://www.medizininformatik-initiative.de/fhir/core/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R5');

      expect(packages.length).toBeGreaterThan(0);
      // Check R5 version
      expect(packages[0]).toContain('@');
      expect(packages[0]).toContain('2025.0.0'); // R5 version
    });

    it('should handle R6 with no available packages', () => {
      const profileUrl = 'https://www.medizininformatik-initiative.de/fhir/core/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R6');

      // R6 has no packages in mock
      expect(Array.isArray(packages)).toBe(true);
    });
  });

  // ==========================================================================
  // Package Availability Query
  // ==========================================================================

  describe('Package Availability Query', () => {
    it('should list all available packages for R4', () => {
      const packages = validator.getAllAvailablePackages('R4');

      expect(packages.length).toBeGreaterThan(0);
      
      // Check structure
      const firstPackage = packages[0];
      expect(firstPackage).toHaveProperty('id');
      expect(firstPackage).toHaveProperty('version');
      expect(firstPackage).toHaveProperty('name');
      expect(firstPackage).toHaveProperty('type');
      
      // Check types
      expect(['german', 'international']).toContain(firstPackage.type);
    });

    it('should separate German and international packages', () => {
      const packages = validator.getAllAvailablePackages('R4');

      const germanPackages = packages.filter(pkg => pkg.type === 'german');
      const internationalPackages = packages.filter(pkg => pkg.type === 'international');

      expect(germanPackages.length).toBeGreaterThan(0);
      expect(internationalPackages.length).toBeGreaterThan(0);
      
      // Check German packages
      expect(germanPackages.some(pkg => pkg.id.includes('medizininformatik'))).toBe(true);
      expect(germanPackages.some(pkg => pkg.id.includes('kbv'))).toBe(true);
    });

    it('should list available packages for R5', () => {
      const packages = validator.getAllAvailablePackages('R5');

      expect(Array.isArray(packages)).toBe(true);
      // R5 should have at least one package in mock
      expect(packages.length).toBeGreaterThan(0);
    });

    it('should handle empty package list for R6', () => {
      const packages = validator.getAllAvailablePackages('R6');

      expect(Array.isArray(packages)).toBe(true);
      // R6 has no packages in mock, so should be empty
      expect(packages.length).toBe(0);
    });
  });

  // ==========================================================================
  // Package Deduplication
  // ==========================================================================

  describe('Package Deduplication', () => {
    it('should remove duplicate packages', () => {
      // Profile that might match multiple patterns
      const profileUrl = 'https://gematik.de/fhir/isik/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      // Check no duplicates
      const uniquePackages = [...new Set(packages)];
      expect(packages.length).toBe(uniquePackages.length);
    });
  });

  // ==========================================================================
  // Pattern Matching
  // ==========================================================================

  describe('Pattern Matching', () => {
    it('should match MII pattern case-insensitively', () => {
      const profileUrl1 = 'https://www.MEDIZININFORMATIK-initiative.de/fhir/Patient';
      const profileUrl2 = 'https://example.org/fhir/MII/Patient';
      
      const packages1 = validator.getAvailableIgPackages(profileUrl1, 'R4');
      const packages2 = validator.getAvailableIgPackages(profileUrl2, 'R4');

      expect(packages1.length).toBeGreaterThan(0);
      expect(packages2.length).toBeGreaterThan(0);
    });

    it('should match ISiK/Gematik patterns', () => {
      const profileUrl1 = 'https://GEMATIK.de/fhir/Patient';
      const profileUrl2 = 'https://example.org/fhir/ISIK/Patient';
      
      const packages1 = validator.getAvailableIgPackages(profileUrl1, 'R4');
      const packages2 = validator.getAvailableIgPackages(profileUrl2, 'R4');

      expect(packages1.some(pkg => pkg.includes('isik') || pkg.includes('gematik'))).toBe(true);
      expect(packages2.some(pkg => pkg.includes('isik') || pkg.includes('gematik'))).toBe(true);
    });

    it('should match KBV pattern', () => {
      const profileUrl = 'https://fhir.KBV.de/StructureDefinition/Patient';
      const packages = validator.getAvailableIgPackages(profileUrl, 'R4');

      expect(packages.some(pkg => pkg.includes('kbv'))).toBe(true);
    });

    it('should match UV patterns', () => {
      const profileUrl1 = 'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient';
      const profileUrl2 = 'https://example.org/uv/extensions/Patient';
      
      const packages1 = validator.getAvailableIgPackages(profileUrl1, 'R4');
      const packages2 = validator.getAvailableIgPackages(profileUrl2, 'R4');

      expect(packages1.some(pkg => pkg.includes('hl7.fhir.uv'))).toBe(true);
      expect(packages2.some(pkg => pkg.includes('hl7.fhir.uv'))).toBe(true);
    });
  });
});

