/**
 * Validation result for FHIR resource structure
 */
export interface FhirResourceValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate FHIR resource structure (basic validation)
 * Checks for required fields and basic FHIR compliance
 */
export function validateFhirResourceStructure(resource: any): FhirResourceValidationResult {
  const errors: string[] = [];
  
  if (!resource.resourceType) {
    errors.push('Missing required field: resourceType');
  }
  
  if (!resource.id) {
    errors.push('Missing required field: id');
  }
  
  // Check for basic FHIR structure requirements
  if (resource.meta && typeof resource.meta !== 'object') {
    errors.push('meta must be an object');
  }
  
  if (resource.text && typeof resource.text !== 'object') {
    errors.push('text must be an object');
  }
  
  // Size check (max 5MB)
  const resourceSize = JSON.stringify(resource).length;
  if (resourceSize > 5 * 1024 * 1024) {
    errors.push('Resource size exceeds 5MB limit');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

