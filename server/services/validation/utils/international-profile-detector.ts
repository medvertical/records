/**
 * International Profile Detector
 * 
 * Automatically detects and identifies international FHIR profiles (Australian, US Core, UK Core, etc.)
 * based on canonical URL patterns. Provides metadata and package recommendations.
 * 
 * Features:
 * - Australian Base profile detection (HL7 AU)
 * - US Core profile detection
 * - UK Core profile detection (NHS Digital)
 * - Canadian Baseline profile detection
 * - IPS (International Patient Summary) detection
 * - Package recommendation for each profile family
 * 
 * Responsibilities: Profile detection and classification ONLY
 * - Does not download profiles (handled by ProfileResolver)
 * - Does not validate resources (handled by ValidationEngine)
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

// ============================================================================
// Types
// ============================================================================

export type InternationalProfileFamily = 
  | 'au-base'      // HL7 Australia Base
  | 'us-core'      // US Core
  | 'uk-core'      // UK Core (NHS Digital)
  | 'ca-baseline'  // Canadian Baseline
  | 'ips'          // International Patient Summary
  | 'ch-core'      // Swiss Core (HL7 Switzerland)
  | 'nl-core'      // Dutch Core (Nictiz)
  | 'unknown';     // Not a recognized international profile

export interface InternationalProfileDetectionResult {
  /** Whether this is an international profile */
  isInternationalProfile: boolean;
  
  /** Profile family */
  family: InternationalProfileFamily;
  
  /** Confidence level (0-100) */
  confidence: number;
  
  /** Recommended package ID to download */
  recommendedPackage?: string;
  
  /** Package version */
  packageVersion?: string;
  
  /** Description of the profile family */
  description: string;
  
  /** Country/region */
  region?: string;
  
  /** Base URL pattern matched */
  patternMatched?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const INTERNATIONAL_PROFILE_CONFIGS: Record<InternationalProfileFamily, {
  patterns: string[];
  packages: { id: string; version: string }[];
  description: string;
  region: string;
}> = {
  'au-base': {
    patterns: [
      'hl7.org.au/fhir',
      'http://hl7.org.au/fhir',
      'https://hl7.org.au/fhir'
    ],
    packages: [
      { id: 'hl7.fhir.au.base', version: '5.0.0' }
    ],
    description: 'HL7 Australia Base Implementation Guide',
    region: 'Australia'
  },
  
  'us-core': {
    patterns: [
      'hl7.org/fhir/us/core',
      'http://hl7.org/fhir/us/core',
      'https://hl7.org/fhir/us/core'
    ],
    packages: [
      { id: 'hl7.fhir.us.core', version: '6.1.0' }
    ],
    description: 'US Core Implementation Guide',
    region: 'United States'
  },
  
  'uk-core': {
    patterns: [
      'fhir.hl7.org.uk',
      'http://fhir.hl7.org.uk',
      'https://fhir.hl7.org.uk',
      'hl7.org.uk/fhir'
    ],
    packages: [
      { id: 'uk.nhsdigital.r4', version: '2.0.0' }
    ],
    description: 'UK Core Implementation Guide (NHS Digital)',
    region: 'United Kingdom'
  },
  
  'ca-baseline': {
    patterns: [
      'fhir.infoway-inforoute.ca',
      'http://fhir.infoway-inforoute.ca',
      'https://fhir.infoway-inforoute.ca',
      'hl7.org/fhir/ca'
    ],
    packages: [
      { id: 'hl7.fhir.ca-baseline', version: '1.2.0' }
    ],
    description: 'Canadian Baseline Implementation Guide',
    region: 'Canada'
  },
  
  'ips': {
    patterns: [
      'hl7.org/fhir/uv/ips',
      'http://hl7.org/fhir/uv/ips',
      'https://hl7.org/fhir/uv/ips'
    ],
    packages: [
      { id: 'hl7.fhir.uv.ips', version: '1.1.0' }
    ],
    description: 'International Patient Summary',
    region: 'International'
  },
  
  'ch-core': {
    patterns: [
      'fhir.ch',
      'http://fhir.ch',
      'https://fhir.ch',
      'hl7.org/fhir/ch'
    ],
    packages: [
      { id: 'ch.fhir.ig.ch-core', version: '4.0.1' }
    ],
    description: 'Swiss Core Implementation Guide',
    region: 'Switzerland'
  },
  
  'nl-core': {
    patterns: [
      'nictiz.nl/fhir',
      'http://nictiz.nl/fhir',
      'https://nictiz.nl/fhir',
      'hl7.nl/fhir'
    ],
    packages: [
      { id: 'nictiz.fhir.nl.r4', version: '2.0.0' }
    ],
    description: 'Dutch Core Implementation Guide (Nictiz)',
    region: 'Netherlands'
  },
  
  'unknown': {
    patterns: [],
    packages: [],
    description: 'Unknown profile family',
    region: 'Unknown'
  }
};

// ============================================================================
// Main Detection Function
// ============================================================================

/**
 * Detect international FHIR profile from canonical URL
 * 
 * @param profileUrl - Canonical URL of the profile
 * @returns Detection result with family, confidence, and package recommendation
 */
export function detectInternationalProfile(profileUrl: string): InternationalProfileDetectionResult {
  if (!profileUrl || typeof profileUrl !== 'string') {
    return createUnknownResult();
  }

  const normalizedUrl = profileUrl.toLowerCase().trim();

  // Check each profile family
  for (const [family, config] of Object.entries(INTERNATIONAL_PROFILE_CONFIGS)) {
    if (family === 'unknown') continue;

    for (const pattern of config.patterns) {
      if (normalizedUrl.includes(pattern.toLowerCase())) {
        const typedFamily = family as InternationalProfileFamily;
        return {
          isInternationalProfile: true,
          family: typedFamily,
          confidence: 95,
          recommendedPackage: config.packages[0]?.id,
          packageVersion: config.packages[0]?.version,
          description: config.description,
          region: config.region,
          patternMatched: pattern
        };
      }
    }
  }

  return createUnknownResult();
}

/**
 * Get recommended package for a profile URL
 * 
 * @param profileUrl - Canonical URL of the profile
 * @returns Package ID with version (e.g., "hl7.fhir.au.base#5.0.0") or null
 */
export function getRecommendedPackage(profileUrl: string): string | null {
  const detection = detectInternationalProfile(profileUrl);
  
  if (!detection.isInternationalProfile || !detection.recommendedPackage) {
    return null;
  }

  return `${detection.recommendedPackage}#${detection.packageVersion}`;
}

/**
 * Check if a profile URL is an international profile
 * 
 * @param profileUrl - Canonical URL to check
 * @returns True if international profile detected
 */
export function isInternationalProfile(profileUrl: string): boolean {
  const detection = detectInternationalProfile(profileUrl);
  return detection.isInternationalProfile;
}

/**
 * Get all supported international profile families
 * 
 * @returns Array of supported profile family names
 */
export function getSupportedFamilies(): InternationalProfileFamily[] {
  return Object.keys(INTERNATIONAL_PROFILE_CONFIGS)
    .filter(family => family !== 'unknown') as InternationalProfileFamily[];
}

/**
 * Get configuration for a specific profile family
 * 
 * @param family - Profile family to get config for
 * @returns Configuration object or null if not found
 */
export function getProfileFamilyConfig(family: InternationalProfileFamily) {
  return INTERNATIONAL_PROFILE_CONFIGS[family] || null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create unknown/not-detected result
 */
function createUnknownResult(): InternationalProfileDetectionResult {
  return {
    isInternationalProfile: false,
    family: 'unknown',
    confidence: 0,
    description: 'Profile is not a recognized international profile family',
    region: 'Unknown'
  };
}

/**
 * Validate profile URL format
 * 
 * @param url - URL to validate
 * @returns True if valid FHIR profile URL format
 */
export function isValidProfileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Basic FHIR URL validation
  const urlPattern = /^https?:\/\/.+\/StructureDefinition\/.+$/i;
  return urlPattern.test(url);
}

/**
 * Extract profile family from package ID
 * 
 * @param packageId - Package ID (e.g., "hl7.fhir.au.base")
 * @returns Profile family or unknown
 */
export function extractFamilyFromPackageId(packageId: string): InternationalProfileFamily {
  const normalized = packageId.toLowerCase();
  
  if (normalized.includes('au.base') || normalized.includes('hl7.fhir.au')) {
    return 'au-base';
  }
  if (normalized.includes('us.core')) {
    return 'us-core';
  }
  if (normalized.includes('uk.') || normalized.includes('nhsdigital')) {
    return 'uk-core';
  }
  if (normalized.includes('ca') || normalized.includes('canada')) {
    return 'ca-baseline';
  }
  if (normalized.includes('uv.ips')) {
    return 'ips';
  }
  if (normalized.includes('ch.') || normalized.includes('swiss')) {
    return 'ch-core';
  }
  if (normalized.includes('nl.') || normalized.includes('nictiz')) {
    return 'nl-core';
  }
  
  return 'unknown';
}

