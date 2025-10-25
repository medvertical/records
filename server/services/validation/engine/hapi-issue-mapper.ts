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

  // Log for debugging
  console.log(`[determineAspectFromCode] Mapping code: ${code}`);

  // Profile validation codes (check first - most specific)
  if (lowerCode.includes('profile') || lowerCode.includes('constraint') || 
      lowerCode.includes('invariant')) {
    console.log(`[determineAspectFromCode] Mapped to: profile`);
    return 'profile';
  }

  // Terminology validation codes (before "code" fallback to structural)
  if (lowerCode.includes('terminology') || lowerCode.includes('valueset') || 
      lowerCode.includes('binding') || 
      lowerCode === 'code-invalid' || lowerCode === 'invalid-code') {
    console.log(`[determineAspectFromCode] Mapped to: terminology`);
    return 'terminology';
  }

  // Structural validation codes
  if (lowerCode.includes('structure') || lowerCode.includes('required') || 
      lowerCode.includes('cardinality') || lowerCode.includes('datatype') ||
      lowerCode === 'unknown' || lowerCode === 'invalid') {
    console.log(`[determineAspectFromCode] Mapped to: structural`);
    return 'structural';
  }

  // Reference validation codes
  if (lowerCode.includes('reference') || lowerCode.includes('resolve')) {
    console.log(`[determineAspectFromCode] Mapped to: reference`);
    return 'reference';
  }

  // Business rule codes
  if (lowerCode.includes('business') || lowerCode.includes('rule')) {
    console.log(`[determineAspectFromCode] Mapped to: businessRule`);
    return 'businessRule';
  }

  // Metadata codes
  if (lowerCode.includes('meta') || lowerCode.includes('version') || 
      lowerCode.includes('lastUpdated')) {
    console.log(`[determineAspectFromCode] Mapped to: metadata`);
    return 'metadata';
  }

  // Catch-all for "code" without more specific context
  if (lowerCode.includes('code')) {
    console.log(`[determineAspectFromCode] Generic 'code' mapped to: terminology`);
    return 'terminology';
  }

  // Default to structural
  console.log(`[determineAspectFromCode] Default mapped to: structural`);
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

