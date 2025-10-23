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
import type { HapiValidationCoordinator } from './hapi-validation-coordinator';

/**
 * Task 8.11: Required metadata rules by resource type
 */
interface MetadataRequirement {
  field: 'versionId' | 'lastUpdated' | 'profile' | 'security' | 'tag' | 'source';
  severity: 'error' | 'warning' | 'info';
  reason: string;
}

/**
 * Task 8.11: Metadata requirements per resource type
 */
const RESOURCE_METADATA_REQUIREMENTS: Record<string, MetadataRequirement[]> = {
  // Clinical resources that should track provenance
  'Patient': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Patient resources should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for audit purposes' },
  ],
  'Observation': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Observation resources should track last modification time' },
    { field: 'security', severity: 'info', reason: 'Security labels recommended for sensitive observations' },
  ],
  'Condition': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Condition resources should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for clinical accuracy' },
  ],
  'MedicationRequest': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Medication orders should track last modification time' },
    { field: 'versionId', severity: 'warning', reason: 'Version tracking important for medication safety' },
    { field: 'security', severity: 'info', reason: 'Security labels recommended for prescription data' },
  ],
  'AllergyIntolerance': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Allergy records should track last modification time' },
    { field: 'versionId', severity: 'warning', reason: 'Version tracking critical for patient safety' },
    { field: 'security', severity: 'info', reason: 'Security labels recommended for allergy data' },
  ],
  'Immunization': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Immunization records should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for immunization history' },
  ],
  'Procedure': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Procedure records should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for audit purposes' },
  ],
  'DiagnosticReport': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Diagnostic reports should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for report history' },
    { field: 'security', severity: 'info', reason: 'Security labels recommended for diagnostic data' },
  ],
  // Infrastructure resources
  'Bundle': [
    { field: 'lastUpdated', severity: 'info', reason: 'Bundle modification time helps track freshness' },
  ],
  'Provenance': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Provenance resources should track when they were created' },
    { field: 'security', severity: 'info', reason: 'Security labels recommended for audit trail integrity' },
  ],
  'AuditEvent': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Audit events must track creation time' },
    { field: 'security', severity: 'warning', reason: 'Security labels important for audit integrity' },
  ],
  'Consent': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Consent records must track last modification time' },
    { field: 'versionId', severity: 'warning', reason: 'Version tracking critical for legal compliance' },
    { field: 'security', severity: 'warning', reason: 'Security labels required for consent data' },
  ],
  // Financial resources
  'Claim': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Claims should track last modification time' },
    { field: 'versionId', severity: 'warning', reason: 'Version tracking important for billing accuracy' },
  ],
  'Coverage': [
    { field: 'lastUpdated', severity: 'warning', reason: 'Coverage records should track last modification time' },
    { field: 'versionId', severity: 'info', reason: 'Version tracking recommended for coverage changes' },
  ],
};

export class MetadataValidator {
  async validate(
    resource: any, 
    resourceType: string,
    fhirVersion?: 'R4' | 'R5' | 'R6', // Task 2.4: Accept FHIR version parameter
    coordinator?: HapiValidationCoordinator
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const startTime = Date.now();

    console.log(`[MetadataValidator] Validating ${resourceType} resource metadata...`);

    try {
      // Check coordinator first
      if (coordinator) {
        const resourceId = `${resource.resourceType}/${resource.id}`;
        const coordinatorIssues = coordinator.getIssuesByAspect(resourceId, 'metadata');
        
        if (coordinatorIssues.length > 0) {
          console.log(`[MetadataValidator] Using ${coordinatorIssues.length} issues from coordinator`);
          const validationTime = Date.now() - startTime;
          console.log(
            `[MetadataValidator] Validated ${resourceType} metadata in ${validationTime}ms ` +
            `(${coordinatorIssues.length} issues, source: coordinator)`
          );
          return coordinatorIssues;
        }
      }

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
        
        // Task 8.1: Check versionId consistency
        const consistencyIssues = this.validateVersionIdConsistency(resource, resourceType);
        issues.push(...consistencyIssues);
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

      // Task 8.3: Validate source URI if present
      if (resource.meta?.source) {
        const sourceIssues = this.validateSourceUri(resource.meta.source, resourceType);
        issues.push(...sourceIssues);
      }

      // Task 8.11: Check required metadata based on resource type
      const requiredMetadataIssues = this.validateRequiredMetadata(resource, resourceType);
      issues.push(...requiredMetadataIssues);

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
   * Task 8.2: Enhanced timestamp validation with format, timezone, and chronological order
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

      // Task 8.2: Validate timezone is present and properly formatted FIRST
      // FHIR instant MUST include timezone - check the raw string before parsing
      if (!this.hasTimezone(lastUpdated)) {
        issues.push({
          id: `metadata-lastUpdated-missing-timezone-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'lastUpdated-missing-timezone',
          message: `lastUpdated must include timezone: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp must include a timezone (e.g., Z for UTC or +HH:mm)',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            expectedFormat: 'YYYY-MM-DDTHH:mm:ss[.sss]Z or YYYY-MM-DDTHH:mm:ss[.sss]+HH:mm',
            resourceType: resourceType,
            validationType: 'lastUpdated-timezone-validation'
          },
          validationMethod: 'lastUpdated-timezone-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        // Still continue to parse for other validations
      }

      // Task 8.2: Validate FHIR instant format with strict parsing
      // FHIR instant: YYYY-MM-DDTHH:mm:ss.sss+zz:zz (with timezone required)
      const instantMoment = moment(lastUpdated, moment.ISO_8601, true);
      
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
            expectedFormat: 'YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ssZ',
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

      // Task 8.2: Recommend UTC timezone (Z) for consistency
      if (!lastUpdated.endsWith('Z') && this.hasTimezone(lastUpdated)) {
        issues.push({
          id: `metadata-lastUpdated-non-utc-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'lastUpdated-non-utc-timezone',
          message: `lastUpdated uses non-UTC timezone: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'Consider using UTC timezone (Z) for lastUpdated for consistency across systems',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            recommendation: 'Use UTC timezone (Z) instead of offset-based timezone',
            resourceType: resourceType,
            validationType: 'lastUpdated-timezone-validation'
          },
          validationMethod: 'lastUpdated-timezone-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.2: Validate precision (should include seconds, milliseconds optional)
      if (!this.hasSeconds(lastUpdated)) {
        issues.push({
          id: `metadata-lastUpdated-missing-seconds-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'lastUpdated-missing-seconds',
          message: `lastUpdated should include seconds: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp should include seconds precision (HH:mm:ss)',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            expectedFormat: 'YYYY-MM-DDTHH:mm:ss[.sss]Z',
            resourceType: resourceType,
            validationType: 'lastUpdated-format-validation'
          },
          validationMethod: 'lastUpdated-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.2: Check if lastUpdated is in the future (chronological validation)
      const now = moment();
      if (instantMoment.isAfter(now)) {
        const futureBySeconds = instantMoment.diff(now, 'seconds');
        issues.push({
          id: `metadata-future-lastUpdated-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'future-lastUpdated',
          message: `lastUpdated is in the future: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: `The lastUpdated timestamp is ${futureBySeconds} seconds in the future`,
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            isFuture: true,
            futureBySeconds: futureBySeconds,
            resourceType: resourceType,
            validationType: 'lastUpdated-chronological-validation'
          },
          validationMethod: 'lastUpdated-chronological-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.2: Check if lastUpdated is too old (more than 10 years)
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
            validationType: 'lastUpdated-chronological-validation'
          },
          validationMethod: 'lastUpdated-chronological-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.2: Validate timestamp is not at Unix epoch (1970-01-01)
      const unixEpoch = moment('1970-01-01T00:00:00Z');
      if (instantMoment.isSame(unixEpoch)) {
        issues.push({
          id: `metadata-lastUpdated-unix-epoch-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'lastUpdated-unix-epoch',
          message: `lastUpdated is at Unix epoch (1970-01-01): ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp is at Unix epoch (1970-01-01), which typically indicates an uninitialized timestamp',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            isUnixEpoch: true,
            resourceType: resourceType,
            validationType: 'lastUpdated-chronological-validation'
          },
          validationMethod: 'lastUpdated-chronological-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.2: Check for suspicious timestamps (e.g., exact midnight)
      if (instantMoment.hours() === 0 && instantMoment.minutes() === 0 && instantMoment.seconds() === 0) {
        issues.push({
          id: `metadata-lastUpdated-midnight-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'lastUpdated-at-midnight',
          message: `lastUpdated is at exact midnight: ${lastUpdated}`,
          path: 'meta.lastUpdated',
          humanReadable: 'The lastUpdated timestamp is at exact midnight (00:00:00); verify this is accurate',
          details: {
            fieldPath: 'meta.lastUpdated',
            actualValue: lastUpdated,
            pattern: 'midnight',
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
   * Task 8.2: Check if timestamp has timezone information
   */
  private hasTimezone(timestamp: string): boolean {
    // Z for UTC or +/-HH:mm offset
    return timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp);
  }

  /**
   * Task 8.2: Check if timestamp includes seconds precision
   */
  private hasSeconds(timestamp: string): boolean {
    // Should have HH:mm:ss pattern
    return /T\d{2}:\d{2}:\d{2}/.test(timestamp);
  }

  /**
   * Task 8.2: Validate chronological order between timestamps
   * Used for checking if lastUpdated is consistent with resource history
   */
  private validateChronologicalOrder(
    earlierTimestamp: string,
    laterTimestamp: string,
    resourceType: string,
    context: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      const earlier = moment(earlierTimestamp);
      const later = moment(laterTimestamp);

      if (!earlier.isValid() || !later.isValid()) {
        return issues; // Already handled by format validation
      }

      if (later.isBefore(earlier)) {
        issues.push({
          id: `metadata-chronological-order-violation-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'chronological-order-violation',
          message: `Chronological order violation in ${context}: later timestamp is before earlier timestamp`,
          path: 'meta.lastUpdated',
          humanReadable: `The timestamps are out of chronological order in ${context}`,
          details: {
            context: context,
            earlierTimestamp: earlierTimestamp,
            laterTimestamp: laterTimestamp,
            differenceSeconds: earlier.diff(later, 'seconds'),
            resourceType: resourceType,
            validationType: 'lastUpdated-chronological-validation'
          },
          validationMethod: 'lastUpdated-chronological-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Warn if timestamps are identical
      if (earlier.isSame(later)) {
        issues.push({
          id: `metadata-identical-timestamps-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'identical-timestamps',
          message: `Identical timestamps in ${context}: ${earlierTimestamp}`,
          path: 'meta.lastUpdated',
          humanReadable: `The timestamps are identical in ${context}; this may be acceptable but verify accuracy`,
          details: {
            context: context,
            timestamp: earlierTimestamp,
            resourceType: resourceType,
            validationType: 'lastUpdated-chronological-validation'
          },
          validationMethod: 'lastUpdated-chronological-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[MetadataValidator] Chronological order validation failed:', error);
    }

    return issues;
  }

  /**
   * Validate versionId format and consistency
   * Task 8.1: Enhanced format validation and consistency checking
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
        return issues;
      }

      // Task 8.1: Validate FHIR id type pattern (more strict than basic alphanumeric)
      // FHIR id type: Any combination of upper- or lower-case ASCII letters ('A'..'Z', and 'a'..'z'), 
      // numerals ('0'..'9'), '-' and '.', with a length limit of 64 characters
      const fhirIdPattern = /^[A-Za-z0-9\-\.]{1,64}$/;
      if (!fhirIdPattern.test(versionId)) {
        issues.push({
          id: `metadata-invalid-versionId-format-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-versionId-format',
          message: `versionId does not match FHIR id type pattern: ${versionId}`,
          path: 'meta.versionId',
          humanReadable: 'The versionId must be 1-64 characters, containing only A-Z, a-z, 0-9, hyphens, and periods',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            expectedPattern: '[A-Za-z0-9\\-\\.]{1,64}',
            actualLength: versionId.length,
            maxLength: 64,
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.1: Check for common versionId patterns and warn about potential issues
      // Warn if versionId looks like it might be a timestamp (too long and all numeric)
      if (/^\d{13,}$/.test(versionId)) {
        issues.push({
          id: `metadata-versionId-timestamp-pattern-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'versionId-timestamp-pattern',
          message: `versionId appears to be a timestamp: ${versionId}`,
          path: 'meta.versionId',
          humanReadable: 'The versionId looks like a millisecond timestamp; consider using a more compact format',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            pattern: 'timestamp-like',
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.1: Check if versionId is numeric (common pattern)
      const isNumeric = /^\d+$/.test(versionId);
      if (isNumeric) {
        // Validate numeric version is positive
        const numericVersion = parseInt(versionId, 10);
        if (numericVersion <= 0) {
          issues.push({
            id: `metadata-versionId-non-positive-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
            code: 'versionId-non-positive',
            message: `versionId should be a positive number: ${versionId}`,
          path: 'meta.versionId',
            humanReadable: 'Numeric versionIds should be positive integers starting from 1',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
              numericValue: numericVersion,
              resourceType: resourceType,
              validationType: 'versionId-format-validation'
            },
            validationMethod: 'versionId-format-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }

      // Task 8.1: Warn if versionId contains only special characters
      if (/^[\-\.]+$/.test(versionId)) {
        issues.push({
          id: `metadata-versionId-only-special-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'versionId-only-special-chars',
          message: `versionId should not consist only of special characters: ${versionId}`,
          path: 'meta.versionId',
          humanReadable: 'The versionId should contain alphanumeric characters, not only hyphens or periods',
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

      // Task 8.1: Check versionId length is reasonable (warn if very long)
      if (versionId.length > 32) {
        issues.push({
          id: `metadata-versionId-long-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'versionId-too-long',
          message: `versionId is longer than recommended: ${versionId.length} characters`,
          path: 'meta.versionId',
          humanReadable: `The versionId is ${versionId.length} characters; consider using a more compact format (max 64, recommended < 32)`,
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            actualLength: versionId.length,
            recommendedMaxLength: 32,
            absoluteMaxLength: 64,
            resourceType: resourceType,
            validationType: 'versionId-format-validation'
          },
          validationMethod: 'versionId-format-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.1: Validate W3C ETag format if versionId looks like an ETag
      // ETags may be quoted: W/"123" or "123"
      if (versionId.startsWith('"') || versionId.startsWith('W/"')) {
        issues.push({
          id: `metadata-versionId-etag-format-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'versionId-etag-format',
          message: `versionId appears to be in ETag format: ${versionId}`,
          path: 'meta.versionId',
          humanReadable: 'The versionId looks like a quoted ETag; FHIR versionIds should not include quotes',
          details: {
            fieldPath: 'meta.versionId',
            actualValue: versionId,
            recommendation: 'Remove quotes from versionId (ETags are quoted in HTTP headers, not in FHIR resources)',
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
      issues.push({
        id: `metadata-versionId-validation-error-${Date.now()}`,
        aspect: 'metadata',
        severity: 'warning',
        code: 'versionId-validation-error',
        message: `versionId validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: 'meta.versionId',
        humanReadable: 'Unable to validate the versionId',
        details: {
          fieldPath: 'meta.versionId',
          actualValue: versionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType,
          validationType: 'versionId-format-validation'
        },
        validationMethod: 'versionId-format-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Task 8.1: Validate versionId consistency with resource
   * Checks if versionId is consistent with other metadata fields
   */
  private validateVersionIdConsistency(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      const versionId = resource.meta?.versionId;
      
      // Skip if no versionId
      if (!versionId) {
        return issues;
      }

      // Check consistency with resource.id if both exist
      if (resource.id && versionId === resource.id) {
        issues.push({
          id: `metadata-versionId-same-as-id-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'versionId-same-as-id',
          message: 'versionId should not be the same as resource.id',
          path: 'meta.versionId',
          humanReadable: 'The versionId and resource id are the same; they should be different',
          details: {
            fieldPath: 'meta.versionId',
            versionId: versionId,
            resourceId: resource.id,
            resourceType: resourceType,
            validationType: 'versionId-consistency-check'
          },
          validationMethod: 'versionId-consistency-check',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // If versionId is numeric and lastUpdated exists, check logical consistency
      if (/^\d+$/.test(versionId) && resource.meta?.lastUpdated) {
        const numericVersion = parseInt(versionId, 10);
        
        // Version 1 should typically be initial creation
        if (numericVersion === 1) {
          // This is fine, just informational
          console.log(`[MetadataValidator] Resource ${resourceType}/${resource.id || 'unknown'} is at version 1`);
        }

        // Very high version numbers might indicate an issue
        if (numericVersion > 10000) {
          issues.push({
            id: `metadata-versionId-very-high-${Date.now()}`,
            aspect: 'metadata',
            severity: 'info',
            code: 'versionId-very-high',
            message: `versionId is unusually high: ${versionId}`,
            path: 'meta.versionId',
            humanReadable: `The versionId is ${versionId}, which is unusually high; verify this is correct`,
            details: {
              fieldPath: 'meta.versionId',
              versionId: versionId,
              numericValue: numericVersion,
              threshold: 10000,
              resourceType: resourceType,
              validationType: 'versionId-consistency-check'
            },
            validationMethod: 'versionId-consistency-check',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }

    } catch (error) {
      console.error('[MetadataValidator] versionId consistency check failed:', error);
    }

    return issues;
  }

  /**
   * Validate profile URLs
   * Task 8.10: Enhanced validation with profile accessibility checking
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
          return;
        }

        // Task 8.10: Validate canonical URL format (may include version)
        const canonicalPattern = /^https?:\/\/.+\/StructureDefinition\/[A-Za-z0-9\-\.]+(\|.+)?$/;
        if (!canonicalPattern.test(profile)) {
          // Check if it's at least a valid URL
          if (!this.isValidUrl(profile.split('|')[0])) {
          issues.push({
            id: `metadata-invalid-profile-url-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'invalid-profile-url',
            message: `Invalid profile URL at index ${index}: ${profile}`,
            path: `meta.profile[${index}]`,
              humanReadable: 'Profile URLs should be valid canonical URLs (http://example.com/StructureDefinition/ProfileName)',
            details: {
              fieldPath: `meta.profile[${index}]`,
              actualValue: profile,
                expectedFormat: 'http(s)://domain/StructureDefinition/name[|version]',
              resourceType: resourceType,
              validationType: 'profile-url-validation'
            },
            validationMethod: 'profile-url-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
        }

        // Task 8.10: Check if profile URL matches resource type
        const profileResourceType = this.extractResourceTypeFromProfile(profile);
        if (profileResourceType && profileResourceType !== resourceType) {
          issues.push({
            id: `metadata-profile-resource-type-mismatch-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'profile-resource-type-mismatch',
            message: `Profile at index ${index} is for ${profileResourceType}, but resource is ${resourceType}`,
            path: `meta.profile[${index}]`,
            humanReadable: `The profile appears to be for ${profileResourceType} resources, but this is a ${resourceType} resource`,
            details: {
              fieldPath: `meta.profile[${index}]`,
              profileUrl: profile,
              profileResourceType: profileResourceType,
              actualResourceType: resourceType,
              validationType: 'profile-url-validation'
            },
            validationMethod: 'profile-url-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.10: Check for duplicate profile declarations
        const duplicateIndex = profiles.findIndex((other: any, otherIndex: number) => 
          otherIndex > index && other === profile
        );

        if (duplicateIndex !== -1) {
          issues.push({
            id: `metadata-profile-duplicate-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'info',
            code: 'profile-duplicate',
            message: `Profile at index ${index} is duplicated at index ${duplicateIndex}`,
            path: `meta.profile[${index}]`,
            humanReadable: `This profile is declared multiple times (also at index ${duplicateIndex})`,
            details: {
              fieldPath: `meta.profile[${index}]`,
              profileUrl: profile,
              duplicateIndex: duplicateIndex,
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
   * Task 8.10: Validate profile accessibility (async)
   * This method checks if declared profiles can be resolved and accessed
   */
  async validateProfileAccessibility(
    profiles: any,
    resourceType: string,
    fhirVersion: string = 'R4'
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return issues; // Already validated in validateProfileUrls
    }

    try {
      // Lazy load ProfileResolver to avoid circular dependencies
      const { ProfileResolver } = await import('../utils/profile-resolver');
      const resolver = new ProfileResolver();

      for (let index = 0; index < profiles.length; index++) {
        const profile = profiles[index];

        if (typeof profile !== 'string') {
          continue; // Already validated in validateProfileUrls
        }

        try {
          // Parse canonical URL (may include version)
          const [canonicalUrl, version] = profile.split('|');

          // Attempt to resolve the profile
          const resolved = await resolver.resolveProfile(canonicalUrl, version);

          if (!resolved) {
            issues.push({
              id: `metadata-profile-not-accessible-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'warning',
              code: 'profile-not-accessible',
              message: `Profile at index ${index} could not be resolved: ${profile}`,
              path: `meta.profile[${index}]`,
              humanReadable: `The profile "${profile}" could not be found or accessed`,
              details: {
                fieldPath: `meta.profile[${index}]`,
                profileUrl: profile,
                canonicalUrl,
                version: version || 'latest',
                resourceType: resourceType,
                validationType: 'profile-accessibility-check'
              },
              validationMethod: 'profile-accessibility-check',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: fhirVersion
            });
            continue;
          }

          // Verify profile is for the correct resource type
          if (resolved.type && resolved.type !== resourceType) {
            issues.push({
              id: `metadata-profile-wrong-resource-type-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'error',
              code: 'profile-wrong-resource-type',
              message: `Profile at index ${index} is for ${resolved.type}, but resource is ${resourceType}`,
              path: `meta.profile[${index}]`,
              humanReadable: `The profile "${profile}" is defined for ${resolved.type} resources, not ${resourceType}`,
              details: {
                fieldPath: `meta.profile[${index}]`,
                profileUrl: profile,
                profileResourceType: resolved.type,
                actualResourceType: resourceType,
                profileId: resolved.id,
                validationType: 'profile-accessibility-check'
              },
              validationMethod: 'profile-accessibility-check',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: fhirVersion
            });
          }

          // Check profile status (draft, active, retired)
          if (resolved.status === 'retired') {
            issues.push({
              id: `metadata-profile-retired-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'warning',
              code: 'profile-retired',
              message: `Profile at index ${index} has been retired: ${profile}`,
              path: `meta.profile[${index}]`,
              humanReadable: `The profile "${profile}" is marked as retired and should not be used`,
              details: {
                fieldPath: `meta.profile[${index}]`,
                profileUrl: profile,
                profileStatus: resolved.status,
                profileId: resolved.id,
                validationType: 'profile-accessibility-check'
              },
              validationMethod: 'profile-accessibility-check',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: fhirVersion
            });
          } else if (resolved.status === 'draft') {
            issues.push({
              id: `metadata-profile-draft-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'info',
              code: 'profile-draft',
              message: `Profile at index ${index} is in draft status: ${profile}`,
              path: `meta.profile[${index}]`,
              humanReadable: `The profile "${profile}" is in draft status and may change`,
              details: {
                fieldPath: `meta.profile[${index}]`,
                profileUrl: profile,
                profileStatus: resolved.status,
                profileId: resolved.id,
                validationType: 'profile-accessibility-check'
              },
              validationMethod: 'profile-accessibility-check',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: fhirVersion
            });
          }

          // Check if profile is experimental
          if (resolved.experimental === true) {
            issues.push({
              id: `metadata-profile-experimental-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'info',
              code: 'profile-experimental',
              message: `Profile at index ${index} is marked as experimental: ${profile}`,
              path: `meta.profile[${index}]`,
              humanReadable: `The profile "${profile}" is experimental and not for production use`,
              details: {
                fieldPath: `meta.profile[${index}]`,
                profileUrl: profile,
                profileExperimental: resolved.experimental,
                profileId: resolved.id,
                validationType: 'profile-accessibility-check'
              },
              validationMethod: 'profile-accessibility-check',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: fhirVersion
            });
          }

        } catch (error: any) {
          // Profile resolution failed
          issues.push({
            id: `metadata-profile-resolution-error-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'profile-resolution-error',
            message: `Error resolving profile at index ${index}: ${error.message}`,
            path: `meta.profile[${index}]`,
            humanReadable: `Failed to resolve profile "${profile}": ${error.message}`,
            details: {
              fieldPath: `meta.profile[${index}]`,
              profileUrl: profile,
              error: error.message,
              resourceType: resourceType,
              validationType: 'profile-accessibility-check'
            },
            validationMethod: 'profile-accessibility-check',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: fhirVersion
          });
        }
      }

    } catch (error: any) {
      console.error('[MetadataValidator] Profile accessibility check failed:', error);
      // Don't fail validation if ProfileResolver isn't available
    }

    return issues;
  }

  /**
   * Task 8.10: Extract resource type from profile URL
   * Profile URLs typically follow pattern: .../StructureDefinition/ResourceType-profile-name
   */
  private extractResourceTypeFromProfile(profileUrl: string): string | null {
    try {
      // Remove version if present
      const urlWithoutVersion = profileUrl.split('|')[0];

      // Extract the profile name (last part after StructureDefinition/)
      const match = urlWithoutVersion.match(/\/StructureDefinition\/([A-Za-z]+)/);
      if (match && match[1]) {
        // Common FHIR resource types start with capital letter
        const profileName = match[1];
        
        // Check if profile name starts with a known resource type
        // Sort by length descending to match longer types first (e.g., MedicationRequest before Medication)
        const commonTypes = [
          'MedicationRequest', 'AllergyIntolerance', 'DiagnosticReport', 'DocumentReference',
          'Observation', 'Condition', 'Procedure', 'Medication', 'Encounter',
          'Organization', 'Practitioner', 'Immunization', 'CarePlan',
          'Bundle', 'Composition', 'Provenance', 'Patient',
        ];

        for (const type of commonTypes) {
          if (profileName === type || profileName.startsWith(type + '-')) {
            return type;
          }
        }

        // If profile name is capitalized and not hyphenated, might be the resource type
        if (/^[A-Z][a-z]+$/.test(profileName)) {
          return profileName;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate security labels
   * Task 8.4: Enhanced validation against security-labels ValueSet
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

      // Task 8.4: Validate each security label (Coding structure)
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
          return;
        }

        // Task 8.4: Validate Coding structure (system + code required)
        if (!securityLabel.system && !securityLabel.code) {
          issues.push({
            id: `metadata-security-missing-system-code-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'error',
            code: 'security-missing-system-code',
            message: `Security label at index ${index} must have system and/or code`,
            path: `meta.security[${index}]`,
            humanReadable: 'Security labels must have at least a system or code property',
            details: {
              fieldPath: `meta.security[${index}]`,
              actualValue: securityLabel,
              missing: ['system', 'code'],
              resourceType: resourceType,
              validationType: 'security-label-validation'
            },
            validationMethod: 'security-label-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.4: Validate system is a valid URI if present
        if (securityLabel.system && typeof securityLabel.system === 'string') {
          const systemValidation = this.validateUriFormat(securityLabel.system);
          if (!systemValidation.isValid) {
            issues.push({
              id: `metadata-security-invalid-system-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'warning',
              code: 'security-invalid-system',
              message: `Security label system is not a valid URI: ${securityLabel.system}`,
              path: `meta.security[${index}].system`,
              humanReadable: 'Security label systems should be valid URIs',
              details: {
                fieldPath: `meta.security[${index}].system`,
                actualValue: securityLabel.system,
                reason: systemValidation.reason,
                resourceType: resourceType,
                validationType: 'security-label-validation'
              },
              validationMethod: 'security-label-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          }
        }

        // Task 8.4: Validate code is a string if present
        if (securityLabel.code && typeof securityLabel.code !== 'string') {
          issues.push({
            id: `metadata-security-invalid-code-type-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'error',
            code: 'security-invalid-code-type',
            message: `Security label code must be a string at index ${index}`,
            path: `meta.security[${index}].code`,
            humanReadable: 'Security label codes must be strings',
            details: {
              fieldPath: `meta.security[${index}].code`,
              actualValue: securityLabel.code,
              expectedType: 'string',
              resourceType: resourceType,
              validationType: 'security-label-validation'
            },
            validationMethod: 'security-label-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.4: Validate display is a string if present
        if (securityLabel.display && typeof securityLabel.display !== 'string') {
          issues.push({
            id: `metadata-security-invalid-display-type-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'security-invalid-display-type',
            message: `Security label display must be a string at index ${index}`,
            path: `meta.security[${index}].display`,
            humanReadable: 'Security label display values must be strings',
            details: {
              fieldPath: `meta.security[${index}].display`,
              actualValue: securityLabel.display,
              expectedType: 'string',
              resourceType: resourceType,
              validationType: 'security-label-validation'
            },
            validationMethod: 'security-label-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.4: Validate against known security label systems
        if (securityLabel.system && securityLabel.code) {
          const knownSystemValidation = this.validateKnownSecuritySystem(
            securityLabel.system,
            securityLabel.code,
            index
          );
          issues.push(...knownSystemValidation);
        }

        // Task 8.4: Check for code without system
        if (securityLabel.code && !securityLabel.system) {
          issues.push({
            id: `metadata-security-code-without-system-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'security-code-without-system',
            message: `Security label has code without system at index ${index}`,
            path: `meta.security[${index}]`,
            humanReadable: 'Security labels should have both system and code for proper identification',
            details: {
              fieldPath: `meta.security[${index}]`,
              code: securityLabel.code,
              missingField: 'system',
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
   * Task 8.4: Validate security labels against known FHIR security label systems
   */
  private validateKnownSecuritySystem(system: string, code: string, index: number): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Common FHIR security label systems
    const knownSystems: Record<string, { name: string; commonCodes: string[] }> = {
      'http://terminology.hl7.org/CodeSystem/v3-Confidentiality': {
        name: 'Confidentiality',
        commonCodes: ['U', 'L', 'M', 'N', 'R', 'V'],
      },
      'http://terminology.hl7.org/CodeSystem/v3-ActCode': {
        name: 'ActCode',
        commonCodes: ['ETHUD', 'GDIS', 'HIV', 'PSY', 'SCA', 'SDV', 'SEX', 'STD', 'TBOO'],
      },
      'http://terminology.hl7.org/CodeSystem/v3-ObservationValue': {
        name: 'ObservationValue',
        commonCodes: ['ABSTRED', 'AGGRED', 'ANONYED', 'MAPPED', 'MASKED', 'PSEUDED', 'REDACTED', 'SUBSETTED', 'SYNTAC', 'TRSLT'],
      },
    };

    const systemInfo = knownSystems[system];
    
    if (systemInfo) {
      // Known system - validate code
      if (!systemInfo.commonCodes.includes(code)) {
        issues.push({
          id: `metadata-security-unknown-code-${Date.now()}-${index}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'security-unknown-code',
          message: `Security label code '${code}' is not commonly used in ${systemInfo.name} system`,
          path: `meta.security[${index}].code`,
          humanReadable: `The code '${code}' is not a commonly used code in the ${systemInfo.name} system`,
          details: {
            fieldPath: `meta.security[${index}].code`,
            system: system,
            code: code,
            systemName: systemInfo.name,
            commonCodes: systemInfo.commonCodes,
            validationType: 'security-label-validation'
          },
          validationMethod: 'security-label-validation',
          timestamp: new Date().toISOString(),
          resourceType: '',
          schemaVersion: 'R4'
        });
      }
    }

    return issues;
  }

  /**
   * Validate tags
   * Task 8.5: Enhanced validation for system, code, display consistency
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

      // Task 8.5: Enhanced validation for each tag (Coding structure)
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
          return;
        }

        // Task 8.5: Validate Coding structure (at least system or code should be present)
        if (!tag.system && !tag.code) {
          issues.push({
            id: `metadata-tag-missing-system-code-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'tag-missing-system-code',
            message: `Tag at index ${index} should have system and/or code`,
            path: `meta.tag[${index}]`,
            humanReadable: 'Tags should have at least a system or code property for identification',
            details: {
              fieldPath: `meta.tag[${index}]`,
              actualValue: tag,
              missing: ['system', 'code'],
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.5: Validate system is a valid URI if present
        if (tag.system) {
          if (typeof tag.system !== 'string') {
            issues.push({
              id: `metadata-tag-invalid-system-type-${Date.now()}-${index}`,
              aspect: 'metadata',
              severity: 'error',
              code: 'tag-invalid-system-type',
              message: `Tag system must be a string at index ${index}`,
              path: `meta.tag[${index}].system`,
              humanReadable: 'Tag systems must be URI strings',
              details: {
                fieldPath: `meta.tag[${index}].system`,
                actualValue: tag.system,
                expectedType: 'string (URI)',
                resourceType: resourceType,
                validationType: 'tag-validation'
              },
              validationMethod: 'tag-validation',
              timestamp: new Date().toISOString(),
              resourceType: resourceType,
              schemaVersion: 'R4'
            });
          } else {
            const systemValidation = this.validateUriFormat(tag.system);
            if (!systemValidation.isValid) {
              issues.push({
                id: `metadata-tag-invalid-system-uri-${Date.now()}-${index}`,
                aspect: 'metadata',
                severity: 'warning',
                code: 'tag-invalid-system-uri',
                message: `Tag system is not a valid URI: ${tag.system}`,
                path: `meta.tag[${index}].system`,
                humanReadable: 'Tag systems should be valid URIs',
                details: {
                  fieldPath: `meta.tag[${index}].system`,
                  actualValue: tag.system,
                  reason: systemValidation.reason,
                  resourceType: resourceType,
                  validationType: 'tag-validation'
                },
                validationMethod: 'tag-validation',
                timestamp: new Date().toISOString(),
                resourceType: resourceType,
                schemaVersion: 'R4'
              });
            }
          }
        }

        // Task 8.5: Validate code is a string if present
        if (tag.code && typeof tag.code !== 'string') {
          issues.push({
            id: `metadata-tag-invalid-code-type-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'error',
            code: 'tag-invalid-code-type',
            message: `Tag code must be a string at index ${index}`,
            path: `meta.tag[${index}].code`,
            humanReadable: 'Tag codes must be strings',
            details: {
              fieldPath: `meta.tag[${index}].code`,
              actualValue: tag.code,
              expectedType: 'string',
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.5: Validate display is a string if present
        if (tag.display && typeof tag.display !== 'string') {
          issues.push({
            id: `metadata-tag-invalid-display-type-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'warning',
            code: 'tag-invalid-display-type',
            message: `Tag display must be a string at index ${index}`,
            path: `meta.tag[${index}].display`,
            humanReadable: 'Tag display values must be strings',
            details: {
              fieldPath: `meta.tag[${index}].display`,
              actualValue: tag.display,
              expectedType: 'string',
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.5: Check consistency between system and code
        if (tag.system && tag.code && tag.display) {
          // All three present - check for basic consistency
          const consistencyIssues = this.validateTagConsistency(tag, index, resourceType);
          issues.push(...consistencyIssues);
        }

        // Task 8.5: Warn if code without system
        if (tag.code && !tag.system) {
          issues.push({
            id: `metadata-tag-code-without-system-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'info',
            code: 'tag-code-without-system',
            message: `Tag has code without system at index ${index}`,
            path: `meta.tag[${index}]`,
            humanReadable: 'Tags should have both system and code for proper identification',
            details: {
              fieldPath: `meta.tag[${index}]`,
              code: tag.code,
              missingField: 'system',
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }

        // Task 8.5: Check for duplicate tags
        const duplicateIndex = tags.findIndex((otherTag: any, otherIndex: number) => 
          otherIndex > index && 
          otherTag.system === tag.system && 
          otherTag.code === tag.code
        );

        if (duplicateIndex !== -1) {
          issues.push({
            id: `metadata-tag-duplicate-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'info',
            code: 'tag-duplicate',
            message: `Tag at index ${index} is duplicated at index ${duplicateIndex}`,
            path: `meta.tag[${index}]`,
            humanReadable: `This tag is duplicated (same system and code appear at index ${duplicateIndex})`,
            details: {
              fieldPath: `meta.tag[${index}]`,
              system: tag.system,
              code: tag.code,
              duplicateIndex: duplicateIndex,
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
   * Task 8.5: Validate tag consistency (system, code, display)
   */
  private validateTagConsistency(tag: any, index: number, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Check if display is too short (likely incomplete)
      if (tag.display && tag.display.length < 2) {
        issues.push({
          id: `metadata-tag-short-display-${Date.now()}-${index}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'tag-short-display',
          message: `Tag display is very short at index ${index}: "${tag.display}"`,
          path: `meta.tag[${index}].display`,
          humanReadable: 'Tag display is unusually short; verify it is complete',
          details: {
            fieldPath: `meta.tag[${index}].display`,
            actualValue: tag.display,
            actualLength: tag.display.length,
            resourceType: resourceType,
            validationType: 'tag-validation'
          },
          validationMethod: 'tag-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Check if code and display seem inconsistent (very basic check)
      if (tag.code && tag.display) {
        // If code is in ALL CAPS and display is also in ALL CAPS, might be using code as display
        if (tag.code === tag.display.toUpperCase() && tag.display === tag.code) {
          issues.push({
            id: `metadata-tag-code-as-display-${Date.now()}-${index}`,
            aspect: 'metadata',
            severity: 'info',
            code: 'tag-code-as-display',
            message: `Tag display appears to be same as code at index ${index}`,
            path: `meta.tag[${index}].display`,
            humanReadable: 'Tag display appears to be the same as the code; consider providing a more descriptive display value',
            details: {
              fieldPath: `meta.tag[${index}].display`,
              code: tag.code,
              display: tag.display,
              resourceType: resourceType,
              validationType: 'tag-validation'
            },
            validationMethod: 'tag-validation',
            timestamp: new Date().toISOString(),
            resourceType: resourceType,
            schemaVersion: 'R4'
          });
        }
      }

    } catch (error) {
      console.error('[MetadataValidator] Tag consistency validation failed:', error);
    }

    return issues;
  }

  /**
   * Task 8.3: Validate meta.source URI
   * The source field is a URI identifying where the resource came from
   */
  private validateSourceUri(source: string, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    try {
      // Check if source is a string
      if (typeof source !== 'string') {
        issues.push({
          id: `metadata-invalid-source-type-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'invalid-source-type',
          message: 'meta.source must be a string',
          path: 'meta.source',
          humanReadable: 'The source field must be a URI string',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            expectedType: 'string (URI)',
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Check if source is empty
      if (!source || source.trim() === '') {
        issues.push({
          id: `metadata-empty-source-${Date.now()}`,
          aspect: 'metadata',
          severity: 'error',
          code: 'empty-source',
          message: 'meta.source cannot be empty',
          path: 'meta.source',
          humanReadable: 'The source field cannot be empty if present',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
        return issues;
      }

      // Task 8.3: Validate URI format
      // FHIR URI can be: absolute URL, URN, OID, UUID, or relative reference
      const sourceValidation = this.validateUriFormat(source);

      if (!sourceValidation.isValid) {
        issues.push({
          id: `metadata-invalid-source-uri-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'invalid-source-uri',
          message: `Invalid source URI format: ${source}`,
          path: 'meta.source',
          humanReadable: 'The source should be a valid URI (URL, URN, OID, UUID, or relative reference)',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            expectedFormat: 'Valid URI (http://, https://, urn:, oid:, uuid:, or relative)',
            uriType: sourceValidation.type,
            reason: sourceValidation.reason,
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.3: Check URI type and provide recommendations
      if (sourceValidation.type === 'url' && !source.startsWith('http://') && !source.startsWith('https://')) {
        issues.push({
          id: `metadata-source-non-http-url-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'source-non-http-url',
          message: `Source URL uses non-HTTP(S) scheme: ${source}`,
          path: 'meta.source',
          humanReadable: 'The source URL uses a non-HTTP(S) scheme; verify this is intentional',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            uriType: sourceValidation.type,
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.3: Warn about source URIs that look like resource references
      if (this.looksLikeReference(source)) {
        issues.push({
          id: `metadata-source-looks-like-reference-${Date.now()}`,
          aspect: 'metadata',
          severity: 'info',
          code: 'source-looks-like-reference',
          message: `Source URI looks like a resource reference: ${source}`,
          path: 'meta.source',
          humanReadable: 'The source looks like a FHIR reference; consider using a canonical system identifier instead',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            pattern: 'reference-like',
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

      // Task 8.3: Check for localhost or local network references
      if (source.includes('localhost') || source.includes('127.0.0.1') || /192\.168\.\d+\.\d+/.test(source)) {
        issues.push({
          id: `metadata-source-localhost-${Date.now()}`,
          aspect: 'metadata',
          severity: 'warning',
          code: 'source-localhost',
          message: `Source references localhost or local network: ${source}`,
          path: 'meta.source',
          humanReadable: 'The source references localhost or a local network address; this will not be resolvable from other systems',
          details: {
            fieldPath: 'meta.source',
            actualValue: source,
            issue: 'localhost or local network reference',
            resourceType: resourceType,
            validationType: 'source-uri-validation'
          },
          validationMethod: 'source-uri-validation',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }

    } catch (error) {
      console.error('[MetadataValidator] Source URI validation failed:', error);
      issues.push({
        id: `metadata-source-validation-error-${Date.now()}`,
        aspect: 'metadata',
        severity: 'warning',
        code: 'source-validation-error',
        message: `Source URI validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        path: 'meta.source',
        humanReadable: 'Unable to validate the source URI',
        details: {
          fieldPath: 'meta.source',
          actualValue: source,
          error: error instanceof Error ? error.message : 'Unknown error',
          resourceType: resourceType,
          validationType: 'source-uri-validation'
        },
        validationMethod: 'source-uri-validation',
        timestamp: new Date().toISOString(),
        resourceType: resourceType,
        schemaVersion: 'R4'
      });
    }

    return issues;
  }

  /**
   * Task 8.3: Validate URI format and determine type
   */
  private validateUriFormat(uri: string): {
    isValid: boolean;
    type: 'url' | 'urn' | 'oid' | 'uuid' | 'relative' | 'unknown';
    reason?: string;
  } {
    // Check for URL (http, https, ftp, etc.)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('ftp://')) {
      try {
        new URL(uri);
        return { isValid: true, type: 'url' };
      } catch {
        return { isValid: false, type: 'url', reason: 'Invalid URL format' };
      }
    }

    // Check for URN (urn:)
    if (uri.startsWith('urn:')) {
      // URN format: urn:<nid>:<nss>
      const urnPattern = /^urn:[a-z0-9][a-z0-9-]{0,31}:.+$/i;
      if (urnPattern.test(uri)) {
        return { isValid: true, type: 'urn' };
      }
      return { isValid: false, type: 'urn', reason: 'Invalid URN format' };
    }

    // Check for OID (oid:)
    if (uri.startsWith('oid:')) {
      // OID format: oid:digit(dot digit)*
      const oidPattern = /^oid:\d+(\.\d+)*$/;
      if (oidPattern.test(uri)) {
        return { isValid: true, type: 'oid' };
      }
      return { isValid: false, type: 'oid', reason: 'Invalid OID format' };
    }

    // Check for UUID (urn:uuid: or uuid:)
    if (uri.startsWith('urn:uuid:') || uri.startsWith('uuid:')) {
      // Extract UUID part and validate
      const uuidPart = uri.replace(/^(urn:)?uuid:/, '');
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(uuidPart)) {
        return { isValid: true, type: 'uuid' };
      }
      return { isValid: false, type: 'uuid', reason: 'Invalid UUID format (expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)' };
    }

    // Check for relative reference (ResourceType/id or relative path)
    if (/^[A-Z][a-zA-Z]+\/[A-Za-z0-9\-\.]+/.test(uri) || uri.startsWith('/') || uri.startsWith('#')) {
      return { isValid: true, type: 'relative' };
    }

    // If it looks like a URL without scheme, it's invalid
    if (uri.includes('.') && uri.includes('/')) {
      return { isValid: false, type: 'unknown', reason: 'Looks like URL without scheme' };
    }

    // Unknown or custom URI scheme
    return { isValid: true, type: 'unknown' };
  }

  /**
   * Task 8.3: Check if URI looks like a FHIR reference
   */
  private looksLikeReference(uri: string): boolean {
    // Matches patterns like: Patient/123, Organization/xyz, etc.
    const referencePattern = /^[A-Z][a-zA-Z]+\/[A-Za-z0-9\-\.]+/;
    return referencePattern.test(uri);
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

  /**
   * Task 8.11: Validate required metadata based on resource type
   */
  private validateRequiredMetadata(resource: any, resourceType: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Get requirements for this resource type
    const requirements = RESOURCE_METADATA_REQUIREMENTS[resourceType];
    
    if (!requirements || requirements.length === 0) {
      // No specific requirements for this resource type
      return issues;
    }

    // Check each requirement
    for (const requirement of requirements) {
      const { field, severity, reason } = requirement;
      
      // Check if the required metadata field is present
      let isPresent = false;
      
      switch (field) {
        case 'versionId':
          isPresent = !!(resource.meta && 'versionId' in resource.meta && resource.meta.versionId);
          break;
        case 'lastUpdated':
          isPresent = !!(resource.meta && resource.meta.lastUpdated);
          break;
        case 'profile':
          isPresent = !!(resource.meta && resource.meta.profile && Array.isArray(resource.meta.profile) && resource.meta.profile.length > 0);
          break;
        case 'security':
          isPresent = !!(resource.meta && resource.meta.security && Array.isArray(resource.meta.security) && resource.meta.security.length > 0);
          break;
        case 'tag':
          isPresent = !!(resource.meta && resource.meta.tag && Array.isArray(resource.meta.tag) && resource.meta.tag.length > 0);
          break;
        case 'source':
          isPresent = !!(resource.meta && resource.meta.source);
          break;
      }

      if (!isPresent) {
        issues.push({
          id: `metadata-required-field-missing-${resourceType}-${field}-${Date.now()}`,
          aspect: 'metadata',
          severity: severity,
          code: `required-metadata-missing-${field}`,
          message: `${resourceType} resource is missing recommended metadata field: meta.${field}`,
          path: `meta.${field}`,
          humanReadable: reason,
          details: {
            fieldPath: `meta.${field}`,
            resourceType: resourceType,
            requiredField: field,
            severity: severity,
            reason: reason,
            validationType: 'required-metadata-check'
          },
          validationMethod: 'required-metadata-check',
          timestamp: new Date().toISOString(),
          resourceType: resourceType,
          schemaVersion: 'R4'
        });
      }
    }

    return issues;
  }
}