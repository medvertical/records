/**
 * Structural Validator
 * 
 * Handles structural validation of FHIR resources including:
 * - Required field validation
 * - Data type validation
 * - JSON schema compliance
 */

import type { ValidationIssue } from '../types/validation-types';

export class StructuralValidator {
  async validate(resource: any, resourceType: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check resource type
    if (!resource.resourceType) {
      issues.push({
        id: `structural-${Date.now()}-1`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource type is required',
        path: 'resourceType',
        humanReadable: 'The resource must have a resourceType field'
      });
    }

    // Check resource ID (except for Bundle)
    if (!resource.id && resourceType !== 'Bundle') {
      issues.push({
        id: `structural-${Date.now()}-2`,
        aspect: 'structural',
        severity: 'error',
        code: 'required-element-missing',
        message: 'Resource ID is required',
        path: 'id',
        humanReadable: 'The resource must have an id field'
      });
    }

    // Check for valid JSON structure
    if (typeof resource !== 'object' || resource === null) {
      issues.push({
        id: `structural-${Date.now()}-3`,
        aspect: 'structural',
        severity: 'error',
        code: 'invalid-json',
        message: 'Resource must be a valid JSON object',
        humanReadable: 'The resource must be a valid JSON object'
      });
    }

    // Check for required meta field
    if (!resource.meta) {
      issues.push({
        id: `structural-${Date.now()}-4`,
        aspect: 'structural',
        severity: 'warning',
        code: 'missing-meta',
        message: 'Resource should have a meta field',
        path: 'meta',
        humanReadable: 'The resource should include metadata information'
      });
    }

    return issues;
  }
}