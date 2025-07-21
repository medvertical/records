import { FhirClient, FhirOperationOutcome } from './fhir-client.js';
import { ValidationError } from '@shared/schema.js';
import { TerminologyClient, defaultTerminologyConfig } from './terminology-client.js';
import { storage } from '../storage.js';
import axios from 'axios';

/**
 * Enhanced FHIR Validation Engine with 6 comprehensive validation aspects:
 * 1. Strukturelle Validierung: Wohlgeformtes FHIR (Syntax, Cardinality, Typisierung)
 * 2. Profilkonformität: FHIR-Profile (MII, ISiK), Constraints, Slicing, ValueSet-Bindings
 * 3. Terminologieprüfung: Code-Gültigkeit innerhalb definierter ValueSets
 * 4. Referenzkonsistenz: Vorhandensein und Gültigkeit referenzierter Ressourcen
 * 5. Feldübergreifende Logikprüfung: Plausibilitätsregeln (z.B. Geburtsdatum < Sterbedatum)
 * 6. Versions- und Metadatenprüfung: Technische Metadaten (VersionId, LastUpdated)
 */

export interface TerminologyServer {
  priority: number;
  enabled: boolean;
  url: string;
  type: string;
  name: string;
  description: string;
  capabilities: string[];
}

export interface ProfileResolutionServer {
  priority: number;
  enabled: boolean;
  url: string;
  type: string;
  name: string;
  description: string;
  capabilities: string[];
}

export interface EnhancedValidationConfig {
  enableStructuralValidation: boolean;
  enableProfileValidation: boolean;
  enableTerminologyValidation: boolean;
  enableReferenceValidation: boolean;
  enableBusinessRuleValidation: boolean;
  enableMetadataValidation: boolean;
  strictMode: boolean;
  profiles: string[];
  terminologyServers?: TerminologyServer[];
  profileResolutionServers?: ProfileResolutionServer[];
  // Legacy single server for backwards compatibility
  terminologyServer?: {
    enabled: boolean;
    url: string;
  };
}

export interface ValidationIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code: string;
  category: 'structural' | 'profile' | 'terminology' | 'reference' | 'business-rule' | 'metadata' | 'general';
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
      terminologyServers: [],
      ...config
    };
    
    // Update terminology client with priority-ordered servers
    this.updateTerminologyServers();
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedValidationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration and terminology servers
   */
  updateConfig(config: Partial<EnhancedValidationConfig>) {
    this.config = { ...this.config, ...config };
    this.updateTerminologyServers();
    this.updateProfileResolutionServers();
  }

  /**
   * Configure terminology client with priority-ordered servers
   */
  private updateTerminologyServers() {
    if (this.config.terminologyServers && this.config.terminologyServers.length > 0) {
      // Sort servers by priority and filter enabled ones
      const enabledServers = this.config.terminologyServers
        .filter(server => server.enabled)
        .sort((a, b) => a.priority - b.priority);
      
      console.log(`[EnhancedValidation] Configured ${enabledServers.length} terminology servers in priority order:`, 
        enabledServers.map(s => `${s.priority}: ${s.name} (${s.type})`));
      
      if (enabledServers.length > 0) {
        // Use first (highest priority) server as primary
        const primaryServer = enabledServers[0];
        this.terminologyClient.updateConfig({
          url: primaryServer.url,
          enabled: true
        });
        console.log(`[EnhancedValidation] Primary terminology server: ${primaryServer.name} (${primaryServer.url})`);
      }
    } else if (this.config.terminologyServer?.enabled) {
      // Legacy single server fallback
      this.terminologyClient.updateConfig({
        url: this.config.terminologyServer.url,
        enabled: true
      });
      console.log(`[EnhancedValidation] Using legacy terminology server: ${this.config.terminologyServer.url}`);
    }
  }

  /**
   * Configure profile resolution servers with priority-ordered servers
   */
  private updateProfileResolutionServers() {
    if (this.config.profileResolutionServers && this.config.profileResolutionServers.length > 0) {
      // Sort servers by priority and filter enabled ones
      const enabledServers = this.config.profileResolutionServers
        .filter(server => server.enabled)
        .sort((a, b) => a.priority - b.priority);
      
      console.log(`[EnhancedValidation] Configured ${enabledServers.length} profile resolution servers in priority order:`, 
        enabledServers.map(s => `${s.priority}: ${s.name} (${s.type})`));
      
      if (enabledServers.length > 0) {
        // Log primary server for profile resolution
        const primaryServer = enabledServers[0];
        console.log(`[EnhancedValidation] Primary profile resolution server: ${primaryServer.name} (${primaryServer.url})`);
        
        // Note: Profile resolution servers are used during profile validation phase
        // They are referenced in the performProfileValidation method
      }
    } else {
      console.log(`[EnhancedValidation] No profile resolution servers configured`);
    }
  }

  /**
   * Comprehensive validation entry point
   */
  async validateResource(resource: any): Promise<EnhancedValidationResult> {
    console.log(`[EnhancedValidation] Starting comprehensive validation for ${resource.resourceType}/${resource.id}`);
    console.log(`[EnhancedValidation] Active validation aspects:`, {
      structural: this.config.enableStructuralValidation,
      profile: this.config.enableProfileValidation,
      terminology: this.config.enableTerminologyValidation,
      reference: this.config.enableReferenceValidation,
      businessRule: this.config.enableBusinessRuleValidation,
      metadata: this.config.enableMetadataValidation
    });
    
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

    // Add more comprehensive structural checks
    if (!resource.meta) {
      issues.push({
        severity: 'warning',
        code: 'missing-meta',
        category: 'structural',
        message: 'Resource is missing meta element',
        path: 'meta',
        suggestion: 'Add meta element with versionId and lastUpdated'
      });
    }

    // Check for required narrative
    if (!resource.text || !resource.text.status) {
      issues.push({
        severity: 'information',
        code: 'missing-narrative',
        category: 'structural',
        message: 'Resource lacks narrative text',
        path: 'text.status',
        suggestion: 'Add narrative text for better human readability'
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
   * Validate against a specific FHIR profile using configured profile resolution servers
   */
  private async validateAgainstProfile(resource: any, profileUrl: string, issues: ValidationIssue[]): Promise<void> {
    try {
      console.log(`[EnhancedValidation] Validating against profile: ${profileUrl}`);
      
      // Step 1: Try to resolve the profile using configured profile resolution servers
      const profile = await this.resolveProfile(profileUrl);
      
      if (profile) {
        console.log(`[EnhancedValidation] Profile resolved successfully, performing detailed validation`);
        await this.validateResourceAgainstResolvedProfile(resource, profile, profileUrl, issues);
      } else {
        console.log(`[EnhancedValidation] Profile not resolved, falling back to FHIR server validation`);
        // Step 2: Fallback to FHIR server validation if profile resolution fails
        await this.fallbackFhirServerValidation(resource, profileUrl, issues);
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
   * Resolve a FHIR profile using configured profile resolution servers
   */
  private async resolveProfile(profileUrl: string): Promise<any | null> {
    if (!this.config.profileResolutionServers) {
      console.log(`[ProfileResolution] No profile resolution servers configured`);
      return null;
    }

    // Sort servers by priority and filter enabled ones
    const enabledServers = this.config.profileResolutionServers
      .filter(server => server.enabled)
      .sort((a, b) => a.priority - b.priority);

    console.log(`[ProfileResolution] Attempting to resolve ${profileUrl} using ${enabledServers.length} servers`);

    for (const server of enabledServers) {
      try {
        console.log(`[ProfileResolution] Trying ${server.name} (${server.type})`);
        const profile = await this.fetchProfileFromServer(profileUrl, server);
        
        if (profile) {
          console.log(`[ProfileResolution] Profile successfully resolved from ${server.name}`);
          return profile;
        }
      } catch (error: any) {
        console.warn(`[ProfileResolution] Failed to resolve from ${server.name}:`, error.message);
        continue; // Try next server
      }
    }

    console.log(`[ProfileResolution] Profile ${profileUrl} could not be resolved from any server`);
    return null;
  }

  /**
   * Fetch a profile from a specific profile resolution server
   */
  private async fetchProfileFromServer(profileUrl: string, server: ProfileResolutionServer): Promise<any | null> {
    switch (server.type) {
      case 'simplifier':
        return await this.fetchFromSimplifier(profileUrl, server.url);
      case 'fhir-ci':
        return await this.fetchFromFhirCI(profileUrl, server.url);
      case 'fhir-registry':
        return await this.fetchFromFhirRegistry(profileUrl, server.url);
      case 'ihe-profiles':
        return await this.fetchFromIheProfiles(profileUrl, server.url);
      default:
        return await this.fetchFromGenericFhirServer(profileUrl, server.url);
    }
  }

  /**
   * Fetch profile from Simplifier.net
   */
  private async fetchFromSimplifier(profileUrl: string, baseUrl: string): Promise<any | null> {
    try {
      
      // Extract profile identifier from URL for Simplifier API
      const profileId = this.extractProfileIdentifier(profileUrl);
      const apiUrl = `${baseUrl}/api/fhir/StructureDefinition/${profileId}`;
      
      console.log(`[ProfileResolution] Fetching from Simplifier: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Accept': 'application/fhir+json',
          'User-Agent': 'Records-FHIR-Validator/1.0'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data) {
        const profile = response.data;
        if (profile.resourceType === 'StructureDefinition') {
          return profile;
        }
      }
      
      return null;
    } catch (error: any) {
      console.warn(`[ProfileResolution] Simplifier fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Fetch profile from FHIR CI Build server
   */
  private async fetchFromFhirCI(profileUrl: string, baseUrl: string): Promise<any | null> {
    try {
      
      // Try direct URL first, then construct API endpoint
      const directUrl = profileUrl.replace('http://hl7.org/fhir/', `${baseUrl}/`);
      console.log(`[ProfileResolution] Fetching from FHIR CI: ${directUrl}`);
      
      const response = await axios.get(directUrl, {
        headers: {
          'Accept': 'application/fhir+json',
          'User-Agent': 'Records-FHIR-Validator/1.0'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data) {
        const profile = response.data;
        if (profile.resourceType === 'StructureDefinition') {
          return profile;
        }
      }
      
      return null;
    } catch (error: any) {
      console.warn(`[ProfileResolution] FHIR CI fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Fetch profile from FHIR Package Registry
   */
  private async fetchFromFhirRegistry(profileUrl: string, baseUrl: string): Promise<any | null> {
    try {
      
      // FHIR Package Registry typically uses a different approach
      // This is a simplified implementation
      const profileId = this.extractProfileIdentifier(profileUrl);
      const apiUrl = `${baseUrl}/StructureDefinition/${profileId}`;
      
      console.log(`[ProfileResolution] Fetching from Package Registry: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Accept': 'application/fhir+json',
          'User-Agent': 'Records-FHIR-Validator/1.0'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data) {
        const profile = response.data;
        if (profile.resourceType === 'StructureDefinition') {
          return profile;
        }
      }
      
      return null;
    } catch (error: any) {
      console.warn(`[ProfileResolution] Package Registry fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Fetch profile from a generic FHIR server
   */
  private async fetchFromGenericFhirServer(profileUrl: string, baseUrl: string): Promise<any | null> {
    try {
      
      const profileId = this.extractProfileIdentifier(profileUrl);
      const apiUrl = `${baseUrl}/StructureDefinition/${profileId}`;
      
      console.log(`[ProfileResolution] Fetching from generic server: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Accept': 'application/fhir+json',
          'User-Agent': 'Records-FHIR-Validator/1.0'
        },
        timeout: 10000
      });

      if (response.status === 200 && response.data) {
        const profile = response.data;
        if (profile.resourceType === 'StructureDefinition') {
          return profile;
        }
      }
      
      return null;
    } catch (error: any) {
      console.warn(`[ProfileResolution] Generic server fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Fetch profile from IHE Profiles server
   */
  private async fetchFromIheProfiles(profileUrl: string, baseUrl: string): Promise<any | null> {
    try {
      // Check if this is an IHE profile URL
      if (!profileUrl.includes('profiles.ihe.net')) {
        return null;
      }
      
      console.log(`[ProfileResolution] Fetching IHE profile: ${profileUrl}`);
      
      // IHE profiles follow a specific URL pattern
      // https://profiles.ihe.net/ITI/BALP/StructureDefinition/IHE.BasicAudit.Query
      // becomes
      // https://profiles.ihe.net/ITI/BALP/1.1.3/StructureDefinition-IHE.BasicAudit.Query.json
      
      // Extract the profile path components
      const urlMatch = profileUrl.match(/^https:\/\/profiles\.ihe\.net\/([^\/]+)\/([^\/]+)\/StructureDefinition\/(.+)$/);
      if (urlMatch) {
        const [, domain, guide, profileName] = urlMatch;
        
        // Try with latest version (typically 1.1.3 for BALP)
        const jsonPatterns = [
          `https://profiles.ihe.net/${domain}/${guide}/1.1.3/StructureDefinition-${profileName}.json`,
          `https://profiles.ihe.net/${domain}/${guide}/1.1.0/StructureDefinition-${profileName}.json`,
          `https://profiles.ihe.net/${domain}/${guide}/current/StructureDefinition-${profileName}.json`,
          `https://profiles.ihe.net/${domain}/${guide}/StructureDefinition-${profileName}.json`
        ];
        
        for (const pattern of jsonPatterns) {
          try {
            console.log(`[ProfileResolution] Trying IHE JSON pattern: ${pattern}`);
            const response = await axios.get(pattern, {
              headers: {
                'Accept': 'application/fhir+json, application/json',
                'User-Agent': 'Records-FHIR-Validator/1.0'
              },
              timeout: 10000
            });

            if (response.status === 200 && response.data && response.data.resourceType === 'StructureDefinition') {
              console.log(`[ProfileResolution] Successfully fetched IHE profile from: ${pattern}`);
              return response.data;
            }
          } catch (error: any) {
            console.log(`[ProfileResolution] Pattern failed: ${pattern} - ${error.message}`);
            continue;
          }
        }
      }
      
      // If URL patterns didn't work, try direct approaches
      try {
        // Try adding .json to the end
        const directJsonUrl = `${profileUrl}.json`;
        console.log(`[ProfileResolution] Trying direct JSON URL: ${directJsonUrl}`);
        
        const response = await axios.get(directJsonUrl, {
          headers: {
            'Accept': 'application/fhir+json, application/json',
            'User-Agent': 'Records-FHIR-Validator/1.0'
          },
          timeout: 10000
        });

        if (response.status === 200 && response.data && response.data.resourceType === 'StructureDefinition') {
          console.log(`[ProfileResolution] Successfully fetched IHE profile from direct JSON URL: ${directJsonUrl}`);
          return response.data;
        }
      } catch (error: any) {
        console.warn(`[ProfileResolution] Direct JSON fetch failed: ${error.message}`);
      }
      
      return null;
    } catch (error: any) {
      console.warn(`[ProfileResolution] IHE profiles fetch failed:`, error.message);
      return null;
    }
  }

  /**
   * Extract profile identifier from URL
   */
  private extractProfileIdentifier(profileUrl: string): string {
    // Extract the last part of the URL as the profile identifier
    const parts = profileUrl.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Validate resource against a resolved profile
   */
  private async validateResourceAgainstResolvedProfile(
    resource: any, 
    profile: any, 
    profileUrl: string, 
    issues: ValidationIssue[]
  ): Promise<void> {
    console.log(`[ProfileValidation] Validating ${resource.resourceType} against ${profile.name || profileUrl}`);

    // Check if resource type matches profile base type
    const baseResourceType = this.extractBaseResourceType(profile);
    if (baseResourceType && baseResourceType !== resource.resourceType) {
      issues.push({
        severity: 'error',
        code: 'resource-type-mismatch',
        category: 'profile',
        message: `Resource type '${resource.resourceType}' does not match profile base type '${baseResourceType}'`,
        path: 'resourceType',
        suggestion: `This profile is for ${baseResourceType} resources only`
      });
      return;
    }

    // Validate must support elements
    const mustSupportElements = this.extractMustSupportElements(profile);
    for (const element of mustSupportElements) {
      if (!this.resourceHasElement(resource, element.path)) {
        issues.push({
          severity: 'error',
          code: 'missing-must-support',
          category: 'profile',
          message: `Missing required element: ${element.path}`,
          path: element.path,
          suggestion: 'This element is marked as mustSupport in the profile'
        });
      }
    }

    // Validate cardinality constraints
    await this.validateProfileCardinality(resource, profile, issues);

    // Validate binding constraints  
    await this.validateProfileBindings(resource, profile, issues);
  }

  /**
   * Extract base resource type from profile
   */
  private extractBaseResourceType(profile: any): string | null {
    return profile.type || profile.baseDefinition?.split('/').pop() || null;
  }

  /**
   * Extract mustSupport elements from profile
   */
  private extractMustSupportElements(profile: any): Array<{path: string, min: number}> {
    const elements: Array<{path: string, min: number}> = [];
    
    if (profile.differential?.element) {
      for (const element of profile.differential.element) {
        if (element.mustSupport === true && element.min > 0) {
          elements.push({
            path: element.path,
            min: element.min
          });
        }
      }
    }
    
    return elements;
  }

  /**
   * Check if resource has a specific element path
   */
  private resourceHasElement(resource: any, elementPath: string): boolean {
    const pathParts = elementPath.split('.');
    let current = resource;
    
    for (let i = 1; i < pathParts.length; i++) { // Skip first part (resource type)
      const part = pathParts[i];
      if (current === null || current === undefined) {
        return false;
      }
      current = current[part];
    }
    
    return current !== null && current !== undefined;
  }

  /**
   * Validate cardinality constraints from profile
   */
  private async validateProfileCardinality(resource: any, profile: any, issues: ValidationIssue[]): Promise<void> {
    if (!profile.differential?.element) return;

    for (const element of profile.differential.element) {
      if (element.min !== undefined && element.min > 0) {
        const hasElement = this.resourceHasElement(resource, element.path);
        if (!hasElement) {
          issues.push({
            severity: 'error',
            code: 'cardinality-violation',
            category: 'profile',
            message: `Element ${element.path} is required (min cardinality: ${element.min})`,
            path: element.path,
            suggestion: 'Add the required element to the resource'
          });
        }
      }
    }
  }

  /**
   * Validate binding constraints from profile
   */
  private async validateProfileBindings(resource: any, profile: any, issues: ValidationIssue[]): Promise<void> {
    if (!profile.differential?.element) return;

    for (const element of profile.differential.element) {
      if (element.binding?.valueSet) {
        // This is a simplified binding validation
        // In a full implementation, you would validate against the actual ValueSet
        console.log(`[ProfileValidation] Found binding for ${element.path} to ValueSet ${element.binding.valueSet}`);
      }
    }
  }

  /**
   * Fallback to FHIR server validation when profile resolution fails
   */
  private async fallbackFhirServerValidation(resource: any, profileUrl: string, issues: ValidationIssue[]): Promise<void> {
    try {
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
      } else {
        // Basic profile validation without external servers
        issues.push({
          severity: 'information',
          code: 'profile-validation-skipped',
          category: 'profile',
          message: `Profile validation skipped for ${profileUrl} - no FHIR server available`,
          path: '',
          suggestion: 'Configure a FHIR server or profile resolution servers for complete validation'
        });
      }
    } catch (error: any) {
      console.warn(`[EnhancedValidation] Fallback FHIR server validation failed:`, error.message);
      issues.push({
        severity: 'warning',
        code: 'profile-validation-failed',
        category: 'profile',
        message: `Fallback profile validation failed: ${error.message}`,
        path: '',
        suggestion: 'Check profile URL and server connectivity'
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
    const informationCount = result.issues.filter(i => i.severity === 'information').length;

    // Calculate validation score (0-100)
    if (errorCount > 0) {
      result.validationScore = Math.max(0, 60 - (errorCount * 20));
      result.isValid = false;
    } else if (warningCount > 0) {
      result.validationScore = Math.max(70, 100 - (warningCount * 5));
      result.isValid = false; // Warnings make resource invalid
    } else {
      // Only information-level issues - resource is still valid
      result.validationScore = 100;
      result.isValid = true;
    }

    // Log validation result for debugging
    console.log(`[EnhancedValidation] Validation result: score=${result.validationScore}, valid=${result.isValid}, errors=${errorCount}, warnings=${warningCount}, information=${informationCount}`);
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
    console.log(`[EnhancedValidation] Performing reference validation...`);
    
    const issues: ValidationIssue[] = [];
    let referencesChecked = 0;

    // Find and validate all Reference elements
    referencesChecked = await this.validateReferences(resource, '', issues, new Set());

    result.validationAspects.reference.issues = issues;
    result.validationAspects.reference.referencesChecked = referencesChecked;
    result.validationAspects.reference.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Recursively validate all Reference elements in the resource
   */
  private async validateReferences(obj: any, path: string, issues: ValidationIssue[], checkedReferences: Set<string>): Promise<number> {
    let referencesChecked = 0;
    
    if (!obj || typeof obj !== 'object') return referencesChecked;

    // Check if this is a Reference element
    if (obj.reference && typeof obj.reference === 'string') {
      referencesChecked++;
      await this.validateSingleReference(obj, path, issues, checkedReferences);
    }

    // Check specific FHIR reference fields
    const referenceFields = ['subject', 'patient', 'encounter', 'performer', 'requester', 'recorder', 'author', 'source', 'target'];
    for (const field of referenceFields) {
      if (obj[field] && obj[field].reference) {
        referencesChecked++;
        await this.validateSingleReference(obj[field], `${path}.${field}`, issues, checkedReferences);
      }
    }

    // Recursively check nested objects and arrays
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          referencesChecked += await this.validateReferences(value[i], `${currentPath}[${i}]`, issues, checkedReferences);
        }
      } else if (typeof value === 'object' && value !== null) {
        referencesChecked += await this.validateReferences(value, currentPath, issues, checkedReferences);
      }
    }

    return referencesChecked;
  }

  /**
   * Validate a single Reference element
   */
  private async validateSingleReference(reference: any, path: string, issues: ValidationIssue[], checkedReferences: Set<string>): Promise<void> {
    const refString = reference.reference;
    
    console.log(`[EnhancedValidation] Validating reference: ${refString}`);

    // 1. Validate reference format
    if (!this.isValidReferenceFormat(refString)) {
      issues.push({
        severity: 'error',
        code: 'invalid-reference-format',
        category: 'reference',
        message: `Invalid reference format: ${refString}`,
        path: `${path}.reference`,
        suggestion: 'Use format: ResourceType/id or #fragment or http://external.url'
      });
      return;
    }

    // 2. Check for circular references
    if (checkedReferences.has(refString)) {
      issues.push({
        severity: 'warning',
        code: 'circular-reference',
        category: 'reference',
        message: `Potential circular reference detected: ${refString}`,
        path: `${path}.reference`,
        suggestion: 'Review reference chain to avoid circular dependencies'
      });
      return;
    }

    checkedReferences.add(refString);

    // 3. Validate reference type consistency
    if (reference.type) {
      const expectedType = this.extractResourceTypeFromReference(refString);
      if (expectedType && expectedType !== reference.type) {
        issues.push({
          severity: 'error',
          code: 'reference-type-mismatch',
          category: 'reference',
          message: `Reference type mismatch: expected ${expectedType}, got ${reference.type}`,
          path: `${path}.type`,
          suggestion: `Change type to ${expectedType} or update reference`
        });
      }
    }

    // 4. Validate identifier reference consistency
    if (reference.identifier && reference.reference) {
      issues.push({
        severity: 'warning',
        code: 'reference-identifier-ambiguity',
        category: 'reference',
        message: 'Reference contains both reference and identifier - prefer reference',
        path: path,
        suggestion: 'Use either reference OR identifier, not both'
      });
    }

    // 5. Check reference existence (for internal references)
    if (this.isInternalReference(refString)) {
      await this.validateInternalReferenceExistence(refString, path, issues);
    }

    // 6. Validate external URL references
    if (this.isExternalReference(refString)) {
      await this.validateExternalReference(refString, path, issues);
    }

    // 7. Validate fragment references
    if (this.isFragmentReference(refString)) {
      await this.validateFragmentReference(refString, path, issues);
    }

    checkedReferences.delete(refString);
  }

  /**
   * Validate reference format according to FHIR specification
   */
  private isValidReferenceFormat(reference: string): boolean {
    if (!reference) return false;

    // FHIR Reference patterns:
    // 1. ResourceType/id
    // 2. #fragment
    // 3. http://external.url
    // 4. urn:uuid:uuid
    // 5. urn:oid:oid

    const patterns = [
      /^[A-Z][a-zA-Z]*\/[A-Za-z0-9\-\.]{1,64}$/, // ResourceType/id
      /^#[A-Za-z0-9\-\.]+$/, // #fragment
      /^https?:\/\/.+$/, // HTTP URL
      /^urn:uuid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, // UUID
      /^urn:oid:[0-2](\.(0|[1-9][0-9]*))*$/ // OID
    ];

    return patterns.some(pattern => pattern.test(reference));
  }

  /**
   * Extract resource type from reference string
   */
  private extractResourceTypeFromReference(reference: string): string | null {
    const match = reference.match(/^([A-Z][a-zA-Z]*)\/[A-Za-z0-9\-\.]{1,64}$/);
    return match ? match[1] : null;
  }

  /**
   * Check if reference is internal (ResourceType/id format)
   */
  private isInternalReference(reference: string): boolean {
    return /^[A-Z][a-zA-Z]*\/[A-Za-z0-9\-\.]{1,64}$/.test(reference);
  }

  /**
   * Check if reference is external (HTTP URL)
   */
  private isExternalReference(reference: string): boolean {
    return /^https?:\/\/.+$/.test(reference);
  }

  /**
   * Check if reference is fragment (#fragment)
   */
  private isFragmentReference(reference: string): boolean {
    return reference.startsWith('#');
  }

  /**
   * Validate that internally referenced resource exists
   */
  private async validateInternalReferenceExistence(reference: string, path: string, issues: ValidationIssue[]): Promise<void> {
    try {
      const [resourceType, resourceId] = reference.split('/');
      
      // Check if resource exists in our database
      const existingResource = await storage.getFhirResourceByTypeAndId(resourceType, resourceId);
      
      if (!existingResource) {
        // Try to fetch from FHIR server
        try {
          if (this.fhirClient) {
            const serverResource = await this.fhirClient.getResource(resourceType, resourceId);
            if (!serverResource) {
              issues.push({
                severity: 'error',
                code: 'reference-not-found',
                category: 'reference',
                message: `Referenced resource not found: ${reference}`,
                path: `${path}.reference`,
                suggestion: 'Ensure the referenced resource exists or update the reference'
              });
            }
          } else {
            issues.push({
              severity: 'warning',
              code: 'reference-existence-unknown',
              category: 'reference',
              message: `Cannot verify reference existence: ${reference}`,
              path: `${path}.reference`,
              suggestion: 'FHIR server connection required to validate references'
            });
          }
        } catch (error) {
          issues.push({
            severity: 'error',
            code: 'reference-not-found',
            category: 'reference',
            message: `Referenced resource not found: ${reference}`,
            path: `${path}.reference`,
            suggestion: 'Ensure the referenced resource exists or update the reference'
          });
        }
      } else {
        console.log(`[EnhancedValidation] Reference verified: ${reference} exists`);
      }
    } catch (error: any) {
      console.warn(`[EnhancedValidation] Reference validation failed for ${reference}:`, error.message);
      issues.push({
        severity: 'warning',
        code: 'reference-validation-error',
        category: 'reference',
        message: `Could not validate reference: ${reference}`,
        path: `${path}.reference`,
        suggestion: 'Check reference format and resource availability'
      });
    }
  }

  /**
   * Validate external reference URLs
   */
  private async validateExternalReference(reference: string, path: string, issues: ValidationIssue[]): Promise<void> {
    try {
      // Validate URL format
      new URL(reference);
      
      // Check for secure HTTPS (warning for HTTP)
      if (reference.startsWith('http://')) {
        issues.push({
          severity: 'warning',
          code: 'insecure-reference',
          category: 'reference',
          message: `External reference uses insecure HTTP: ${reference}`,
          path: `${path}.reference`,
          suggestion: 'Consider using HTTPS for external references'
        });
      }

      // Basic reachability check (simplified - in production, implement proper HTTP check)
      console.log(`[EnhancedValidation] External reference format valid: ${reference}`);
      
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'invalid-external-reference',
        category: 'reference',
        message: `Invalid external reference URL: ${reference}`,
        path: `${path}.reference`,
        suggestion: 'Ensure the URL is properly formatted'
      });
    }
  }

  /**
   * Validate fragment references (#fragment)
   */
  private async validateFragmentReference(reference: string, path: string, issues: ValidationIssue[]): Promise<void> {
    const fragmentId = reference.substring(1); // Remove #
    
    if (!fragmentId) {
      issues.push({
        severity: 'error',
        code: 'empty-fragment-reference',
        category: 'reference',
        message: 'Fragment reference cannot be empty',
        path: `${path}.reference`,
        suggestion: 'Provide a valid fragment identifier'
      });
      return;
    }

    // Fragment references should point to contained resources
    // This would need access to the containing Bundle or resource
    console.log(`[EnhancedValidation] Fragment reference: ${reference} (validation limited without full context)`);
    
    // In a full implementation, we would:
    // 1. Find the containing Bundle or resource
    // 2. Check if a contained resource with this id exists
    // 3. Validate the resource type matches expectations
  }

  private async performBusinessRuleValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Performing business rule validation...`);
    
    const issues: ValidationIssue[] = [];
    let rulesChecked = 0;

    // Apply resource-specific business rules
    switch (resource.resourceType) {
      case 'Patient':
        rulesChecked += await this.validatePatientBusinessRules(resource, issues);
        break;
      case 'Observation':
        rulesChecked += await this.validateObservationBusinessRules(resource, issues);
        break;
      case 'Condition':
        rulesChecked += await this.validateConditionBusinessRules(resource, issues);
        break;
      case 'Encounter':
        rulesChecked += await this.validateEncounterBusinessRules(resource, issues);
        break;
      case 'Procedure':
        rulesChecked += await this.validateProcedureBusinessRules(resource, issues);
        break;
      default:
        // Apply general business rules for all resources
        rulesChecked += await this.validateGeneralBusinessRules(resource, issues);
        break;
    }

    result.validationAspects.businessRule.issues = issues;
    result.validationAspects.businessRule.rulesChecked = rulesChecked;
    result.validationAspects.businessRule.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Validate Patient-specific business rules
   */
  private async validatePatientBusinessRules(patient: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Birth date vs Death date
    if (patient.birthDate && patient.deceasedDateTime) {
      rulesChecked++;
      const birthDate = new Date(patient.birthDate);
      const deathDate = new Date(patient.deceasedDateTime);
      
      if (birthDate >= deathDate) {
        issues.push({
          severity: 'error',
          code: 'invalid-death-date',
          category: 'business-rule',
          message: 'Death date must be after birth date',
          path: 'deceasedDateTime',
          suggestion: 'Verify death date is chronologically after birth date'
        });
      }
    }

    // Rule 2: Reasonable birth date (not in future, not too old)
    if (patient.birthDate) {
      rulesChecked++;
      const birthDate = new Date(patient.birthDate);
      const today = new Date();
      const maxAge = 150; // years
      const minDate = new Date(today.getFullYear() - maxAge, today.getMonth(), today.getDate());

      if (birthDate > today) {
        issues.push({
          severity: 'error',
          code: 'future-birth-date',
          category: 'business-rule',
          message: 'Birth date cannot be in the future',
          path: 'birthDate',
          suggestion: 'Verify birth date is not after current date'
        });
      } else if (birthDate < minDate) {
        issues.push({
          severity: 'warning',
          code: 'extremely-old-patient',
          category: 'business-rule',
          message: `Patient would be over ${maxAge} years old`,
          path: 'birthDate',
          suggestion: 'Verify birth date accuracy for very elderly patients'
        });
      }
    }

    // Rule 3: Gender consistency with name prefixes
    if (patient.gender && patient.name) {
      rulesChecked++;
      for (const name of patient.name) {
        if (name.prefix && Array.isArray(name.prefix)) {
          for (const prefix of name.prefix) {
            if (this.isGenderSpecificPrefix(prefix, patient.gender)) {
              issues.push({
                severity: 'warning',
                code: 'gender-prefix-mismatch',
                category: 'business-rule',
                message: `Name prefix "${prefix}" may not match gender "${patient.gender}"`,
                path: 'name.prefix',
                suggestion: 'Verify gender and name prefix consistency'
              });
            }
          }
        }
      }
    }

    // Rule 4: Contact information format validation
    if (patient.telecom) {
      rulesChecked++;
      for (let i = 0; i < patient.telecom.length; i++) {
        const telecom = patient.telecom[i];
        if (telecom.system === 'email' && telecom.value) {
          if (!this.isValidEmail(telecom.value)) {
            issues.push({
              severity: 'error',
              code: 'invalid-email-format',
              category: 'business-rule',
              message: `Invalid email format: ${telecom.value}`,
              path: `telecom[${i}].value`,
              suggestion: 'Use valid email format (e.g., user@domain.com)'
            });
          }
        }
        if (telecom.system === 'phone' && telecom.value) {
          if (!this.isValidPhoneNumber(telecom.value)) {
            issues.push({
              severity: 'warning',
              code: 'invalid-phone-format',
              category: 'business-rule',
              message: `Phone number format may be invalid: ${telecom.value}`,
              path: `telecom[${i}].value`,
              suggestion: 'Use standard phone number format with country code'
            });
          }
        }
      }
    }

    return rulesChecked;
  }

  /**
   * Validate Observation-specific business rules
   */
  private async validateObservationBusinessRules(observation: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Effective date should not be in future
    if (observation.effectiveDateTime) {
      rulesChecked++;
      const effectiveDate = new Date(observation.effectiveDateTime);
      const today = new Date();
      
      if (effectiveDate > today) {
        issues.push({
          severity: 'warning',
          code: 'future-observation-date',
          category: 'business-rule',
          message: 'Observation effective date is in the future',
          path: 'effectiveDateTime',
          suggestion: 'Verify observation date is not scheduled for future'
        });
      }
    }

    // Rule 2: Value validation based on observation code
    if (observation.code && observation.valueQuantity) {
      rulesChecked++;
      await this.validateObservationValue(observation, issues);
    }

    // Rule 3: Status consistency with value
    if (observation.status === 'final' && !observation.valueQuantity && !observation.valueString && !observation.valueCodeableConcept) {
      rulesChecked++;
      issues.push({
        severity: 'warning',
        code: 'final-observation-without-value',
        category: 'business-rule',
        message: 'Final observation should have a value',
        path: 'value[x]',
        suggestion: 'Add observation value or change status to preliminary'
      });
    }

    // Rule 4: Reference range validation
    if (observation.valueQuantity && observation.referenceRange) {
      rulesChecked++;
      const value = observation.valueQuantity.value;
      for (const range of observation.referenceRange) {
        if (range.low?.value && value < range.low.value) {
          issues.push({
            severity: 'information',
            code: 'value-below-range',
            category: 'business-rule',
            message: `Observation value ${value} is below reference range (${range.low.value})`,
            path: 'valueQuantity.value',
            suggestion: 'Consider if low value is clinically significant'
          });
        }
        if (range.high?.value && value > range.high.value) {
          issues.push({
            severity: 'information',
            code: 'value-above-range',
            category: 'business-rule',
            message: `Observation value ${value} is above reference range (${range.high.value})`,
            path: 'valueQuantity.value',
            suggestion: 'Consider if high value is clinically significant'
          });
        }
      }
    }

    return rulesChecked;
  }

  /**
   * Validate Condition-specific business rules
   */
  private async validateConditionBusinessRules(condition: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Onset vs Abatement dates
    if (condition.onsetDateTime && condition.abatementDateTime) {
      rulesChecked++;
      const onsetDate = new Date(condition.onsetDateTime);
      const abatementDate = new Date(condition.abatementDateTime);
      
      if (onsetDate >= abatementDate) {
        issues.push({
          severity: 'error',
          code: 'invalid-condition-timeline',
          category: 'business-rule',
          message: 'Condition abatement date must be after onset date',
          path: 'abatementDateTime',
          suggestion: 'Verify condition timeline is chronologically correct'
        });
      }
    }

    // Rule 2: Clinical status vs verification status consistency
    if (condition.clinicalStatus && condition.verificationStatus) {
      rulesChecked++;
      const clinical = condition.clinicalStatus.coding?.[0]?.code;
      const verification = condition.verificationStatus.coding?.[0]?.code;
      
      if (clinical === 'active' && verification === 'refuted') {
        issues.push({
          severity: 'error',
          code: 'status-inconsistency',
          category: 'business-rule',
          message: 'Condition cannot be both active and refuted',
          path: 'verificationStatus',
          suggestion: 'Update clinical or verification status for consistency'
        });
      }
    }

    // Rule 3: Severity and clinical status relationship
    if (condition.severity && condition.clinicalStatus) {
      rulesChecked++;
      const clinical = condition.clinicalStatus.coding?.[0]?.code;
      const severity = condition.severity.coding?.[0]?.code;
      
      if (clinical === 'resolved' && severity === 'severe') {
        issues.push({
          severity: 'warning',
          code: 'severity-status-mismatch',
          category: 'business-rule',
          message: 'Resolved condition with severe severity may be inconsistent',
          path: 'severity',
          suggestion: 'Review if severity should be updated for resolved conditions'
        });
      }
    }

    return rulesChecked;
  }

  /**
   * Validate Encounter-specific business rules
   */
  private async validateEncounterBusinessRules(encounter: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Start vs End time
    if (encounter.period?.start && encounter.period?.end) {
      rulesChecked++;
      const startDate = new Date(encounter.period.start);
      const endDate = new Date(encounter.period.end);
      
      if (startDate >= endDate) {
        issues.push({
          severity: 'error',
          code: 'invalid-encounter-period',
          category: 'business-rule',
          message: 'Encounter end time must be after start time',
          path: 'period.end',
          suggestion: 'Verify encounter period dates are chronologically correct'
        });
      }
    }

    // Rule 2: Status consistency with period
    if (encounter.status === 'finished' && encounter.period?.start && !encounter.period?.end) {
      rulesChecked++;
      issues.push({
        severity: 'error',
        code: 'finished-encounter-no-end',
        category: 'business-rule',
        message: 'Finished encounter must have an end time',
        path: 'period.end',
        suggestion: 'Add end time or change status to in-progress'
      });
    }

    // Rule 3: Class vs type consistency
    if (encounter.class && encounter.type) {
      rulesChecked++;
      // Simplified validation - in practice would use valuesets
      const encounterClass = encounter.class.code;
      const encounterType = encounter.type[0]?.coding?.[0]?.code;
      
      if (encounterClass === 'AMB' && encounterType?.includes('inpatient')) {
        issues.push({
          severity: 'warning',
          code: 'class-type-mismatch',
          category: 'business-rule',
          message: 'Ambulatory class with inpatient type may be inconsistent',
          path: 'type',
          suggestion: 'Verify encounter class and type alignment'
        });
      }
    }

    return rulesChecked;
  }

  /**
   * Validate Procedure-specific business rules
   */
  private async validateProcedureBusinessRules(procedure: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Status consistency with performed date
    if (procedure.status === 'completed' && !procedure.performedDateTime && !procedure.performedPeriod) {
      rulesChecked++;
      issues.push({
        severity: 'error',
        code: 'completed-procedure-no-date',
        category: 'business-rule',
        message: 'Completed procedure must have a performed date',
        path: 'performed[x]',
        suggestion: 'Add performed date or change status'
      });
    }

    // Rule 2: Outcome vs status consistency
    if (procedure.outcome && procedure.status) {
      rulesChecked++;
      const outcome = procedure.outcome.coding?.[0]?.code;
      
      if (procedure.status === 'preparation' && outcome) {
        issues.push({
          severity: 'warning',
          code: 'outcome-before-completion',
          category: 'business-rule',
          message: 'Procedure in preparation should not have outcome',
          path: 'outcome',
          suggestion: 'Remove outcome or update status to completed'
        });
      }
    }

    return rulesChecked;
  }

  /**
   * Validate general business rules applicable to all resources
   */
  private async validateGeneralBusinessRules(resource: any, issues: ValidationIssue[]): Promise<number> {
    let rulesChecked = 0;

    // Rule 1: Meta.lastUpdated should not be in future
    if (resource.meta?.lastUpdated) {
      rulesChecked++;
      const lastUpdated = new Date(resource.meta.lastUpdated);
      const now = new Date();
      
      if (lastUpdated > now) {
        issues.push({
          severity: 'warning',
          code: 'future-last-updated',
          category: 'business-rule',
          message: 'Last updated timestamp is in the future',
          path: 'meta.lastUpdated',
          suggestion: 'Verify system clock is correct'
        });
      }
    }

    // Rule 2: Resource ID format validation
    if (resource.id) {
      rulesChecked++;
      if (!/^[A-Za-z0-9\-\.]{1,64}$/.test(resource.id)) {
        issues.push({
          severity: 'error',
          code: 'invalid-resource-id',
          category: 'business-rule',
          message: `Resource ID format invalid: ${resource.id}`,
          path: 'id',
          suggestion: 'Use alphanumeric characters, hyphens, and dots only (max 64 chars)'
        });
      }
    }

    return rulesChecked;
  }

  /**
   * Helper method to validate observation values based on code
   */
  private async validateObservationValue(observation: any, issues: ValidationIssue[]): Promise<void> {
    const code = observation.code.coding?.[0]?.code;
    const value = observation.valueQuantity?.value;
    const unit = observation.valueQuantity?.unit;

    // Common observation value validations
    if (code === '8310-5' && value !== undefined) { // Body temperature
      if (value < 30 || value > 45) { // Celsius
        issues.push({
          severity: 'warning',
          code: 'abnormal-body-temperature',
          category: 'business-rule',
          message: `Body temperature ${value}°C is outside normal range (30-45°C)`,
          path: 'valueQuantity.value',
          suggestion: 'Verify temperature measurement and unit'
        });
      }
    }

    if (code === '8480-6' && value !== undefined) { // Systolic BP
      if (value < 60 || value > 250) {
        issues.push({
          severity: 'warning',
          code: 'abnormal-blood-pressure',
          category: 'business-rule',
          message: `Systolic blood pressure ${value} mmHg is outside typical range`,
          path: 'valueQuantity.value',
          suggestion: 'Verify blood pressure measurement'
        });
      }
    }
  }

  /**
   * Helper methods for validation
   */
  private isGenderSpecificPrefix(prefix: string, gender: string): boolean {
    const maleTerms = ['Mr.', 'Mr', 'Sir', 'Lord'];
    const femaleTerms = ['Mrs.', 'Mrs', 'Ms.', 'Ms', 'Miss', 'Lady'];
    
    if (gender === 'male' && femaleTerms.includes(prefix)) return true;
    if (gender === 'female' && maleTerms.includes(prefix)) return true;
    
    return false;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Simplified phone validation - accepts various formats
    const phoneRegex = /^[\+]?[\d\s\-\(\)\.]{7,}$/;
    return phoneRegex.test(phone);
  }

  private async performMetadataValidation(resource: any, result: EnhancedValidationResult): Promise<void> {
    console.log(`[EnhancedValidation] Performing metadata validation...`);
    
    const issues: ValidationIssue[] = [];

    // 1. Resource.meta validation
    await this.validateResourceMeta(resource, issues);

    // 2. FHIR version compatibility
    await this.validateFhirVersion(resource, issues);

    // 3. Security and audit metadata
    await this.validateSecurityMetadata(resource, issues);

    // 4. Narrative validation
    await this.validateNarrative(resource, issues);

    // 5. Extension validation
    await this.validateExtensions(resource, issues);

    result.validationAspects.metadata.issues = issues;
    result.validationAspects.metadata.passed = !issues.some(i => i.severity === 'error' || i.severity === 'fatal');
    result.issues.push(...issues);
  }

  /**
   * Validate Resource.meta element
   */
  private async validateResourceMeta(resource: any, issues: ValidationIssue[]): Promise<void> {
    if (!resource.meta) {
      issues.push({
        severity: 'information',
        code: 'missing-meta',
        category: 'metadata',
        message: 'Resource lacks meta element',
        path: 'meta',
        suggestion: 'Consider adding meta element for better resource management'
      });
      return;
    }

    const meta = resource.meta;

    // Validate versionId format
    if (meta.versionId) {
      if (typeof meta.versionId !== 'string' || meta.versionId.length === 0) {
        issues.push({
          severity: 'error',
          code: 'invalid-version-id',
          category: 'metadata',
          message: 'VersionId must be a non-empty string',
          path: 'meta.versionId',
          suggestion: 'Provide a valid version identifier'
        });
      }
    }

    // Validate lastUpdated format and logic
    if (meta.lastUpdated) {
      try {
        const lastUpdated = new Date(meta.lastUpdated);
        const now = new Date();
        
        if (isNaN(lastUpdated.getTime())) {
          issues.push({
            severity: 'error',
            code: 'invalid-last-updated',
            category: 'metadata',
            message: 'LastUpdated timestamp is not a valid date',
            path: 'meta.lastUpdated',
            suggestion: 'Use ISO 8601 date format (YYYY-MM-DDTHH:mm:ss.sssZ)'
          });
        } else if (lastUpdated > now) {
          issues.push({
            severity: 'warning',
            code: 'future-last-updated',
            category: 'metadata',
            message: 'LastUpdated timestamp is in the future',
            path: 'meta.lastUpdated',
            suggestion: 'Verify system clock is correct'
          });
        }
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'invalid-last-updated-format',
          category: 'metadata',
          message: 'LastUpdated timestamp format is invalid',
          path: 'meta.lastUpdated',
          suggestion: 'Use ISO 8601 date format'
        });
      }
    }

    // Validate source if present
    if (meta.source) {
      try {
        new URL(meta.source);
      } catch (error) {
        issues.push({
          severity: 'warning',
          code: 'invalid-source-url',
          category: 'metadata',
          message: `Source URL is not valid: ${meta.source}`,
          path: 'meta.source',
          suggestion: 'Provide a valid URL for the source system'
        });
      }
    }

    // Validate profiles
    if (meta.profile) {
      if (!Array.isArray(meta.profile)) {
        issues.push({
          severity: 'error',
          code: 'invalid-profile-format',
          category: 'metadata',
          message: 'Meta.profile must be an array of canonical URLs',
          path: 'meta.profile',
          suggestion: 'Use array format for profile references'
        });
      } else {
        for (let i = 0; i < meta.profile.length; i++) {
          const profileUrl = meta.profile[i];
          try {
            new URL(profileUrl);
          } catch (error) {
            issues.push({
              severity: 'error',
              code: 'invalid-profile-url',
              category: 'metadata',
              message: `Profile URL is not valid: ${profileUrl}`,
              path: `meta.profile[${i}]`,
              suggestion: 'Use valid canonical URLs for profile references'
            });
          }
        }
      }
    }

    // Validate security labels
    if (meta.security) {
      if (!Array.isArray(meta.security)) {
        issues.push({
          severity: 'error',
          code: 'invalid-security-format',
          category: 'metadata',
          message: 'Meta.security must be an array of Coding elements',
          path: 'meta.security',
          suggestion: 'Use array of Coding elements for security labels'
        });
      }
    }

    // Validate tags
    if (meta.tag) {
      if (!Array.isArray(meta.tag)) {
        issues.push({
          severity: 'error',
          code: 'invalid-tag-format',
          category: 'metadata',
          message: 'Meta.tag must be an array of Coding elements',
          path: 'meta.tag',
          suggestion: 'Use array of Coding elements for tags'
        });
      }
    }
  }

  /**
   * Validate FHIR version compatibility
   */
  private async validateFhirVersion(resource: any, issues: ValidationIssue[]): Promise<void> {
    // Check for FHIR version indicator in meta
    if (resource.meta?.tag) {
      const fhirVersionTag = resource.meta.tag.find((tag: any) => 
        tag.system === 'http://hl7.org/fhir/fhir-version'
      );
      
      if (fhirVersionTag) {
        const version = fhirVersionTag.code;
        const supportedVersions = ['4.0.1', '4.0.0', '4.3.0', '5.0.0'];
        
        if (!supportedVersions.includes(version)) {
          issues.push({
            severity: 'warning',
            code: 'unsupported-fhir-version',
            category: 'metadata',
            message: `FHIR version ${version} may not be fully supported`,
            path: 'meta.tag',
            suggestion: `Consider using supported versions: ${supportedVersions.join(', ')}`
          });
        }
      }
    }

    // Check for deprecated elements or patterns
    if (resource.resourceType === 'Patient' && resource.animal) {
      issues.push({
        severity: 'warning',
        code: 'deprecated-element',
        category: 'metadata',
        message: 'Patient.animal element is deprecated in FHIR R4',
        path: 'animal',
        suggestion: 'Use appropriate resource types for animal patients'
      });
    }
  }

  /**
   * Validate security and audit metadata
   */
  private async validateSecurityMetadata(resource: any, issues: ValidationIssue[]): Promise<void> {
    // Check for required security labels in sensitive resources
    const sensitiveResourceTypes = ['Patient', 'Observation', 'Condition', 'DiagnosticReport'];
    
    if (sensitiveResourceTypes.includes(resource.resourceType)) {
      if (!resource.meta?.security || resource.meta.security.length === 0) {
        issues.push({
          severity: 'information',
          code: 'missing-security-labels',
          category: 'metadata',
          message: 'Sensitive resource lacks security labels',
          path: 'meta.security',
          suggestion: 'Consider adding appropriate security labels for data governance'
        });
      }
    }

    // Validate audit trail completeness
    if (resource.meta?.lastUpdated && !resource.meta?.versionId) {
      issues.push({
        severity: 'warning',
        code: 'incomplete-audit-trail',
        category: 'metadata',
        message: 'Resource has lastUpdated but no versionId',
        path: 'meta.versionId',
        suggestion: 'Include versionId for complete audit trail'
      });
    }
  }

  /**
   * Validate narrative content
   */
  private async validateNarrative(resource: any, issues: ValidationIssue[]): Promise<void> {
    if (resource.text) {
      // Validate narrative status
      const validStatuses = ['generated', 'extensions', 'additional', 'empty'];
      if (!validStatuses.includes(resource.text.status)) {
        issues.push({
          severity: 'error',
          code: 'invalid-narrative-status',
          category: 'metadata',
          message: `Invalid narrative status: ${resource.text.status}`,
          path: 'text.status',
          suggestion: `Use one of: ${validStatuses.join(', ')}`
        });
      }

      // Validate narrative div content
      if (resource.text.status !== 'empty') {
        if (!resource.text.div) {
          issues.push({
            severity: 'error',
            code: 'missing-narrative-div',
            category: 'metadata',
            message: 'Narrative must have div element when status is not empty',
            path: 'text.div',
            suggestion: 'Provide XHTML div content or set status to empty'
          });
        } else if (typeof resource.text.div !== 'string' || resource.text.div.length === 0) {
          issues.push({
            severity: 'error',
            code: 'invalid-narrative-div',
            category: 'metadata',
            message: 'Narrative div must be non-empty XHTML string',
            path: 'text.div',
            suggestion: 'Provide valid XHTML content in div element'
          });
        }
      }
    }
  }

  /**
   * Validate extensions
   */
  private async validateExtensions(resource: any, issues: ValidationIssue[]): Promise<void> {
    await this.validateExtensionsRecursively(resource, '', issues);
  }

  /**
   * Recursively validate extensions in resource
   */
  private async validateExtensionsRecursively(obj: any, path: string, issues: ValidationIssue[]): Promise<void> {
    if (!obj || typeof obj !== 'object') return;

    // Check for extension array
    if (obj.extension && Array.isArray(obj.extension)) {
      for (let i = 0; i < obj.extension.length; i++) {
        const extension = obj.extension[i];
        const extPath = path ? `${path}.extension[${i}]` : `extension[${i}]`;
        
        // Validate extension URL
        if (!extension.url) {
          issues.push({
            severity: 'error',
            code: 'missing-extension-url',
            category: 'metadata',
            message: 'Extension must have URL',
            path: `${extPath}.url`,
            suggestion: 'Provide canonical URL for extension definition'
          });
        } else {
          try {
            new URL(extension.url);
          } catch (error) {
            issues.push({
              severity: 'error',
              code: 'invalid-extension-url',
              category: 'metadata',
              message: `Extension URL is not valid: ${extension.url}`,
              path: `${extPath}.url`,
              suggestion: 'Use valid canonical URL for extension'
            });
          }
        }

        // Validate extension has value or nested extensions
        const hasValue = Object.keys(extension).some(key => key.startsWith('value'));
        const hasNestedExtensions = extension.extension && extension.extension.length > 0;
        
        if (!hasValue && !hasNestedExtensions) {
          issues.push({
            severity: 'error',
            code: 'extension-without-value',
            category: 'metadata',
            message: 'Extension must have either value[x] or nested extensions',
            path: extPath,
            suggestion: 'Add value or nested extensions to extension'
          });
        }

        // Recursively validate nested extensions
        if (hasNestedExtensions) {
          await this.validateExtensionsRecursively(extension, extPath, issues);
        }
      }
    }

    // Check for modifier extensions
    if (obj.modifierExtension && Array.isArray(obj.modifierExtension)) {
      for (let i = 0; i < obj.modifierExtension.length; i++) {
        const modExt = obj.modifierExtension[i];
        const modPath = path ? `${path}.modifierExtension[${i}]` : `modifierExtension[${i}]`;
        
        if (!modExt.url) {
          issues.push({
            severity: 'error',
            code: 'missing-modifier-extension-url',
            category: 'metadata',
            message: 'Modifier extension must have URL',
            path: `${modPath}.url`,
            suggestion: 'Provide canonical URL for modifier extension definition'
          });
        }

        // Modifier extensions are more critical
        const hasValue = Object.keys(modExt).some(key => key.startsWith('value'));
        const hasNestedExtensions = modExt.extension && modExt.extension.length > 0;
        
        if (!hasValue && !hasNestedExtensions) {
          issues.push({
            severity: 'error',
            code: 'modifier-extension-without-value',
            category: 'metadata',
            message: 'Modifier extension must have either value[x] or nested extensions',
            path: modPath,
            suggestion: 'Add value or nested extensions to modifier extension'
          });
        }
      }
    }

    // Recursively check nested objects and arrays
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          await this.validateExtensionsRecursively(value[i], `${currentPath}[${i}]`, issues);
        }
      } else if (typeof value === 'object' && value !== null) {
        await this.validateExtensionsRecursively(value, currentPath, issues);
      }
    }
  }
}