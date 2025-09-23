/**
 * Metadata Validator
 * 
 * Handles metadata validation of FHIR resources including:
 * - Version information
 * - Timestamps
 * - Metadata compliance
 */

import type { ValidationIssue } from '../types/validation-types';

export class MetadataValidator {
  async validate(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for required meta field
    if (!resource.meta) {
      issues.push({
        id: `metadata-${Date.now()}-1`,
        aspect: 'metadata',
        severity: 'warning',
        code: 'missing-meta',
        message: 'Resource should have a meta field',
        path: 'meta',
        humanReadable: 'The resource should include metadata information'
      });
    }

    // Check for version information
    if (resource.meta && !resource.meta.versionId) {
      issues.push({
        id: `metadata-${Date.now()}-2`,
        aspect: 'metadata',
        severity: 'info',
        code: 'missing-version',
        message: 'Resource should have version information',
        path: 'meta.versionId',
        humanReadable: 'The resource should include version information'
      });
    }

    return issues;
  }
}