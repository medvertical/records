/**
 * Enhanced Reference Validator
 * 
 * Handles comprehensive reference validation of FHIR resources including:
 * - Reference integrity checking using Firely server
 * - Reference cardinality validation
 * - Reference resolution and existence verification
 * - Resource type extraction and validation
 * - R4/R5/R6 reference validation
 * - Task 6.1: Enhanced resource type extraction from reference strings
 * - Task 2.10: R6 limited support warning
 */

import type { ValidationIssue } from '../types/validation-types';
import { FirelyClient } from '../../fhir/firely-client';
import { addR6WarningIfNeeded } from '../utils/r6-support-warnings';
import { 
  ReferenceTypeExtractor, 
  type ReferenceParseResult,
  type ReferenceTypeExtractionOptions 
} from '../utils/reference-type-extractor';
import { 
  getReferenceTypeConstraintValidator,
  type ReferenceTypeValidationResult 
} from '../utils/reference-type-constraint-validator';
import { 
  getContainedReferenceResolver,
  type ContainedReferenceResolutionResult 
} from '../utils/contained-reference-resolver';
import { 
  getBundleReferenceResolver,
  type BundleReferenceResolutionResult 
} from '../utils/bundle-reference-resolver';
import { 
  getCircularReferenceDetector,
  type CircularReferenceDetectionResult 
} from '../utils/circular-reference-detector';
import { 
  getRecursiveReferenceValidator,
  type RecursiveValidationConfig,
  type RecursiveValidationResult 
} from '../utils/recursive-reference-validator';
import { 
  getVersionSpecificReferenceValidator,
  type VersionedReferenceInfo,
  type VersionIntegrityCheckResult 
} from '../utils/version-specific-reference-validator';
import { 
  getCanonicalReferenceValidator,
  type CanonicalReferenceInfo,
  type CanonicalValidationResult,
  type CanonicalResourceType 
} from '../utils/canonical-reference-validator';
import { 
  getBatchedReferenceChecker,
  type BatchCheckConfig,
  type BatchCheckResult,
  type ReferenceExistenceCheck 
} from '../utils/batched-reference-checker';

export class ReferenceValidator {
  private firelyClient: FirelyClient;
  private referenceFields: Map<string, Array<{path: string, type: string, required?: boolean}>> = new Map();
  private referenceTypeExtractor: ReferenceTypeExtractor; // Task 6.1: Enhanced reference type extraction
  private constraintValidator = getReferenceTypeConstraintValidator(); // Task 6.2: Type constraint validation
  private containedResolver = getContainedReferenceResolver(); // Task 6.3: Contained reference resolution
  private bundleResolver = getBundleReferenceResolver(); // Task 6.4: Bundle reference resolution
  private circularDetector = getCircularReferenceDetector(10); // Task 6.5: Circular reference detection
  private recursiveValidator = getRecursiveReferenceValidator(); // Task 6.6: Recursive validation
  private versionValidator = getVersionSpecificReferenceValidator(); // Task 6.8: Version integrity checking
  private canonicalValidator = getCanonicalReferenceValidator(); // Task 6.9: Canonical reference validation
  private batchedChecker = getBatchedReferenceChecker(); // Task 6.10: Batched existence checks

  constructor() {
    this.firelyClient = new FirelyClient();
    this.initializeReferenceFields();
    
    // Task 6.1: Initialize reference type extractor with validation enabled
    this.referenceTypeExtractor = new ReferenceTypeExtractor({
      allowContained: true,
      allowCanonical: true,
      extractVersion: true,
      validateResourceType: true
    });
  }

  /**
   * Initialize reference fields for different resource types
   */
  private initializeReferenceFields(): void {
    // Patient references
    this.referenceFields.set('Patient', [
      { path: 'generalPractitioner', type: 'Reference', required: false },
      { path: 'managingOrganization', type: 'Reference', required: false },
      { path: 'link.other', type: 'Reference', required: false }
    ]);

    // Observation references
    this.referenceFields.set('Observation', [
      { path: 'subject', type: 'Reference', required: false },
      { path: 'focus', type: 'Reference', required: false },
      { path: 'encounter', type: 'Reference', required: false },
      { path: 'performer', type: 'Reference', required: false },
      { path: 'specimen', type: 'Reference', required: false },
      { path: 'device', type: 'Reference', required: false },
      { path: 'hasMember', type: 'Reference', required: false },
      { path: 'derivedFrom', type: 'Reference', required: false }
    ]);

    // Condition references
    this.referenceFields.set('Condition', [
      { path: 'subject', type: 'Reference', required: true },
      { path: 'encounter', type: 'Reference', required: false },
      { path: 'recorder', type: 'Reference', required: false },
      { path: 'asserter', type: 'Reference', required: false }
    ]);

    // Encounter references
    this.referenceFields.set('Encounter', [
      { path: 'subject', type: 'Reference', required: false },
      { path: 'episodeOfCare', type: 'Reference', required: false },
      { path: 'basedOn', type: 'Reference', required: false },
      { path: 'participant.individual', type: 'Reference', required: false },
      { path: 'appointment', type: 'Reference', required: false },
      { path: 'reasonReference', type: 'Reference', required: false },
      { path: 'account', type: 'Reference', required: false },
      { path: 'serviceProvider', type: 'Reference', required: false },
      { path: 'partOf', type: 'Reference', required: false }
    ]);

    // Bundle references
    this.referenceFields.set('Bundle', [
      { path: 'entry.resource', type: 'Reference', required: false }
    ]);

    console.log(`[ReferenceValidator] Initialized reference fields for ${this.referenceFields.size} FHIR R4 resource types`);
  }

  async validate(
    resource: any, 
    resourceType: string, 
    fhirClient?: any,
    fhirVersion?: 'R4' | 'R5' | 'R6' // Task 2.4: Accept FHIR version parameter
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();
    
    console.log(`[ReferenceValidator] Enhanced reference validation for ${resourceType}...`);
    
    try {
      // Task 6.5: Check for circular references first
      const circularResult = this.circularDetector.detectCircularReferences(resource);
      if (circularResult.hasCircularReference && circularResult.circularChain) {
        issues.push(this.createValidationIssue({
          id: `circular-reference-${Date.now()}`,
          severity: 'error',
          code: 'circular-reference-detected',
          message: `Circular reference detected: ${this.circularDetector.formatCircularChain(circularResult.circularChain)}`,
          path: '',
          details: {
            circularChain: circularResult.circularChain,
            totalReferences: circularResult.totalReferences,
            maxDepth: circularResult.maxDepth,
          },
        }));
        console.warn(`[ReferenceValidator] ⚠️  Circular reference detected, chain: ${circularResult.circularChain.join(' → ')}`);
      }

      // Task 6.4: Special handling for Bundle resources
      if (resourceType === 'Bundle') {
        console.log(`[ReferenceValidator] Performing Bundle-specific reference validation...`);
        const bundleIssues = this.validateBundleReferences(resource);
        issues.push(...bundleIssues);
        
        // Also validate individual entries within the Bundle
        const entries = this.bundleResolver.getAllBundleResources(resource);
        for (let i = 0; i < entries.length; i++) {
          const entryResource = entries[i];
          if (entryResource && entryResource.resourceType) {
            console.log(`[ReferenceValidator] Validating Bundle entry[${i}]: ${entryResource.resourceType}`);
            const entryIssues = await this.performFallbackReferenceValidation(entryResource, entryResource.resourceType);
            // Prefix paths with entry index
            const prefixedIssues = entryIssues.map(issue => ({
              ...issue,
              path: `entry[${i}].resource.${issue.path}`,
            }));
            issues.push(...prefixedIssues);
          }
        }
      } else {
        // Task 6.1: Standard reference validation with type extraction
        const enhancedIssues = await this.performFallbackReferenceValidation(resource, resourceType);
        issues.push(...enhancedIssues);
      }

      // Add R6 warning if needed (Task 2.10)
      const issuesWithR6Warning = addR6WarningIfNeeded(issues, fhirVersion, 'reference');
      
      const validationTime = Date.now() - startTime;
      console.log(`[ReferenceValidator] Enhanced validation completed for ${resourceType} in ${validationTime}ms, found ${issuesWithR6Warning.length} issues`);
      
      return issuesWithR6Warning;
    } catch (error) {
      console.error('[ReferenceValidator] Enhanced reference validation failed:', error);
      return [{
        id: `reference-error-${Date.now()}`,
        aspect: 'reference',
        severity: 'error',
        code: 'reference-validation-error',
        message: `Reference validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        details: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        }),
        timestamp: new Date(),
      }];
    }
  }

  /**
   * Perform comprehensive reference validation using enhanced type extraction
   * Task 6.1: Full validation with connectivity-aware fallback
   * Task 6.3: Contained reference validation support
   */
  private async performComprehensiveReferenceValidation(
    resource: any, 
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6'
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    console.log(`[ReferenceValidator] Performing comprehensive validation for ${resourceType}`);
    
    // Task 6.3: First validate all contained references
    const containedIssues = this.validateContainedReferencesInResource(resource, resourceType);
    issues.push(...containedIssues);
    
    // Validate reference fields
    const referenceFields = this.referenceFields.get(resourceType) || [];
    
    for (const field of referenceFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const fieldIssues = await this.validateReferenceFieldEnhanced(fieldValue, field, resourceType, 'full', resource);
        issues.push(...fieldIssues);
      } else if (field.required) {
        // Required field is missing
        issues.push(this.createValidationIssue({
          id: `reference-required-missing-${Date.now()}-${field.path}`,
          severity: 'error',
          code: 'required-reference-missing',
          message: `Required reference field '${field.path}' is missing`,
          path: field.path,
          details: {
            fieldPath: field.path,
            resourceType: resourceType,
            validationMethod: 'comprehensive'
          },
        }));
      }
    }

    // Add R6 warning if needed (Task 2.10)
    return addR6WarningIfNeeded(issues, fhirVersion, 'reference');
    }


  /**
   * Validate reference format using enhanced type extractor
   * Task 6.1: Enhanced reference format validation with resource type extraction
   */
  private validateReferenceFormat(reference: string): {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    humanReadable: string;
    parseResult?: ReferenceParseResult;
  } {
    // Use the reference type extractor to parse the reference
    const parseResult = this.referenceTypeExtractor.parseReference(reference);
    
    if (!parseResult.isValid) {
      return {
        isValid: false,
        severity: 'error',
        code: 'invalid-reference-format',
        message: `Invalid reference format: ${reference}`,
        humanReadable: `The reference '${reference}' does not follow a valid FHIR reference format`,
        parseResult
      };
    }

    // Additional validation based on reference type
    switch (parseResult.referenceType) {
      case 'relative':
        if (!parseResult.resourceType || !parseResult.resourceId) {
          return {
            isValid: false,
            severity: 'error',
            code: 'incomplete-relative-reference',
            message: `Relative reference missing resource type or ID: ${reference}`,
            humanReadable: `The relative reference '${reference}' must include both resource type and ID`,
            parseResult
          };
        }
        break;
        
      case 'absolute':
        if (!parseResult.resourceType) {
          return {
            isValid: false,
            severity: 'warning',
            code: 'unrecognized-absolute-reference',
            message: `Could not extract resource type from absolute reference: ${reference}`,
            humanReadable: `Unable to determine resource type from absolute reference '${reference}'`,
            parseResult
          };
        }
        break;
        
      case 'canonical':
        if (!parseResult.resourceType) {
          return {
            isValid: false,
            severity: 'warning',
            code: 'unrecognized-canonical-reference',
            message: `Could not extract resource type from canonical reference: ${reference}`,
            humanReadable: `Unable to determine resource type from canonical reference '${reference}'`,
            parseResult
          };
        }
        break;
        
      case 'contained':
        if (!parseResult.resourceId) {
          return {
            isValid: false,
            severity: 'error',
            code: 'invalid-contained-reference',
            message: `Contained reference missing resource ID: ${reference}`,
            humanReadable: `The contained reference '${reference}' must include a resource ID after the #`,
            parseResult
          };
        }
        break;
        
      case 'fragment':
        // Fragment references are typically valid
        break;
    }

    return {
      isValid: true,
      severity: 'info',
      code: 'reference-format-valid',
      message: `Reference '${reference}' has valid ${parseResult.referenceType} format (${parseResult.resourceType || 'contained'})`,
      humanReadable: `The reference '${reference}' follows a valid FHIR ${parseResult.referenceType} reference format`,
      parseResult
    };
  }

  /**
   * Extract resource type from reference string
   * Task 6.1: Public method for resource type extraction
   */
  public extractResourceType(reference: string): string | null {
    return this.referenceTypeExtractor.extractResourceType(reference);
  }

  /**
   * Parse reference and get detailed information
   * Task 6.1: Public method for reference parsing
   */
  public parseReference(reference: string): ReferenceParseResult {
    return this.referenceTypeExtractor.parseReference(reference);
  }

  /**
   * Validate reference type against constraints
   * Task 6.2: Public method for reference type constraint validation
   */
  public validateReferenceTypeConstraint(
    reference: string,
    resourceType: string,
    fieldPath: string
  ): ReferenceTypeValidationResult {
    return this.constraintValidator.validateReferenceType(reference, resourceType, fieldPath);
  }

  /**
   * Get type constraints for a field
   * Task 6.2: Public method for constraint inspection
   */
  public getFieldConstraints(resourceType: string, fieldPath: string) {
    return this.constraintValidator.getConstraintsForField(resourceType, fieldPath);
  }

  /**
   * Check if a field has type constraints
   * Task 6.2: Public method to check constraint existence
   */
  public hasTypeConstraints(resourceType: string, fieldPath: string): boolean {
    return this.constraintValidator.hasConstraints(resourceType, fieldPath);
  }

  /**
   * Resolve a contained reference
   * Task 6.3: Public method for contained reference resolution
   */
  public resolveContainedReference(reference: string, parentResource: any) {
    return this.containedResolver.resolveContainedReference(reference, parentResource);
  }

  /**
   * Get all contained resources from a resource
   * Task 6.3: Public method to extract contained resources
   */
  public getContainedResources(resource: any) {
    return this.containedResolver.extractContainedResources(resource);
  }

  /**
   * Validate all contained references in a resource
   * Task 6.3: Public method for comprehensive contained reference validation
   */
  public validateContainedReferences(resource: any, resourceType: string): ValidationIssue[] {
    return this.validateContainedReferencesInResource(resource, resourceType);
  }

  /**
   * Resolve a Bundle reference
   * Task 6.4: Public method for Bundle reference resolution
   */
  public resolveBundleReference(reference: string, bundle: any): BundleReferenceResolutionResult {
    return this.bundleResolver.resolveBundleReference(reference, bundle);
  }

  /**
   * Validate all Bundle references
   * Task 6.4: Public method for Bundle reference validation
   */
  public validateBundleReferences(bundle: any): ValidationIssue[] {
    const bundleValidation = this.bundleResolver.validateBundleReferencesOptimized(bundle);
    
    return bundleValidation.issues.map((issue, index) => 
      this.createValidationIssue({
        id: `bundle-ref-${Date.now()}-${index}`,
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        path: issue.entryIndex !== undefined ? `entry[${issue.entryIndex}]` : '',
        details: {
          reference: issue.reference,
          entryIndex: issue.entryIndex,
        },
      })
    );
  }

  /**
   * Detect circular references in a resource
   * Task 6.5: Public method for circular reference detection
   */
  public detectCircularReferences(resource: any): CircularReferenceDetectionResult {
    return this.circularDetector.detectCircularReferences(resource);
  }

  /**
   * Check if a reference chain would create a circular reference
   * Task 6.5: Public method for circular reference checking
   */
  public wouldCreateCircularReference(currentChain: string[], newReference: string): boolean {
    return this.circularDetector.wouldCreateCircularReference(currentChain, newReference);
  }

  /**
   * Validate references recursively
   * Task 6.6 & 6.7: Public method for recursive reference validation with depth limits
   */
  public async validateRecursively(
    resource: any,
    config?: Partial<RecursiveValidationConfig>,
    resourceFetcher?: (reference: string) => Promise<any>
  ): Promise<RecursiveValidationResult> {
    return this.recursiveValidator.validateRecursively(resource, config, resourceFetcher);
  }

  /**
   * Estimate cost of recursive validation
   * Task 6.6: Public method for validation cost estimation
   */
  public estimateRecursiveValidationCost(
    resource: any,
    config?: Partial<RecursiveValidationConfig>
  ) {
    return this.recursiveValidator.estimateValidationCost(resource, config);
  }

  /**
   * Get recursive validation configuration
   * Task 6.7: Public method to get validation config
   */
  public getRecursiveValidationConfig(): RecursiveValidationConfig {
    return this.recursiveValidator.getDefaultConfig();
  }

  /**
   * Parse versioned reference information
   * Task 6.8: Public method for version parsing
   */
  public parseVersionedReference(reference: string): VersionedReferenceInfo {
    return this.versionValidator.parseVersionedReference(reference);
  }

  /**
   * Validate a versioned reference
   * Task 6.8: Public method for version validation
   */
  public validateVersionedReference(reference: string): VersionIntegrityCheckResult {
    return this.versionValidator.validateVersionedReference(reference);
  }

  /**
   * Check version consistency across multiple references
   * Task 6.8: Public method for consistency checking
   */
  public checkVersionConsistency(references: string[]) {
    return this.versionValidator.checkVersionConsistency(references);
  }

  /**
   * Extract all versioned references from a resource
   * Task 6.8: Public method for version extraction
   */
  public extractVersionedReferences(resource: any): VersionedReferenceInfo[] {
    return this.versionValidator.extractVersionedReferences(resource);
  }

  /**
   * Validate Bundle version integrity
   * Task 6.8: Public method for Bundle version validation
   */
  public validateBundleVersionIntegrity(bundle: any) {
    return this.versionValidator.validateBundleVersionIntegrity(bundle);
  }

  /**
   * Parse canonical URL
   * Task 6.9: Public method for canonical parsing
   */
  public parseCanonicalUrl(canonical: string): CanonicalReferenceInfo {
    return this.canonicalValidator.parseCanonicalUrl(canonical);
  }

  /**
   * Validate canonical URL
   * Task 6.9: Public method for canonical validation
   */
  public validateCanonicalUrl(
    canonical: string,
    expectedResourceType?: CanonicalResourceType
  ): CanonicalValidationResult {
    return this.canonicalValidator.validateCanonicalUrl(canonical, expectedResourceType);
  }

  /**
   * Validate profile canonical URL
   * Task 6.9: Public method for profile canonical validation
   */
  public validateProfileCanonical(canonical: string): CanonicalValidationResult {
    return this.canonicalValidator.validateProfileCanonical(canonical);
  }

  /**
   * Validate value set canonical URL
   * Task 6.9: Public method for value set canonical validation
   */
  public validateValueSetCanonical(canonical: string): CanonicalValidationResult {
    return this.canonicalValidator.validateValueSetCanonical(canonical);
  }

  /**
   * Extract all canonical URLs from a resource
   * Task 6.9: Public method for canonical extraction
   */
  public extractCanonicalUrls(resource: any): CanonicalReferenceInfo[] {
    return this.canonicalValidator.extractCanonicalUrls(resource);
  }

  /**
   * Validate all canonical URLs in a resource
   * Task 6.9: Public method for resource canonical validation
   */
  public validateResourceCanonicals(resource: any): CanonicalValidationResult[] {
    return this.canonicalValidator.validateResourceCanonicals(resource);
  }

  /**
   * Validate Bundle canonical references
   * Task 6.9: Public method for Bundle canonical validation
   */
  public validateBundleCanonicals(bundle: any) {
    return this.canonicalValidator.validateBundleCanonicals(bundle);
  }

  /**
   * Check existence of multiple references in batch
   * Task 6.10: Public method for batched existence checks
   */
  public async checkBatchReferences(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    return this.batchedChecker.checkBatch(references, config);
  }

  /**
   * Check all references in a resource
   * Task 6.10: Public method for resource reference existence checks
   */
  public async checkResourceReferences(
    resource: any,
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    return this.batchedChecker.checkResourceReferences(resource, config);
  }

  /**
   * Check all references in a Bundle
   * Task 6.10: Public method for Bundle reference existence checks
   */
  public async checkBundleReferenceExistence(
    bundle: any,
    config?: Partial<BatchCheckConfig>
  ): Promise<BatchCheckResult> {
    return this.batchedChecker.checkBundleReferences(bundle, config);
  }

  /**
   * Filter existing references
   * Task 6.10: Public method to get only existing references
   */
  public async filterExistingReferences(
    references: string[],
    config?: Partial<BatchCheckConfig>
  ): Promise<string[]> {
    return this.batchedChecker.filterExistingReferences(references, config);
  }

  /**
   * Perform enhanced fallback reference validation when Firely server is unavailable
   * Task 6.1: Enhanced fallback validation with resource type extraction
   * Task 6.3: Contained reference validation
   */
  private async performFallbackReferenceValidation(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    console.log(`[ReferenceValidator] Performing enhanced fallback validation for ${resourceType}`);

    // Task 6.3: First validate all contained references
    const containedIssues = this.validateContainedReferencesInResource(resource, resourceType);
    issues.push(...containedIssues);

    // Use reference fields for fallback validation
    const referenceFields = this.referenceFields.get(resourceType) || [];
    
    for (const field of referenceFields) {
      const fieldValue = this.getFieldValue(resource, field.path);
      
      if (fieldValue !== undefined && fieldValue !== null) {
        const fieldIssues = await this.validateReferenceFieldEnhanced(fieldValue, field, resourceType, 'fallback', resource);
        issues.push(...fieldIssues);
      } else if (field.required) {
        // Required field is missing
        issues.push(this.createValidationIssue({
          id: `reference-required-missing-${Date.now()}-${field.path}`,
          severity: 'error',
          code: 'required-reference-missing',
          message: `Required reference field '${field.path}' is missing`,
          path: field.path,
          details: {
            fieldPath: field.path,
            resourceType: resourceType,
            validationMethod: 'fallback'
          },
        }));
      }
    }

    return issues;
  }

  /**
   * Enhanced reference field validation with type extraction
   * Task 6.1: Validate individual reference fields with detailed type information
   * Task 6.3: Contained reference support
   */
  private async validateReferenceFieldEnhanced(
    fieldValue: any,
    field: any,
    resourceType: string,
    validationContext: 'full' | 'fallback' = 'full',
    parentResource?: any
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    try {
      // Handle different field value types
      if (typeof fieldValue === 'string') {
        // Direct string reference
        const referenceIssues = await this.validateSingleReference(fieldValue, field.path, resourceType, validationContext, parentResource);
        issues.push(...referenceIssues);
      } else if (Array.isArray(fieldValue)) {
        // Array of references
        for (let i = 0; i < fieldValue.length; i++) {
          const item = fieldValue[i];
          const arrayPath = `${field.path}[${i}]`;
          
          if (typeof item === 'string') {
            const referenceIssues = await this.validateSingleReference(item, arrayPath, resourceType, validationContext, parentResource);
            issues.push(...referenceIssues);
          } else if (item && typeof item === 'object' && item.reference) {
            const referenceIssues = await this.validateSingleReference(item.reference, `${arrayPath}.reference`, resourceType, validationContext, parentResource);
            issues.push(...referenceIssues);
          }
        }
      } else if (fieldValue && typeof fieldValue === 'object') {
        // Single reference object
        if (fieldValue.reference) {
          const referenceIssues = await this.validateSingleReference(fieldValue.reference, `${field.path}.reference`, resourceType, validationContext, parentResource);
          issues.push(...referenceIssues);
        } else {
          // Reference object without reference property
          issues.push(this.createValidationIssue({
            id: `reference-object-missing-reference-${Date.now()}-${field.path}`,
            severity: 'error',
            code: 'reference-object-missing-reference',
            message: `Reference object at '${field.path}' missing 'reference' property`,
            path: field.path,
              details: {
              fieldPath: field.path,
              actualValue: fieldValue,
              resourceType: resourceType,
              validationMethod: validationContext
            },
          }));
        }
      }

    } catch (error) {
      console.error('[ReferenceValidator] Enhanced field validation failed:', error);
      issues.push(this.createValidationIssue({
        id: `reference-enhanced-field-error-${Date.now()}-${field.path}`,
        severity: 'warning',
        code: 'reference-field-validation-error',
        message: `Enhanced reference field validation failed for '${field.path}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: field.path,
        details: {
          fieldPath: field.path,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        },
      }));
    }

    return issues;
  }

  /**
   * Validate a single reference string with enhanced type extraction
   * Task 6.1: Core single reference validation with type information
   * Task 6.2: Reference type constraint validation
   * Task 6.3: Contained reference resolution and validation
   */
  private async validateSingleReference(
    reference: string,
    fieldPath: string,
    resourceType: string,
    validationContext: 'full' | 'fallback' = 'full',
    parentResource?: any
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // First validate format and extract type information
      const formatValidation = this.validateReferenceFormat(reference);
    
      if (!formatValidation.isValid) {
      issues.push(this.createValidationIssue({
        id: `reference-format-invalid-${Date.now()}-${fieldPath}`,
        severity: formatValidation.severity,
        code: formatValidation.code,
        message: formatValidation.message,
        path: fieldPath,
        details: {
          fieldPath,
          actualReference: reference,
          resourceType,
          parseResult: formatValidation.parseResult,
          validationMethod: validationContext
        },
      }));
      return issues;
    }

    const parseResult = formatValidation.parseResult!;

    // Task 6.3: Handle contained references
    if (parseResult.referenceType === 'contained' && parentResource) {
      const containedIssues = this.validateContainedReferenceWithConstraints(
        reference,
        parentResource,
        fieldPath,
        resourceType
      );
      issues.push(...containedIssues);
      return issues; // Contained references don't need further validation
    }

    // Task 6.2: Validate reference type against constraints (for non-contained references)
    const typeValidation = this.constraintValidator.validateReferenceType(
      reference,
      resourceType,
      fieldPath
    );

    if (!typeValidation.isValid && typeValidation.severity === 'error') {
      issues.push(this.createValidationIssue({
        id: `reference-type-constraint-${Date.now()}-${fieldPath}`,
        severity: typeValidation.severity,
        code: typeValidation.code || 'reference-type-constraint-violation',
        message: typeValidation.message,
        path: fieldPath,
        details: {
          fieldPath,
          actualReference: reference,
          actualType: typeValidation.actualType,
          expectedTypes: typeValidation.expectedTypes,
          resourceType,
          parseResult: typeValidation.parseResult,
          validationMethod: validationContext
        },
      }));
    } else if (parseResult.resourceType) {
      console.log(`[ReferenceValidator] ✓ Reference type '${parseResult.resourceType}' valid for ${resourceType}.${fieldPath}: ${reference}`);
    }

    return issues;
  }

  /**
   * Validate all contained references in a resource
   * Task 6.3: Contained reference validation
   */
  private validateContainedReferencesInResource(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check if resource has contained resources
    if (!this.containedResolver.hasContainedResources(resource)) {
      return issues; // No contained resources, nothing to validate
    }

    // Find all contained references in the resource
    const containedReferences = this.containedResolver.findContainedReferences(resource);
    
    if (containedReferences.length === 0) {
      // Warn about unreferenced contained resources
      const { warnings } = this.containedResolver.validateUnreferencedContainedResources(resource);
      
      warnings.forEach(warning => {
        issues.push(this.createValidationIssue({
          id: `unreferenced-contained-${Date.now()}-${Math.random()}`,
          severity: 'warning',
          code: 'unreferenced-contained-resource',
          message: warning,
          path: 'contained',
          details: {
            resourceType,
          },
        }));
      });
    }

    // Check for orphaned references
    const orphanedRefs = this.containedResolver.findOrphanedReferences(resource);
    orphanedRefs.forEach(({ reference }) => {
      issues.push(this.createValidationIssue({
        id: `orphaned-contained-ref-${Date.now()}-${reference}`,
      severity: 'error',
        code: 'orphaned-contained-reference',
        message: `Contained reference '${reference}' points to non-existent contained resource`,
        path: '',
        details: {
          reference,
          resourceType,
          availableContainedIds: this.containedResolver.getContainedResourceIds(resource),
        },
      }));
    });

    return issues;
  }

  /**
   * Validate contained reference with type constraints
   * Task 6.3: Contained reference validation with type checking
   */
  private validateContainedReferenceWithConstraints(
    reference: string,
    parentResource: any,
    fieldPath: string,
    parentResourceType: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Get expected types for this field
    const constraints = this.constraintValidator.getConstraintsForField(parentResourceType, fieldPath);
    const expectedTypes = constraints?.targetTypes;

    // Resolve the contained reference
    const validation = this.containedResolver.validateContainedReference(
      reference,
      parentResource,
      expectedTypes
    );

    if (!validation.isValid) {
      issues.push(this.createValidationIssue({
        id: `contained-ref-invalid-${Date.now()}-${fieldPath}`,
        severity: validation.severity,
        code: validation.code || 'contained-reference-invalid',
        message: validation.message,
        path: fieldPath,
            details: {
          fieldPath,
          reference,
          expectedTypes,
          resolution: validation.resolution,
          parentResourceType,
        },
      }));
    } else if (validation.resolution?.resource) {
      console.log(`[ReferenceValidator] ✓ Contained reference '${reference}' resolved to ${validation.resolution.resource.resourceType}`);
    }

    return issues;
  }

  /**
   * Get field value from resource using dot notation
   */
  private getFieldValue(resource: any, fieldPath: string): any {
    if (!fieldPath) return resource;
    
    const parts = fieldPath.split('.');
    let current = resource;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    
    return current;
  }

  /**
   * Parse error location from field path
   */
  private parseErrorLocation(fieldPath: string): any {
    return {
      field: fieldPath,
      path: fieldPath.split('.'),
      depth: fieldPath.split('.').length
    };
  }

  /**
   * Create a properly formatted ValidationIssue
   * Helper to ensure consistent issue format
   */
  private createValidationIssue(params: {
    id: string;
    severity: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    path?: string;
    details?: any;
  }): ValidationIssue {
    return {
      id: params.id,
      aspect: 'reference',
      severity: params.severity,
      code: params.code,
      message: params.message,
      path: params.path || '',
      details: params.details ? JSON.stringify(params.details) : undefined,
      timestamp: new Date(),
    };
  }
}