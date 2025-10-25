/**
 * Utility functions for resource detail page
 */

/**
 * Check if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Calculate validation score from validation summary
 * Uses enhanced validation score if available, otherwise falls back to legacy score
 */
export function calculateValidationScore(
  enhancedValidation: any,
  legacyValidation: any
): number {
  return enhancedValidation?.overallScore ?? legacyValidation?.validationScore ?? 0;
}

/**
 * Extract validation issues from validation messages
 * Converts validation messages to the format expected by ResourceViewer
 */
export function extractValidationIssues(
  validationMessages: any,
  resourceType: string
): Array<{
  id: string;
  code?: string;
  message: string;
  severity: string;
  category: string;
  path: string;
  location: string[];
}> {
  if (!validationMessages?.aspects) {
    return [];
  }

  return validationMessages.aspects.flatMap((aspect: any) =>
    aspect.messages.map((msg: any) => {
      // Strip resource type prefix from path (e.g., "patient.meta.profile" -> "meta.profile" or "Patient.meta.profile" -> "meta.profile")
      const pathParts = msg.canonicalPath.split('.');
      // Check if first part is a resource type (case-insensitive match)
      const pathWithoutResourceType = pathParts.length > 0 && 
        /^[a-zA-Z]/.test(pathParts[0]) && 
        resourceType?.toLowerCase() === pathParts[0].toLowerCase()
        ? pathParts.slice(1).join('.') 
        : msg.canonicalPath;
      
      return {
        id: msg.signature,
        code: msg.code,
        message: msg.text,
        severity: msg.severity,
        category: aspect.aspect,
        path: pathWithoutResourceType,
        location: [pathWithoutResourceType],
      };
    })
  );
}

/**
 * Get validation summary from resource
 * Prefers enhanced validation, falls back to legacy
 */
export function getValidationSummary(resource: any): any {
  const enhancedValidation = resource?._enhancedValidationSummary;
  const legacyValidation = resource?._validationSummary;
  return enhancedValidation || legacyValidation;
}

/**
 * Check if resource has validation data
 */
export function hasValidationData(validationSummary: any): boolean {
  return validationSummary && validationSummary.lastValidated;
}

/**
 * Calculate total issues count from validation summary
 */
export function calculateTotalIssues(validationSummary: any): number {
  if (!validationSummary) return 0;
  
  return (
    (validationSummary.errorCount || 0) + 
    (validationSummary.warningCount || 0) + 
    (validationSummary.informationCount || 0)
  );
}

/**
 * Extract profile URLs from resource metadata
 */
export function extractProfileUrls(resource: any): string[] {
  return (resource.data?.meta?.profile || resource.meta?.profile || []) as string[];
}

