/**
 * HAPI Issue Mapper
 * 
 * Maps HAPI FHIR OperationOutcome issues to ValidationIssue format.
 * Extracted from hapi-validator-client.ts to maintain file size limits.
 */

import type { ValidationIssue } from '../types/validation-types';
import type { HapiOperationOutcome, HapiIssue } from './hapi-validator-types';

/**
 * Map HAPI OperationOutcome to ValidationIssue array
 */
export function mapOperationOutcomeToIssues(
  operationOutcome: HapiOperationOutcome,
  fhirVersion: 'R4' | 'R5' | 'R6'
): ValidationIssue[] {
  if (!operationOutcome.issue || operationOutcome.issue.length === 0) {
    return [];
  }

  return operationOutcome.issue.map((issue, index) => 
    mapHapiIssueToValidationIssue(issue, index, fhirVersion)
  );
}

/**
 * Map single HAPI issue to ValidationIssue
 */
export function mapHapiIssueToValidationIssue(
  hapiIssue: HapiIssue,
  index: number,
  fhirVersion: 'R4' | 'R5' | 'R6'
): ValidationIssue {
  // Determine aspect from HAPI code
  const aspect = determineAspectFromCode(hapiIssue.code);

  // Map severity
  const severity = mapSeverity(hapiIssue.severity);

  // Extract path
  const path = hapiIssue.expression?.[0] || hapiIssue.location?.[0] || '';

  // Build message
  const message = hapiIssue.diagnostics || hapiIssue.details?.text || 'Validation issue';

  return {
    id: `hapi-${Date.now()}-${index}`,
    aspect,
    severity,
    code: hapiIssue.code,
    message,
    path,
    details: hapiIssue.details?.text,
    timestamp: new Date(),
  };
}

/**
 * Determine validation aspect from HAPI issue code
 */
export function determineAspectFromCode(code: string): string {
  const lowerCode = code.toLowerCase();

  // Structural validation codes
  if (lowerCode.includes('structure') || lowerCode.includes('required') || 
      lowerCode.includes('cardinality') || lowerCode.includes('datatype')) {
    return 'structural';
  }

  // Profile validation codes
  if (lowerCode.includes('profile') || lowerCode.includes('constraint') || 
      lowerCode.includes('invariant')) {
    return 'profile';
  }

  // Terminology validation codes
  if (lowerCode.includes('code') || lowerCode.includes('valueset') || 
      lowerCode.includes('binding') || lowerCode.includes('terminology')) {
    return 'terminology';
  }

  // Reference validation codes
  if (lowerCode.includes('reference') || lowerCode.includes('resolve')) {
    return 'reference';
  }

  // Business rule codes
  if (lowerCode.includes('business') || lowerCode.includes('rule')) {
    return 'businessRule';
  }

  // Metadata codes
  if (lowerCode.includes('meta') || lowerCode.includes('version') || 
      lowerCode.includes('lastUpdated')) {
    return 'metadata';
  }

  // Default to structural
  return 'structural';
}

/**
 * Map HAPI severity to ValidationIssue severity
 */
export function mapSeverity(hapiSeverity: 'fatal' | 'error' | 'warning' | 'information' | 'hint'): 'error' | 'warning' | 'info' {
  switch (hapiSeverity) {
    case 'fatal':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'information':
    case 'hint':
      return 'info';
    default:
      return 'error';
  }
}

