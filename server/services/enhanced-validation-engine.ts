import { FhirClient, FhirOperationOutcome } from './fhir-client.js';
import { ValidationError } from '@shared/schema.js';
import { TerminologyClient, defaultTerminologyConfig } from './terminology-client.js';
import { storage } from '../storage.js';

/**
 * Enhanced FHIR Validation Engine with 6 comprehensive validation aspects:
 * 1. Strukturelle Validierung: Wohlgeformtes FHIR (Syntax, Cardinality, Typisierung)
 * 2. Profilkonformität: FHIR-Profile (MII, ISiK), Constraints, Slicing, ValueSet-Bindings
 * 3. Terminologieprüfung: Code-Gültigkeit innerhalb definierter ValueSets
 * 4. Referenzkonsistenz: Vorhandensein und Gültigkeit referenzierter Ressourcen
 * 5. Feldübergreifende Logikprüfung: Plausibilitätsregeln (z.B. Geburtsdatum < Sterbedatum)
 * 6. Versions- und Metadatenprüfung: Technische Metadaten (VersionId, LastUpdated)
 */

export interface EnhancedValidationConfig {
  enableStructuralValidation: boolean;
  enableProfileValidation: boolean;
  enableTerminologyValidation: boolean;
  enableReferenceValidation: boolean;
  enableBusinessRuleValidation: boolean;
  enableMetadataValidation: boolean;
  strictMode: boolean;
  profiles: string[];
  terminologyServer?: {
    enabled: boolean;
    url: string;
  };
}

export interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  category: 'structural' | 'profile' | 'terminology' | 'reference' | 'business-rule' | 'metadata';
  message: string;
  path: string;
  expression?: string;
  suggestion?: string;
  details?: any;
}

export interface EnhancedValidationResult {
  isValid: boolean;
  resourceType: string;
  resourceId: string;
  issues: ValidationIssue[];
  validationAspects: {
    structural: { passed: boolean; issues: ValidationIssue[] };
    profile: { passed: boolean; issues: ValidationIssue[]; profilesChecked: string[] };
    terminology: { passed: boolean; issues: ValidationIssue[]; codesChecked: number };
    reference: { passed: boolean; issues: ValidationIssue[]; referencesChecked: number };
    businessRule: { passed: boolean; issues: ValidationIssue[]; rulesChecked: number };
    metadata: { passed: boolean; issues: ValidationIssue[] };
  };
  validationScore: number; // 0-100
  validatedAt: Date;
}

export class EnhancedValidationEngine {
  private fhirClient: FhirClient;
  private terminologyClient: TerminologyClient;
  private config: EnhancedValidationConfig;

  constructor(fhirClient: FhirClient, config?: Partial<EnhancedValidationConfig>) {
    this.fhirClient = fhirClient;
    this.terminologyClient = new TerminologyClient(defaultTerminologyConfig);
    this.config = {
      enableStructuralValidation: true,
      enableProfileValidation: true,
      enableTerminologyValidation: true,
      enableReferenceValidation: true,
      enableBusinessRuleValidation: true,
      enableMetadataValidation: true,
      strictMode: false,
      profiles: [],
      ...config
    };
  }

  /**
   * Comprehensive validation entry point
   */
  async validateResource(resource: any): Promise<EnhancedValidationResult> {
    console.log(`[EnhancedValidation] Starting comprehensive validation for ${resource.resourceType}/${resource.id}`);
    
    const result: EnhancedValidationResult = {
      isValid: true,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      issues: [],
      validationAspects: {
        structural: { passed: true, issues: [] },
        profile: { passed: true, issues: [], profilesChecked: [] },
        terminology: { passed: true, issues: [], codesChecked: 0 },
        reference: { passed: true, issues: [], referencesChecked: 0 },
        businessRule: { passed: true, issues: [], rulesChecked: 0 },
        metadata: { passed: true, issues: [] }
      },
      validationScore: 100,
      validatedAt: new Date()
    };

    try {
      // 1. Strukturelle Validierung
      if (this.config.enableStructuralValidation) {
        await this.performStructuralValidation(resource, result);
      }

      // 2. Profilkonformität
      if (this.config.enableProfileValidation) {
        await this.performProfileValidation(resource, result);
      }

      // 3. Terminologieprüfung
      if (this.config.enableTerminologyValidation) {
        await this.performTerminologyValidation(resource, result);
      }

      // 4. Referenzkonsistenz
      if (this.config.enableReferenceValidation) {
        await this.performReferenceValidation(resource, result);
      }

      // 5. Feldübergreifende Logikprüfung
      if (this.config.enableBusinessRuleValidation) {
        await this.performBusinessRuleValidation(resource, result);
      }

      // 6. Versions- und Metadatenprüfung
      if (this.config.enableMetadataValidation) {
        await this.performMetadataValidation(resource, result);
      }

      // Calculate overall validity and score
      this.calculateValidationResult(result);

    } catch (error: any) {
      console.error(`[EnhancedValidation] Validation error for ${resource.resourceType}/${resource.id}:`, error);
      result.issues.push({
        severity: 'error',
        code: 'validation-engine-error',
        category: 'structural',
        message: `Validation engine error: ${error.message}`,
        path: '',
        suggestion: 'Please check the resource format and try again'
      });
      result.isValid = false;
      result.validationScore = 0;
    }

    console.log(`[EnhancedValidation] Validation completed. Score: ${result.validationScore}, Issues: ${result.issues.length}`);
    return result;
  }

  /**
   * 1. Strukturelle Validierung: Prüfung auf wohlgeformtes FHIR
   */
  private async performStructuralValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Performing structural validation...`);
    
    const issues: ValidationIssue[] = [];

    // Basis FHIR Struktur prüfen
    if (!resource.resourceType) {
      issues.push({
        severity: 'error',
        code: 'missing-resource-type',
        category: 'structural',
        message: 'Resource is missing required resourceType field',
        path: 'resourceType',
        suggestion: 'Add a valid FHIR resourceType field'
      });
    }

    if (!resource.id) {
      issues.push({
        severity: 'warning',
        code: 'missing-id',
        category: 'structural',
        message: 'Resource is missing an id field',
        path: 'id',
        suggestion: 'Consider adding a unique identifier'
      });
    }

    // FHIR Datentypen prüfen
    await this.validateDataTypes(resource, '', issues);

    // Cardinality prüfen
    await this.validateCardinality(resource, issues);

    result.validationAspects.structural.issues = issues;
    result.validationAspects.structural.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Validate FHIR data types recursively
   */
  private async validateDataTypes(obj: any, path: string, issues: ValidationIssue[]): Promise<void> {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Spezifische FHIR Datentyp-Validierungen
      if (key === 'birthDate' && value) {
        if (!this.isValidDate(value as string)) {
          issues.push({
            severity: 'error',
            code: 'invalid-date-format',
            category: 'structural',
            message: `Invalid date format in ${currentPath}`,
            path: currentPath,
            suggestion: 'Use YYYY-MM-DD format for dates'
          });
        }
      }

      if (key === 'gender' && value) {
        const validGenders = ['male', 'female', 'other', 'unknown'];
        if (!validGenders.includes(value as string)) {
          issues.push({
            severity: 'error',
            code: 'invalid-gender-code',
            category: 'structural',
            message: `Invalid gender value: ${value}`,
            path: currentPath,
            suggestion: `Use one of: ${validGenders.join(', ')}`
          });
        }
      }

      // Recursive validation for nested objects
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.validateDataTypes(value[i], `${currentPath}[${i}]`, issues);
        }
      } else if (typeof value === 'object' && value !== null) {
        await this.validateDataTypes(value, currentPath, issues);
      }
    }
  }

  /**
   * Validate FHIR cardinality constraints
   */
  private async validateCardinality(resource: any, issues: ValidationIssue[]): Promise<void> {
    const resourceType = resource.resourceType;

    // Patient-spezifische Cardinality-Regeln
    if (resourceType === 'Patient') {
      // Name ist required (1..*)
      if (!resource.name || !Array.isArray(resource.name) || resource.name.length === 0) {
        issues.push({
          severity: 'error',
          code: 'cardinality-violation',
          category: 'structural',
          message: 'Patient must have at least one name',
          path: 'name',
          suggestion: 'Add at least one HumanName element'
        });
      }
    }

    // Observation-spezifische Cardinality-Regeln
    if (resourceType === 'Observation') {
      if (!resource.status) {
        issues.push({
          severity: 'error',
          code: 'cardinality-violation',
          category: 'structural',
          message: 'Observation must have a status',
          path: 'status',
          suggestion: 'Add a valid observation status (e.g., "final", "preliminary")'
        });
      }

      if (!resource.code) {
        issues.push({
          severity: 'error',
          code: 'cardinality-violation',
          category: 'structural',
          message: 'Observation must have a code',
          path: 'code',
          suggestion: 'Add a CodeableConcept for the observation code'
        });
      }
    }
  }

  /**
   * 2. Profilkonformität: Prüfung gegen spezifische FHIR-Profile
   */
  private async performProfileValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Performing profile validation...`);
    
    const issues: ValidationIssue[] = [];
    const profilesChecked: string[] = [];

    // Profile aus resource.meta.profile extrahieren
    const profiles = resource.meta?.profile || this.config.profiles;
    
    if (profiles && profiles.length > 0) {
      for (const profileUrl of profiles) {
        profilesChecked.push(profileUrl);
        await this.validateAgainstProfile(resource, profileUrl, issues);
      }
    } else {
      // Standard-Profile für bekannte Ressourcen anwenden
      const standardProfiles = this.getStandardProfilesForResource(resource.resourceType);
      for (const profileUrl of standardProfiles) {
        profilesChecked.push(profileUrl);
        await this.validateAgainstProfile(resource, profileUrl, issues);
      }
    }

    result.validationAspects.profile.issues = issues;
    result.validationAspects.profile.profilesChecked = profilesChecked;
    result.validationAspects.profile.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Validate against a specific FHIR profile
   */
  private async validateAgainstProfile(resource: any, profileUrl: string, issues: ValidationIssue[]): Promise<void> {
    try {
      console.log(`[EnhancedValidation] Validating against profile: ${profileUrl}`);
      
      // Use FHIR server for profile validation if available
      if (this.fhirClient) {
        const outcome = await this.fhirClient.validateResource(resource, profileUrl);
        
        for (const issue of outcome.issue) {
          if (issue.severity === 'error' || issue.severity === 'fatal') {
            issues.push({
              severity: issue.severity,
              code: issue.code,
              category: 'profile',
              message: issue.details?.text || issue.diagnostics || 'Profile validation failed',
              path: issue.location?.[0] || '',
              expression: issue.expression?.[0],
              suggestion: 'Check profile constraints and requirements'
            });
          }
        }
      }
    } catch (error: any) {
      console.warn(`[EnhancedValidation] Profile validation failed for ${profileUrl}:`, error.message);
      issues.push({
        severity: 'warning',
        code: 'profile-validation-failed',
        category: 'profile',
        message: `Could not validate against profile ${profileUrl}: ${error.message}`,
        path: '',
        suggestion: 'Ensure the profile is accessible and valid'
      });
    }
  }

  /**
   * Get standard profiles for common resource types
   */
  private getStandardProfilesForResource(resourceType: string): string[] {
    const standardProfiles: Record<string, string[]> = {
      'Patient': [
        'http://hl7.org/fhir/StructureDefinition/Patient',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'
      ],
      'Observation': [
        'http://hl7.org/fhir/StructureDefinition/Observation',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab'
      ],
      'Condition': [
        'http://hl7.org/fhir/StructureDefinition/Condition',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition'
      ],
      'Encounter': [
        'http://hl7.org/fhir/StructureDefinition/Encounter',
        'http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter'
      ]
    };

    return standardProfiles[resourceType] || [`http://hl7.org/fhir/StructureDefinition/${resourceType}`];
  }

  /**
   * Helper methods
   */
  private isValidDate(dateString: string): boolean {
    // FHIR date format: YYYY, YYYY-MM, or YYYY-MM-DD
    const dateRegex = /^\d{4}(-\d{2}(-\d{2})?)?$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private calculateValidationResult(result: EnhancedValidationResult): void {
    const totalIssues = result.issues.length;
    const errorCount = result.issues.filter(i => i.severity === 'error' || i.severity === 'fatal').length;
    const warningCount = result.issues.filter(i => i.severity === 'warning').length;

    // Calculate validation score (0-100)
    if (errorCount > 0) {
      result.validationScore = Math.max(0, 60 - (errorCount * 20));
      result.isValid = false;
    } else if (warningCount > 0) {
      result.validationScore = Math.max(70, 100 - (warningCount * 5));
    } else {
      result.validationScore = 100;
    }

    result.isValid = errorCount === 0;
  }

  // Placeholder methods for remaining validation aspects (to be implemented in next steps)
  private async performTerminologyValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Performing terminology validation...`);
    
    const issues: ValidationIssue[] = [];
    let codesChecked = 0;

    // Recursively find and validate all CodeableConcept and Coding elements
    codesChecked = await this.validateTerminologyCodes(resource, '', issues);

    result.validationAspects.terminology.issues = issues;
    result.validationAspects.terminology.codesChecked = codesChecked;
    result.validationAspects.terminology.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Recursively validate terminology codes in CodeableConcept and Coding elements
   */
  private async validateTerminologyCodes(obj: any, path: string, issues: ValidationIssue[]): Promise<number> {
    let codesChecked = 0;
    
    if (!obj || typeof obj !== 'object') return codesChecked;

    // Check if this is a CodeableConcept
    if (obj.coding && Array.isArray(obj.coding)) {
      for (let i = 0; i < obj.coding.length; i++) {
        const coding = obj.coding[i];
        const codingPath = path ? `${path}.coding[${i}]` : `coding[${i}]`;
        
        if (coding.system && coding.code) {
          codesChecked++;
          await this.validateSingleCode(coding, codingPath, issues);
        }
      }
    }

    // Check if this is a direct Coding element
    if (obj.system && obj.code) {
      codesChecked++;
      await this.validateSingleCode(obj, path, issues);
    }

    // Recursively check nested objects and arrays
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          codesChecked += await this.validateTerminologyCodes(value[i], `${currentPath}[${i}]`, issues);
        }
      } else if (typeof value === 'object' && value !== null) {
        codesChecked += await this.validateTerminologyCodes(value, currentPath, issues);
      }
    }

    return codesChecked;
  }

  /**
   * Validate a single code against its system and known ValueSets
   */
  private async validateSingleCode(coding: any, path: string, issues: ValidationIssue[]): Promise<void> {
    const { system, code, display } = coding;
    
    console.log(`[EnhancedValidation] Validating code: ${system}|${code}`);

    // 1. Validate system URL format
    if (!this.isValidSystemUrl(system)) {
      issues.push({
        severity: 'error',
        code: 'invalid-system-url',
        category: 'terminology',
        message: `Invalid code system URL: ${system}`,
        path: `${path}.system`,
        suggestion: 'Use a valid URI for the code system'
      });
      return;
    }

    // 2. Check for known invalid codes
    if (this.isKnownInvalidCode(system, code)) {
      issues.push({
        severity: 'error',
        code: 'invalid-code',
        category: 'terminology',
        message: `Invalid code '${code}' in system '${system}'`,
        path: `${path}.code`,
        suggestion: 'Check the code against the official code system'
      });
      return;
    }

    // 3. Validate common FHIR code systems
    await this.validateKnownCodeSystems(system, code, display, path, issues);

    // 4. Check display text consistency (if provided)
    if (display) {
      const expectedDisplay = await this.getExpectedDisplay(system, code);
      if (expectedDisplay && expectedDisplay !== display) {
        issues.push({
          severity: 'warning',
          code: 'incorrect-display',
          category: 'terminology',
          message: `Display text '${display}' may be incorrect for code '${code}'`,
          path: `${path}.display`,
          suggestion: `Consider using: '${expectedDisplay}'`
        });
      }
    }

    // 5. Use terminology server if available
    if (this.config.terminologyServer?.enabled) {
      await this.validateCodeWithTerminologyServer(system, code, path, issues);
    }
  }

  /**
   * Validate system URL format
   */
  private isValidSystemUrl(system: string): boolean {
    try {
      new URL(system);
      return true;
    } catch {
      // Check if it's a known FHIR system identifier
      const knownSystems = [
        'http://hl7.org/fhir/',
        'http://loinc.org',
        'http://snomed.info/sct',
        'http://terminology.hl7.org/',
        'http://unitsofmeasure.org',
        'urn:iso:std:iso:3166'
      ];
      
      return knownSystems.some(known => system.startsWith(known));
    }
  }

  /**
   * Check for known invalid codes
   */
  private isKnownInvalidCode(system: string, code: string): boolean {
    // Known invalid codes for common systems
    const invalidCodes: Record<string, string[]> = {
      'http://hl7.org/fhir/administrative-gender': ['invalid', 'none', ''],
      'http://hl7.org/fhir/observation-status': ['invalid', '', 'unknown'],
      'http://hl7.org/fhir/condition-clinical': ['invalid', '', 'unknown']
    };

    return invalidCodes[system]?.includes(code) || false;
  }

  /**
   * Validate codes against known FHIR code systems
   */
  private async validateKnownCodeSystems(system: string, code: string, display: string | undefined, path: string, issues: ValidationIssue[]): Promise<void> {
    switch (system) {
      case 'http://hl7.org/fhir/administrative-gender':
        const validGenders = ['male', 'female', 'other', 'unknown'];
        if (!validGenders.includes(code)) {
          issues.push({
            severity: 'error',
            code: 'invalid-gender-code',
            category: 'terminology',
            message: `Invalid gender code: ${code}`,
            path: `${path}.code`,
            suggestion: `Valid codes: ${validGenders.join(', ')}`
          });
        }
        break;

      case 'http://hl7.org/fhir/observation-status':
        const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
        if (!validStatuses.includes(code)) {
          issues.push({
            severity: 'error',
            code: 'invalid-observation-status',
            category: 'terminology',
            message: `Invalid observation status: ${code}`,
            path: `${path}.code`,
            suggestion: `Valid codes: ${validStatuses.join(', ')}`
          });
        }
        break;

      case 'http://hl7.org/fhir/condition-clinical':
        const validClinicalStatuses = ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'];
        if (!validClinicalStatuses.includes(code)) {
          issues.push({
            severity: 'error',
            code: 'invalid-condition-status',
            category: 'terminology',
            message: `Invalid condition clinical status: ${code}`,
            path: `${path}.code`,
            suggestion: `Valid codes: ${validClinicalStatuses.join(', ')}`
          });
        }
        break;

      case 'http://loinc.org':
        // LOINC codes should follow specific format
        if (!/^\d{1,5}-\d{1,2}$/.test(code)) {
          issues.push({
            severity: 'warning',
            code: 'invalid-loinc-format',
            category: 'terminology',
            message: `LOINC code format may be invalid: ${code}`,
            path: `${path}.code`,
            suggestion: 'LOINC codes should follow format: NNNNN-N'
          });
        }
        break;

      case 'http://snomed.info/sct':
        // SNOMED CT codes should be numeric
        if (!/^\d+$/.test(code)) {
          issues.push({
            severity: 'warning',
            code: 'invalid-snomed-format',
            category: 'terminology',
            message: `SNOMED CT code should be numeric: ${code}`,
            path: `${path}.code`,
            suggestion: 'SNOMED CT codes should contain only digits'
          });
        }
        break;

      case 'urn:iso:std:iso:3166':
        // ISO 3166 country codes
        if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
          issues.push({
            severity: 'error',
            code: 'invalid-country-code',
            category: 'terminology',
            message: `Invalid ISO 3166 country code: ${code}`,
            path: `${path}.code`,
            suggestion: 'Country codes should be 2 uppercase letters (e.g., US, DE, GB)'
          });
        }
        break;
    }
  }

  /**
   * Get expected display text for a code (simplified implementation)
   */
  private async getExpectedDisplay(system: string, code: string): Promise<string | null> {
    // Simplified mapping for common codes
    const displayMappings: Record<string, Record<string, string>> = {
      'http://hl7.org/fhir/administrative-gender': {
        'male': 'Male',
        'female': 'Female',
        'other': 'Other',
        'unknown': 'Unknown'
      },
      'http://hl7.org/fhir/observation-status': {
        'final': 'Final',
        'preliminary': 'Preliminary',
        'registered': 'Registered',
        'amended': 'Amended',
        'cancelled': 'Cancelled'
      }
    };

    return displayMappings[system]?.[code] || null;
  }

  /**
   * Validate code using external terminology server
   */
  private async validateCodeWithTerminologyServer(system: string, code: string, path: string, issues: ValidationIssue[]): Promise<void> {
    try {
      if (!this.terminologyClient) return;

      const isValid = await this.terminologyClient.validateCode(system, code);
      
      if (!isValid) {
        issues.push({
          severity: 'error',
          code: 'terminology-server-validation-failed',
          category: 'terminology',
          message: `Code '${code}' not found in system '${system}' according to terminology server`,
          path: `${path}.code`,
          suggestion: 'Verify the code exists in the specified code system'
        });
      }
    } catch (error: any) {
      console.warn(`[EnhancedValidation] Terminology server validation failed:`, error.message);
      // Don't add issues for terminology server failures - treat as warnings
      issues.push({
        severity: 'information',
        code: 'terminology-server-unavailable',
        category: 'terminology',
        message: `Could not validate code with terminology server: ${error.message}`,
        path: path,
        suggestion: 'Terminology server validation temporarily unavailable'
      });
    }
  }

  private async performReferenceValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Reference validation - placeholder`);
    // Will be implemented in step 4
  }

  private async performBusinessRuleValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Business rule validation - placeholder`);
    // Will be implemented in step 5
  }

  private async performMetadataValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Metadata validation - placeholder`);
    // Will be implemented in step 6
  }
}