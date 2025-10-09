/**
 * FHIR Package Versions Configuration
 * 
 * Task 2.2: Comprehensive version-to-package mapping for R4, R5, R6
 * 
 * This configuration maps FHIR versions to their corresponding:
 * - Core specification packages (hl7.fhir.rX.core)
 * - Common profile packages (ISiK, MII, KBV for German healthcare)
 * - International extension packages
 * - Terminology packages
 * 
 * Used by:
 * - HAPI Validator for version-specific validation
 * - Profile Manager for package installation
 * - Terminology services for version-specific lookups
 */

// ============================================================================
// Core FHIR Specification Packages
// ============================================================================

export interface FhirCorePackage {
  version: string;           // FHIR version (e.g., "4.0", "5.0", "6.0")
  corePackage: string;       // Core package ID (e.g., "hl7.fhir.r4.core@4.0.1")
  fhirVersion: string;       // Full FHIR version (e.g., "4.0.1")
  packageUrl?: string;       // Optional download URL
  status: 'stable' | 'trial-use' | 'draft' | 'ballot';
}

export const FHIR_CORE_PACKAGES: Record<'R4' | 'R5' | 'R6', FhirCorePackage> = {
  R4: {
    version: '4.0',
    corePackage: 'hl7.fhir.r4.core@4.0.1',
    fhirVersion: '4.0.1',
    packageUrl: 'https://packages.simplifier.net/hl7.fhir.r4.core/4.0.1',
    status: 'stable',
  },
  R5: {
    version: '5.0',
    corePackage: 'hl7.fhir.r5.core@5.0.0',
    fhirVersion: '5.0.0',
    packageUrl: 'https://packages.simplifier.net/hl7.fhir.r5.core/5.0.0',
    status: 'trial-use',
  },
  R6: {
    version: '6.0',
    corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2',
    fhirVersion: '6.0.0-ballot2',
    packageUrl: 'https://packages.simplifier.net/hl7.fhir.r6.core/6.0.0-ballot2',
    status: 'ballot',
  },
} as const;

// ============================================================================
// German Healthcare Profile Packages
// ============================================================================

export interface ProfilePackage {
  id: string;                // Package ID
  name: string;              // Human-readable name
  version: string;           // Package version
  fhirVersion: 'R4' | 'R5' | 'R6';  // Compatible FHIR version
  publisher: string;         // Package publisher
  description: string;       // Package description
  url?: string;              // Package URL
  canonical?: string;        // Canonical base URL
  status: 'active' | 'draft' | 'retired';
}

/**
 * German Profile Packages (MII, ISiK, KBV)
 * As specified in PRD section 10.1: Profile Sources
 */
export const GERMAN_PROFILE_PACKAGES: ProfilePackage[] = [
  // Medizininformatik-Initiative (MII)
  {
    id: 'de.medizininformatikinitiative.kerndatensatz.person',
    name: 'MII KDS Person',
    version: '2024.0.0',
    fhirVersion: 'R4',
    publisher: 'Medizininformatik Initiative',
    description: 'MII Core Data Set - Person module',
    url: 'https://simplifier.net/packages/de.medizininformatikinitiative.kerndatensatz.person',
    canonical: 'https://www.medizininformatik-initiative.de/fhir/core/modul-person',
    status: 'active',
  },
  {
    id: 'de.medizininformatikinitiative.kerndatensatz.labor',
    name: 'MII KDS Labor',
    version: '2024.0.0',
    fhirVersion: 'R4',
    publisher: 'Medizininformatik Initiative',
    description: 'MII Core Data Set - Laboratory module',
    url: 'https://simplifier.net/packages/de.medizininformatikinitiative.kerndatensatz.labor',
    canonical: 'https://www.medizininformatik-initiative.de/fhir/core/modul-labor',
    status: 'active',
  },
  
  // ISiK (Informationstechnische Systeme im Krankenhaus)
  {
    id: 'de.gematik.isik-basismodul',
    name: 'ISiK Basismodul',
    version: '4.0.0',
    fhirVersion: 'R4',
    publisher: 'gematik GmbH',
    description: 'ISiK Base Module for German hospital systems',
    url: 'https://simplifier.net/packages/de.gematik.isik-basismodul',
    canonical: 'https://gematik.de/fhir/isik',
    status: 'active',
  },
  
  // KBV (Kassenärztliche Bundesvereinigung)
  {
    id: 'kbv.basis',
    name: 'KBV Basis Profile',
    version: '1.4.0',
    fhirVersion: 'R4',
    publisher: 'Kassenärztliche Bundesvereinigung',
    description: 'KBV Base profiles for German ambulatory care',
    url: 'https://simplifier.net/packages/kbv.basis',
    canonical: 'https://fhir.kbv.de',
    status: 'active',
  },
];

// ============================================================================
// International Extension Packages
// ============================================================================

export const INTERNATIONAL_EXTENSION_PACKAGES: ProfilePackage[] = [
  {
    id: 'hl7.fhir.uv.extensions.r4',
    name: 'HL7 FHIR UV Extensions R4',
    version: '1.0.0',
    fhirVersion: 'R4',
    publisher: 'HL7 International',
    description: 'Universal extensions for FHIR R4',
    url: 'https://simplifier.net/packages/hl7.fhir.uv.extensions.r4',
    canonical: 'http://hl7.org/fhir/extensions',
    status: 'active',
  },
  {
    id: 'hl7.fhir.uv.extensions.r5',
    name: 'HL7 FHIR UV Extensions R5',
    version: '1.0.0',
    fhirVersion: 'R5',
    publisher: 'HL7 International',
    description: 'Universal extensions for FHIR R5',
    url: 'https://simplifier.net/packages/hl7.fhir.uv.extensions.r5',
    canonical: 'http://hl7.org/fhir/extensions',
    status: 'active',
  },
  {
    id: 'hl7.fhir.uv.ips',
    name: 'International Patient Summary',
    version: '1.1.0',
    fhirVersion: 'R4',
    publisher: 'HL7 International',
    description: 'International Patient Summary Implementation Guide',
    url: 'https://simplifier.net/packages/hl7.fhir.uv.ips',
    canonical: 'http://hl7.org/fhir/uv/ips',
    status: 'active',
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get core package for a FHIR version
 */
export function getCorePackage(version: 'R4' | 'R5' | 'R6'): FhirCorePackage {
  return FHIR_CORE_PACKAGES[version];
}

/**
 * Get core package ID for a FHIR version
 */
export function getCorePackageId(version: 'R4' | 'R5' | 'R6'): string {
  return FHIR_CORE_PACKAGES[version].corePackage;
}

/**
 * Get all packages compatible with a FHIR version
 */
export function getPackagesForVersion(version: 'R4' | 'R5' | 'R6'): ProfilePackage[] {
  const allPackages = [
    ...GERMAN_PROFILE_PACKAGES,
    ...INTERNATIONAL_EXTENSION_PACKAGES,
  ];
  
  return allPackages.filter(pkg => pkg.fhirVersion === version);
}

/**
 * Get German profile packages for a FHIR version
 */
export function getGermanPackagesForVersion(version: 'R4' | 'R5' | 'R6'): ProfilePackage[] {
  return GERMAN_PROFILE_PACKAGES.filter(pkg => pkg.fhirVersion === version);
}

/**
 * Get package by ID
 */
export function getPackageById(packageId: string): ProfilePackage | undefined {
  const allPackages = [
    ...GERMAN_PROFILE_PACKAGES,
    ...INTERNATIONAL_EXTENSION_PACKAGES,
  ];
  
  return allPackages.find(pkg => pkg.id === packageId);
}

/**
 * Check if a version is supported
 */
export function isSupportedVersion(version: string): version is 'R4' | 'R5' | 'R6' {
  return version === 'R4' || version === 'R5' || version === 'R6';
}

/**
 * Get recommended packages for offline mode
 * These are the packages that should be pre-cached for offline validation
 */
export function getRecommendedOfflinePackages(): ProfilePackage[] {
  return [
    // Core packages are handled separately
    // German profiles (highest priority for German healthcare)
    ...GERMAN_PROFILE_PACKAGES.filter(pkg => pkg.status === 'active'),
    // International extensions (for interoperability)
    ...INTERNATIONAL_EXTENSION_PACKAGES.filter(pkg => pkg.fhirVersion === 'R4'),
  ];
}

/**
 * Get package installation priority order
 * Used for determining which packages to install first in offline mode
 */
export function getPackageInstallationPriority(): string[] {
  return [
    // 1. Core packages (handled by HAPI)
    'hl7.fhir.r4.core',
    'hl7.fhir.r5.core',
    
    // 2. German base profiles
    'kbv.basis',
    'de.gematik.isik-basismodul',
    
    // 3. MII profiles
    'de.medizininformatikinitiative.kerndatensatz.person',
    'de.medizininformatikinitiative.kerndatensatz.labor',
    
    // 4. International extensions
    'hl7.fhir.uv.extensions.r4',
    'hl7.fhir.uv.ips',
  ];
}

// ============================================================================
// Version-specific Configuration
// ============================================================================

export interface VersionConfig {
  fhirVersion: 'R4' | 'R5' | 'R6';
  corePackage: string;
  terminologyServer: string;
  supportStatus: 'full' | 'partial' | 'experimental';
  limitations?: string[];
}

export const VERSION_CONFIGURATIONS: Record<'R4' | 'R5' | 'R6', VersionConfig> = {
  R4: {
    fhirVersion: 'R4',
    corePackage: 'hl7.fhir.r4.core@4.0.1',
    terminologyServer: 'https://tx.fhir.org/r4',
    supportStatus: 'full',
  },
  R5: {
    fhirVersion: 'R5',
    corePackage: 'hl7.fhir.r5.core@5.0.0',
    terminologyServer: 'https://tx.fhir.org/r5',
    supportStatus: 'full',
  },
  R6: {
    fhirVersion: 'R6',
    corePackage: 'hl7.fhir.r6.core@6.0.0-ballot2',
    terminologyServer: 'https://tx.fhir.org/r6',
    supportStatus: 'partial',
    limitations: [
      'Terminology validation limited (ballot status)',
      'Some profile packages may not be available',
      'Reference validation may have issues with new features',
    ],
  },
} as const;

/**
 * Get version configuration
 */
export function getVersionConfig(version: 'R4' | 'R5' | 'R6'): VersionConfig {
  return VERSION_CONFIGURATIONS[version];
}

/**
 * Check if version has full support
 */
export function hasFullSupport(version: 'R4' | 'R5' | 'R6'): boolean {
  return VERSION_CONFIGURATIONS[version].supportStatus === 'full';
}

