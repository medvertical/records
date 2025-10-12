// ============================================================================
// FHIR Field Validation Utilities
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Required fields for FHIR resources
 * These fields must be present and cannot be deleted
 */
const REQUIRED_FIELDS: Record<string, string[]> = {
  // Common required fields for all resources
  '*': ['resourceType', 'id'],
  // Resource-specific required fields
  Patient: ['resourceType', 'id'],
  Observation: ['resourceType', 'id', 'status', 'code'],
  Condition: ['resourceType', 'id', 'subject'],
  Medication: ['resourceType', 'id'],
  MedicationRequest: ['resourceType', 'id', 'status', 'intent', 'medication', 'subject'],
  Procedure: ['resourceType', 'id', 'status', 'subject'],
  Encounter: ['resourceType', 'id', 'status', 'class'],
  DiagnosticReport: ['resourceType', 'id', 'status', 'code'],
  AllergyIntolerance: ['resourceType', 'id', 'patient'],
  Immunization: ['resourceType', 'id', 'status', 'vaccineCode', 'patient', 'occurrence'],
  CarePlan: ['resourceType', 'id', 'status', 'intent', 'subject'],
  Goal: ['resourceType', 'id', 'lifecycleStatus', 'description', 'subject'],
};

/**
 * Get required fields for a resource type
 */
export function getRequiredFields(resourceType: string): string[] {
  const specific = REQUIRED_FIELDS[resourceType] || [];
  const common = REQUIRED_FIELDS['*'] || [];
  return Array.from(new Set([...common, ...specific]));
}

/**
 * Check if a field is required for a given resource type
 */
export function isFieldRequired(resourceType: string, fieldPath: string): boolean {
  const required = getRequiredFields(resourceType);
  // Handle dot notation paths (e.g., "medication.reference")
  const rootField = fieldPath.split('.')[0];
  return required.includes(rootField);
}

/**
 * Validate a field value based on its type
 */
export function validateField(key: string, value: any, resourceType?: string): ValidationResult {
  // Check if required field is empty
  if (resourceType && isFieldRequired(resourceType, key)) {
    if (value === null || value === undefined || value === '') {
      return {
        valid: false,
        error: `${key} is required`,
      };
    }
  }

  // Type-specific validation
  if (typeof value === 'string') {
    // Validate specific string patterns
    if (key === 'resourceType' && !value.match(/^[A-Z][a-zA-Z]+$/)) {
      return {
        valid: false,
        error: 'resourceType must start with uppercase letter',
      };
    }
    
    if (key === 'id' && !value.match(/^[A-Za-z0-9\-\.]{1,64}$/)) {
      return {
        valid: false,
        error: 'id must be 1-64 characters (letters, numbers, dash, dot)',
      };
    }

    // URL validation
    if (key.toLowerCase().includes('url') && value && !isValidUrl(value)) {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  if (typeof value === 'number') {
    if (!isFinite(value)) {
      return {
        valid: false,
        error: 'Number must be finite',
      };
    }
  }

  return { valid: true };
}

/**
 * Check if a property name is valid
 */
export function isValidFieldName(name: string): boolean {
  // FHIR property names must start with lowercase letter
  // and contain only letters, numbers, and underscores
  return /^[a-z][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Infer the type of a value for adding new properties
 */
export function inferValueType(value: any): 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as any;
}

/**
 * Get default value for a given type
 */
export function getDefaultValueForType(type: string): any {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return '';
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    // Try relative URLs or URNs
    return url.startsWith('/') || url.startsWith('urn:');
  }
}

/**
 * Get a human-readable type name
 */
export function getTypeName(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

/**
 * Validate a complete resource structure
 */
export function validateResource(resource: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors: ['Resource must be an object'] };
  }

  if (!resource.resourceType) {
    errors.push('resourceType is required');
  }

  if (!resource.id) {
    errors.push('id is required');
  }

  const requiredFields = getRequiredFields(resource.resourceType);
  requiredFields.forEach(field => {
    if (!(field in resource) || resource[field] === null || resource[field] === undefined) {
      errors.push(`${field} is required for ${resource.resourceType}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

