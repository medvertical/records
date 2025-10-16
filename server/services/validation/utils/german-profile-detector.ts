/**
 * German Profile Detector
 * 
 * Automatically detects and identifies German FHIR profiles (MII, ISiK, KBV, Basisprofil)
 * based on canonical URL patterns. Provides metadata and configuration recommendations.
 * 
 * Features:
 * - MII (Medizininformatik-Initiative) profile detection
 * - ISiK (Informationstechnische Systeme im Krankenhaus) detection
 * - KBV (Kassenärztliche Bundesvereinigung) detection
 * - German Basisprofil detection
 * - HL7 Deutschland profile detection
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

export type GermanProfileFamily = 
  | 'mii'           // Medizininformatik-Initiative
  | 'isik'          // Informationstechnische Systeme im Krankenhaus
  | 'kbv'           // Kassenärztliche Bundesvereinigung
  | 'basisprofil'   // German Basisprofil
  | 'hl7-de'        // HL7 Deutschland
  | 'gematik'       // gematik profiles
  | 'unknown';      // Not a recognized German profile

export interface GermanProfileDetectionResult {
  /** Whether this is a German profile */
  isGermanProfile: boolean;
  
  /** Profile family */
  family: GermanProfileFamily;
  
  /** Confidence level (0-100) */
  confidence: number;
  
  /** Module/category within family (e.g., "diagnose", "person") */
  module?: string;
  
  /** Recommended package ID to download */
  recommendedPackage?: string;
  
  /** Package version */
  packageVersion?: string;
  
  /** Description of the profile family */
  description: string;
  
  /** Use case */
  useCase?: string;
  
  /** Base URL pattern matched */
  patternMatched?: string;
}

export interface GermanProfileConfig {
  /** Profile family */
  family: GermanProfileFamily;
  
  /** Base URL patterns */
  patterns: string[];
  
  /** Package mapping */
  packages: string[];
  
  /** Description */
  description: string;
  
  /** Common use cases */
  useCases: string[];
  
  /** FHIR version */
  fhirVersion: 'R4' | 'R5' | 'R6';
}

// ============================================================================
// Profile Patterns Configuration
// ============================================================================

const GERMAN_PROFILE_CONFIGS: Record<GermanProfileFamily, GermanProfileConfig> = {
  mii: {
    family: 'mii',
    patterns: [
      'https://www.medizininformatik-initiative.de/fhir/',
      'http://www.medizininformatik-initiative.de/fhir/',
      'medizininformatikinitiative',
      'mii-ig',
    ],
    packages: [
      'de.medizininformatikinitiative.kerndatensatz.person#2025.0.1',
      'de.medizininformatikinitiative.kerndatensatz.diagnose',
      'de.medizininformatikinitiative.kerndatensatz.medikation',
      'de.medizininformatikinitiative.kerndatensatz.laborbefund',
      'de.medizininformatikinitiative.kerndatensatz.prozedur',
      'de.medizininformatikinitiative.kerndatensatz.fall',
    ],
    description: 'Medizininformatik-Initiative (MII) - German Medical Informatics Initiative core dataset profiles',
    useCases: [
      'Research data collection',
      'University hospital systems',
      'Clinical research networks',
      'Data integration projects',
    ],
    fhirVersion: 'R4',
  },
  isik: {
    family: 'isik',
    patterns: [
      'https://gematik.de/fhir/isik/',
      'http://gematik.de/fhir/isik/',
      'gematik.de/fhir/ISiK',
      'isik-basismodul',
    ],
    packages: [
      'de.gematik.isik-basismodul',
      'de.gematik.isik-stufe2',
      'de.gematik.isik-stufe3',
    ],
    description: 'ISiK (Informationstechnische Systeme im Krankenhaus) - Hospital information systems interoperability',
    useCases: [
      'Hospital information systems',
      'German eHealth infrastructure',
      'Patient administration',
      'Clinical documentation',
    ],
    fhirVersion: 'R4',
  },
  kbv: {
    family: 'kbv',
    patterns: [
      'https://fhir.kbv.de/',
      'http://fhir.kbv.de/',
      'kbv.de/fhir',
    ],
    packages: [
      'kbv.basis',
      'kbv.ita.erp',
      'kbv.ita.for',
      'kbv.mio',
    ],
    description: 'KBV (Kassenärztliche Bundesvereinigung) - German statutory health insurance profiles',
    useCases: [
      'Outpatient care',
      'E-prescriptions (eRezept)',
      'Medical Information Objects (MIO)',
      'Billing and reimbursement',
    ],
    fhirVersion: 'R4',
  },
  basisprofil: {
    family: 'basisprofil',
    patterns: [
      'http://fhir.de/StructureDefinition/',
      'https://fhir.de/StructureDefinition/',
      'de.basisprofil',
    ],
    packages: [
      'de.basisprofil.r4',
      'de.basisprofil.r4.version-1.5.0',
    ],
    description: 'German Basisprofil - Base profiles for German healthcare IT',
    useCases: [
      'Foundation for German profiles',
      'Common data elements',
      'Address and name patterns',
      'German-specific extensions',
    ],
    fhirVersion: 'R4',
  },
  'hl7-de': {
    family: 'hl7-de',
    patterns: [
      'http://hl7.de/fhir/',
      'https://hl7.de/fhir/',
    ],
    packages: [
      'de.hl7.core',
    ],
    description: 'HL7 Deutschland - German realm-specific profiles',
    useCases: [
      'German healthcare standards',
      'Localization profiles',
      'German terminology bindings',
    ],
    fhirVersion: 'R4',
  },
  gematik: {
    family: 'gematik',
    patterns: [
      'https://gematik.de/fhir/',
      'http://gematik.de/fhir/',
      'gematik.de',
    ],
    packages: [
      'de.gematik.erezept-workflow',
      'de.gematik.epa',
    ],
    description: 'gematik - German national agency for digital health infrastructure',
    useCases: [
      'E-prescriptions',
      'Electronic patient records',
      'Health cards',
      'Telematics infrastructure',
    ],
    fhirVersion: 'R4',
  },
  unknown: {
    family: 'unknown',
    patterns: [],
    packages: [],
    description: 'Not a recognized German profile',
    useCases: [],
    fhirVersion: 'R4',
  },
};

// ============================================================================
// German Profile Detector
// ============================================================================

export class GermanProfileDetector {
  /**
   * Detect if a canonical URL belongs to a German profile
   * 
   * @param canonicalUrl - Profile canonical URL
   * @returns Detection result
   */
  static detectGermanProfile(canonicalUrl: string): GermanProfileDetectionResult {
    if (!canonicalUrl) {
      return this.createUnknownResult();
    }

    const url = canonicalUrl.toLowerCase();

    // Check each profile family
    for (const [family, config] of Object.entries(GERMAN_PROFILE_CONFIGS)) {
      if (family === 'unknown') continue;

      for (const pattern of config.patterns) {
        if (url.includes(pattern.toLowerCase())) {
          return this.createDetectionResult(
            family as GermanProfileFamily,
            canonicalUrl,
            config,
            pattern
          );
        }
      }
    }

    return this.createUnknownResult();
  }

  /**
   * Create detection result for a matched German profile
   */
  private static createDetectionResult(
    family: GermanProfileFamily,
    canonicalUrl: string,
    config: GermanProfileConfig,
    patternMatched: string
  ): GermanProfileDetectionResult {
    const module = this.extractModule(canonicalUrl, family);
    const recommendedPackage = this.getRecommendedPackage(family, module);
    
    // Calculate confidence based on pattern specificity
    let confidence = 90;
    if (canonicalUrl.startsWith('https://')) confidence += 5;
    if (module) confidence += 5;

    return {
      isGermanProfile: true,
      family,
      confidence: Math.min(confidence, 100),
      module,
      recommendedPackage,
      packageVersion: 'latest',
      description: config.description,
      useCase: config.useCases[0],
      patternMatched,
    };
  }

  /**
   * Create unknown result
   */
  private static createUnknownResult(): GermanProfileDetectionResult {
    return {
      isGermanProfile: false,
      family: 'unknown',
      confidence: 0,
      description: 'Not a recognized German profile',
    };
  }

  /**
   * Extract module/category from canonical URL
   */
  private static extractModule(canonicalUrl: string, family: GermanProfileFamily): string | undefined {
    const url = canonicalUrl.toLowerCase();

    // MII modules
    if (family === 'mii') {
      if (url.includes('person')) return 'person';
      if (url.includes('diagnose')) return 'diagnose';
      if (url.includes('medikation')) return 'medikation';
      if (url.includes('labor')) return 'laborbefund';
      if (url.includes('prozedur')) return 'prozedur';
      if (url.includes('fall')) return 'fall';
    }

    // ISiK modules
    if (family === 'isik') {
      if (url.includes('basismodul')) return 'basismodul';
      if (url.includes('stufe2')) return 'stufe2';
      if (url.includes('stufe3')) return 'stufe3';
    }

    // KBV modules
    if (family === 'kbv') {
      if (url.includes('erp') || url.includes('erezept')) return 'erp';
      if (url.includes('for')) return 'for';
      if (url.includes('mio')) return 'mio';
    }

    return undefined;
  }

  /**
   * Get recommended package for a profile family and module
   */
  private static getRecommendedPackage(family: GermanProfileFamily, module?: string): string | undefined {
    const config = GERMAN_PROFILE_CONFIGS[family];
    
    if (!config || config.packages.length === 0) {
      return undefined;
    }

    // If module specified, try to find matching package
    if (module) {
      const matchingPackage = config.packages.find(pkg => pkg.toLowerCase().includes(module.toLowerCase()));
      if (matchingPackage) {
        return matchingPackage;
      }
    }

    // Return first package as default
    return config.packages[0];
  }

  /**
   * Get all German profile families
   */
  static getAllFamilies(): GermanProfileFamily[] {
    return Object.keys(GERMAN_PROFILE_CONFIGS).filter(f => f !== 'unknown') as GermanProfileFamily[];
  }

  /**
   * Get configuration for a profile family
   */
  static getFamilyConfig(family: GermanProfileFamily): GermanProfileConfig | null {
    return GERMAN_PROFILE_CONFIGS[family] || null;
  }

  /**
   * Get all packages for a profile family
   */
  static getPackagesForFamily(family: GermanProfileFamily): string[] {
    const config = GERMAN_PROFILE_CONFIGS[family];
    return config ? config.packages : [];
  }

  /**
   * Check if URL is a MII profile
   */
  static isMIIProfile(canonicalUrl: string): boolean {
    const result = this.detectGermanProfile(canonicalUrl);
    return result.family === 'mii';
  }

  /**
   * Check if URL is an ISiK profile
   */
  static isISiKProfile(canonicalUrl: string): boolean {
    const result = this.detectGermanProfile(canonicalUrl);
    return result.family === 'isik';
  }

  /**
   * Check if URL is a KBV profile
   */
  static isKBVProfile(canonicalUrl: string): boolean {
    const result = this.detectGermanProfile(canonicalUrl);
    return result.family === 'kbv';
  }

  /**
   * Check if URL is a German Basisprofil
   */
  static isBasisprofilProfile(canonicalUrl: string): boolean {
    const result = this.detectGermanProfile(canonicalUrl);
    return result.family === 'basisprofil';
  }

  /**
   * Generate recommendations for German profile validation
   */
  static generateRecommendations(canonicalUrl: string): string[] {
    const result = this.detectGermanProfile(canonicalUrl);
    
    if (!result.isGermanProfile) {
      return [];
    }

    const recommendations: string[] = [];
    const config = GERMAN_PROFILE_CONFIGS[result.family];

    recommendations.push(`✓ Detected ${config.description}`);
    
    if (result.recommendedPackage) {
      recommendations.push(`📦 Recommended package: ${result.recommendedPackage}`);
    }

    if (result.module) {
      recommendations.push(`📋 Module: ${result.module}`);
    }

    if (config.useCases.length > 0) {
      recommendations.push(`💡 Common use case: ${config.useCases[0]}`);
    }

    // Family-specific recommendations
    if (result.family === 'mii') {
      recommendations.push('⚕️ Consider validating against complete MII Kerndatensatz modules');
      recommendations.push('🔗 May require related modules (e.g., Person + Diagnose)');
    } else if (result.family === 'isik') {
      recommendations.push('🏥 ISiK profiles require German Basisprofil as foundation');
      recommendations.push('📊 Check ISiK conformity level (Stufe 1/2/3)');
    } else if (result.family === 'kbv') {
      recommendations.push('💊 KBV profiles often used for e-prescriptions');
      recommendations.push('🇩🇪 Validates German statutory health insurance requirements');
    } else if (result.family === 'basisprofil') {
      recommendations.push('🔧 Foundation profile for German healthcare IT');
      recommendations.push('🌍 Provides German-specific extensions and patterns');
    }

    return recommendations;
  }

  /**
   * Get suggested packages to download for comprehensive German profile support
   */
  static getSuggestedPackages(): { family: GermanProfileFamily; packages: string[] }[] {
    return [
      { family: 'basisprofil', packages: ['de.basisprofil.r4'] },
      { family: 'mii', packages: ['de.medizininformatikinitiative.kerndatensatz.person'] },
      { family: 'isik', packages: ['de.gematik.isik-basismodul'] },
      { family: 'kbv', packages: ['kbv.basis'] },
    ];
  }
}


