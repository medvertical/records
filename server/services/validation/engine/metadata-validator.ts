/**
 * Metadata Validator
 * 
 * Handles metadata validation of FHIR resources including:
 * - Validate meta.lastUpdated format for R4
 * - Check for required metadata fields in R4
 * - Validate version information for R4
 * - Metadata compliance and format validation
 */

import type { ValidationIssue } from '../types/validation-types';
import moment from 'moment';

export class MetadataValidator {
  async validate(
    resource: any, 
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6' // Task 2.4: Accept FHIR version parameter
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    console.log(`[MetadataValidator] Validating ${resourceType} resource metadata...`);

    try {
      // Validate meta field existence and structure
      const metaIssues = this.validateMetaField(resource, resourceType);
      issues.push(...metaIssues);

      // Validate lastUpdated format if present
      if (resource.meta?.lastUpdated) {
        const lastUpdatedIssues = this.validateLastUpdatedFormat(resource.meta.lastUpdated, resourceType);
        issues.push(...lastUpdatedIssues);
      }

      // Validate versionId format if present
      if (resource.meta && 'versionId' in resource.meta) {
        const versionIssues = this.validateVersionIdFormat(resource.meta.versionId, resourceType);
        issues.push(...versionIssues);
      }

      // Validate profile URLs if present
      if (resource.meta?.profile) {
        const profileIssues = this.validateProfileUrls(resource.meta.profile, resourceType);
        issues.push(...profileIssues);
      }

      // Validate security labels if present
      if (resource.meta?.security) {
        const securityIssues = this.validateSecurityLabels(resource.meta.security, resourceType);
        issues.push(...securityIssues);
      }

      // Validate tags if present
      if (resource.meta?.tag) {
        const tagIssues = this.validateTags(resource.meta.tag, resourceType);
        issues.push(...tagIssues);
      }

      const validationTime = Date.now() - startTime;
      console.log(`[MetadataValidator] Validated ${resourceType} metadata in ${validationTime}ms, found ${issues.length} issues`);

    } catch (error) {
      console.error('[MetadataValidator] Metadata validation failed:', error);
      issues.push({
        id: `metadata-validation-error-${Date.now()}`,
        aspect: 'metadata',
        severity: 'error',
        code: 'metadata-validation-error',
        message: `Metadata validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: '',
        humanReadable: 'Metadata validation encountered an error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType
        },
        validationMethod: 'metadata-validation-error',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate meta field existence and basic structure
   */
  private validateMetaField(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check for required meta field
    if (!resource.meta) {
      issues.push({
        id: `metadata-missing-meta-${Date.now()}`,
        aspect: 'metadata',
        severity: 'warning',
        code: 'missing-meta',
        message: 'Resource should have a meta field',
        path: 'meta',
        humanReadable: 'The resource should include metadata information',
        details: {
          fieldPath: 'meta',
          resourceType: resourceType,
          validationType: 'metadata-field-validation'
        },
        validationMethod: 'metadata-field-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
      return issues;
    }

    // Check meta field type
    if (typeof resource.meta !== 'object' || Array.isArray(resource.meta)) {
      issues.push({
        id: `metadata-invalid-meta-type-${Date.now()}`,
        aspect: 'metadata',
        severity: 'error',
        code: 'invalid-meta-type',
        message: 'Meta field must be an object',
        path: 'meta',
        humanReadable: 'The meta field must be an object containing metadata information',
        details: {
          fieldPath: 'meta',
          actualValue: resource.meta,
          expectedType: 'object',
          resourceType: resourceType,
          validationType: 'metadata-field-validation'
        },
        validationMethod: 'metadata-field-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate meta.lastUpdated format for R4
   */
  private validateLastUpdatedFormat(lastUpdated: string, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Check if lastUpdated is a string
      if (typeof lastUpdated !== 'string') {
        issues.push({
          id: `metadata-invalid-lastUpdated-type-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-lastUpdated-type',
          message: 'lastUpdated must be a string',
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated field must be a string in FHIR instant format',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            expectedType: 'string',
            resourceType: resourceType,
            validationType: 'lastUpdated-format-validation'
          },
          validationMethod: 'lastUpdated-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Validate FHIR instant format (YYYY-MM-DDTHH:mm:ss.sssZ)
      const instantMoment = moment(lastUpdated, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm:ssZ'], true);
      
      if (!instantMoment.isValid()) {
        issues.push({
          id: `metadata-invalid-lastUpdated-format-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-lastUpdated-format',
          message: `Invalid lastUpdated format: ${lastUpdated}. Must be FHIR instant format (YYYY-MM-DDTHH:mm:ss.sssZ)`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated field must be in FHIR instant format (YYYY-MM-DDTHH:mm:ss.sssZ)',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            expectedFormat: 'YYYY-MM-DDTHH:mm:ss.sssZ',
            resourceType: resourceType,
            validationType: 'lastUpdated-format-validation'
          },
          validationMethod: 'lastUpdated-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Check if lastUpdated is in the future (should not be)
      const now = moment();
      if (instantMoment.isAfter(now)) {
        issues.push({
          id: `metadata-future-lastUpdated-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'future-lastUpdated',
          message: `lastUpdated is in the future: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp should not be in the future',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            isFuture: true,
            resourceType: resourceType,
            validationType: 'lastUpdated-format-validation'
          },
          validationMethod: 'lastUpdated-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Check if lastUpdated is too old (more than 10 years)
      const tenYearsAgo = moment().subtract(10, 'years');
      if (instantMoment.isBefore(tenYearsAgo)) {
        issues.push({
          id: `metadata-old-lastUpdated-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'old-lastUpdated',
          message: `lastUpdated is very old: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp is more than 10 years old',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            isOld: true,
            yearsOld: now.diff(instantMoment, 'years'),
            resourceType: resourceType,
            validationType: 'lastUpdated-format-validation'
          },
          validationMethod: 'lastUpdated-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[MetadataValidator] lastUpdated validation failed:', error);
      issues.push({
        id: `metadata-lastUpdated-validation-error-${Date.now()}`,
        aspect: 'metadata',
        severity: 'warning',
        code: 'lastUpdated-validation-error',
        message: `lastUpdated validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: 'meta.lastUpdated',
        humanReadable: 'Unable to validate the lastUpdated timestamp',
        details: {
          fieldPath: 'meta.lastUpdated',
          actualValue: lastUpdated,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType,
          validationType: 'lastUpdated-format-validation'
        },
        validationMethod: 'lastUpdated-format-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Validate versionId format
   */
  private validateVersionIdFormat(versionId: string, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Check if versionId is a string
      if (typeof versionId !== 'string') {
        issues.push({
          id: `metadata-invalid-versionId-type-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-versionId-type',
          message: 'versionId must be a string',
          path: 'meta.versionId',
          humanReadable: 'The versionId field must be a string',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            expectedType: 'string',
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Check if versionId is empty or whitespace-only
      if (!versionId || versionId.trim() === '') {
        issues.push({
          id: `metadata-empty-versionId-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'empty-versionId',
          message: 'versionId cannot be empty',
          path: 'meta.versionId',
          humanReadable: 'The versionId field cannot be empty',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Check if versionId contains invalid characters (should be alphanumeric)
      const validVersionIdPattern = /^[a-zA-Z0-9\-_]+$/;
      if (!validVersionIdPattern.test(versionId)) {
        issues.push({
          id: `metadata-invalid-versionId-characters-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'invalid-versionId-characters',
          message: `versionId contains invalid characters: ${versionId}`,
          path: 'meta.versionId',
          humanReadable: 'The versionId should contain only alphanumeric characters, hyphens, and underscores',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            expectedPattern: 'alphanumeric, hyphens, underscores only',
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[MetadataValidator] versionId validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate profile URLs
   */
  private validateProfileUrls(profiles: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      if (!Array.isArray(profiles)) {
        issues.push({
          id: `metadata-invalid-profile-array-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-profile-array',
          message: 'meta.profile must be an array',
          path: 'meta.profile',
          humanReadable: 'The profile field must be an array of URLs',
          details: {
            fieldPath: 'meta.profile',
            actualValue: profiles,
            expectedType: 'array',
            resourceType: resourceType,
            validationType: 'profile-url-validation'
          },
          validationMethod: 'profile-url-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      profiles.forEach((profile: any, index: number) => {
        if (typeof profile !== 'string') {
          issues.push({
            id: `metadata-invalid-profile-type-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'error',
            code: 'invalid-profile-type',
            message: `Profile at index ${index} must be a string`,
            path: `meta.profile[${index}]`,
            humanReadable: 'Each profile must be a valid URL string',
            details: {
              fieldPath: `meta.profile[${index}]`,
              actualValue: profile,
              expectedType: 'string',
              resourceType: resourceType,
              validationType: 'profile-url-validation'
            },
            validationMethod: 'profile-url-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        } else if (!this.isValidUrl(profile)) {
          issues.push({
            id: `metadata-invalid-profile-url-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'invalid-profile-url',
            message: `Invalid profile URL at index ${index}: ${profile}`,
            path: `meta.profile[${index}]`,
            humanReadable: 'Profile URLs should be valid HTTP/HTTPS URLs',
            details: {
              fieldPath: `meta.profile[${index}]`,
              actualValue: profile,
              expectedFormat: 'valid HTTP/HTTPS URL',
              resourceType: resourceType,
              validationType: 'profile-url-validation'
            },
            validationMethod: 'profile-url-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      });

    } catch (error) {
      console.error('[MetadataValidator] Profile URL validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate security labels
   */
  private validateSecurityLabels(security: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      if (!Array.isArray(security)) {
        issues.push({
          id: `metadata-invalid-security-array-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-security-array',
          message: 'meta.security must be an array',
          path: 'meta.security',
          humanReadable: 'The security field must be an array of coding objects',
          details: {
            fieldPath: 'meta.security',
            actualValue: security,
            expectedType: 'array',
            resourceType: resourceType,
            validationType: 'security-label-validation'
          },
          validationMethod: 'security-label-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Basic validation for security labels - could be enhanced
      security.forEach((securityLabel: any, index: number) => {
        if (typeof securityLabel !== 'object' || Array.isArray(securityLabel)) {
          issues.push({
            id: `metadata-invalid-security-object-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'invalid-security-object',
            message: `Security label at index ${index} must be an object`,
            path: `meta.security[${index}]`,
            humanReadable: 'Each security label must be a coding object',
            details: {
              fieldPath: `meta.security[${index}]`,
              actualValue: securityLabel,
              expectedType: 'object',
              resourceType: resourceType,
              validationType: 'security-label-validation'
            },
            validationMethod: 'security-label-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      });

    } catch (error) {
      console.error('[MetadataValidator] Security label validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate tags
   */
  private validateTags(tags: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      if (!Array.isArray(tags)) {
        issues.push({
          id: `metadata-invalid-tag-array-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-tag-array',
          message: 'meta.tag must be an array',
          path: 'meta.tag',
          humanReadable: 'The tag field must be an array of coding objects',
          details: {
            fieldPath: 'meta.tag',
            actualValue: tags,
            expectedType: 'array',
            resourceType: resourceType,
            validationType: 'tag-validation'
          },
          validationMethod: 'tag-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Basic validation for tags - could be enhanced
      tags.forEach((tag: any, index: number) => {
        if (typeof tag !== 'object' || Array.isArray(tag)) {
          issues.push({
            id: `metadata-invalid-tag-object-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'invalid-tag-object',
            message: `Tag at index ${index} must be an object`,
            path: `meta.tag[${index}]`,
            humanReadable: 'Each tag must be a coding object',
            details: {
              fieldPath: `meta.tag[${index}]`,
              actualValue: tag,
              expectedType: 'object',
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      });

    } catch (error) {
      console.error('[MetadataValidator] Tag validation failed:', error);
    }

    return issues;
  }

  /**
   * Helper method to validate URLs
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}