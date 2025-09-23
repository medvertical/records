/**
 * Validation Message Converter
 * 
 * Converts technical validation messages to human-readable explanations.
 * This helps users understand what validation errors mean in plain language.
 */

// ============================================================================
// Types
// ============================================================================

interface ValidationIssue {
  code?: string;
  message?: string;
  category?: string;
  path?: string;
}

// ============================================================================
// Message Maps
// ============================================================================

// Map of common technical messages to human-readable explanations
const MESSAGE_MAP: { [key: string]: string } = {
  // Profile resolution errors
  'Unable to resolve reference to profile': 'The system cannot find the validation rules for this resource. This means the resource references a set of rules that aren\'t available in our system.',
  'Profile not found': 'The validation rules (profile) this resource should follow cannot be located. Please verify the profile is installed.',
  'Unable to resolve reference to profile https://profiles.ihe.net/ITI/BALP': 'The IHE Basic Audit Log Patterns (BALP) profile is not installed. This profile defines how audit events should be structured for healthcare interoperability.',
  
  // Structural errors
  'missing-narrative': 'This resource is missing a human-readable summary. FHIR resources should include a text summary that describes the content in plain language.',
  'invalid-cardinality': 'This field appears too many times or is missing when required. Check the resource documentation for the correct number of occurrences.',
  'unknown-element': 'This field is not recognized as part of this resource type. It may be misspelled or not allowed here.',
  'invalid-type': 'The data type is incorrect for this field. For example, a date field contains text or a number field contains letters.',
  
  // Terminology errors
  'invalid-code': 'The code value used is not from the allowed list. Medical codes must come from specific standardized lists.',
  'invalid-display': 'The description text doesn\'t match the code. Each medical code has a specific description that should be used.',
  'terminology-not-found': 'The medical coding system referenced is not available for validation.',
  
  // Reference errors
  'invalid-reference': 'This points to another resource that doesn\'t exist or cannot be found in the system.',
  'broken-reference': 'The link to another resource is broken. The referenced resource may have been deleted or moved.',
  'circular-reference': 'Resources are referencing each other in a loop, which is not allowed.',
  
  // Business rule errors
  'business-rule-violation': 'This violates a healthcare business rule. For example, an end date that comes before a start date.',
  'invariant-violation': 'A specific rule for this resource type has been broken. Check the resource documentation for requirements.',
  
  // Metadata errors
  'invalid-meta': 'The resource metadata (version, last updated, etc.) is incorrect or missing required information.',
  'missing-security-label': 'This resource should have security labels to indicate privacy or sensitivity levels.',
};

// Category-based generic messages
const CATEGORY_MESSAGES: { [key: string]: string } = {
  'structural': 'There is an issue with how this resource is structured. The format or organization doesn\'t match FHIR requirements.',
  'profile': 'This resource doesn\'t follow the specific validation rules (profile) it claims to follow.',
  'terminology': 'There is an issue with the medical codes or terminology used in this resource.',
  'reference': 'This resource references another resource that has problems or cannot be found.',
  'business-rule': 'This resource violates a business rule or constraint that applies to this type of data.',
  'metadata': 'There is an issue with the resource\'s metadata, such as version information or timestamps.',
  'general': 'There is a general issue with this resource that doesn\'t fit into other categories.'
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Convert technical validation message to human-readable explanation
 */
export function getHumanReadableMessage(issue: ValidationIssue): string {
  const { code, message, category, path } = issue;
  
  // Check if we have a specific human-readable message for this code
  for (const [key, value] of Object.entries(MESSAGE_MAP)) {
    if (code?.includes(key) || message?.includes(key)) {
      return value + (path ? ` (Location: ${path})` : '');
    }
  }
  
  // Category-based generic messages
  if (category && CATEGORY_MESSAGES[category]) {
    return CATEGORY_MESSAGES[category] + (path ? ` (Location: ${path})` : '');
  }
  
  // Fallback to original message with location if available
  const originalMessage = message || code || 'Unknown validation issue';
  return originalMessage + (path ? ` (Location: ${path})` : '');
}

/**
 * Get a short summary message for the issue
 */
export function getShortMessage(issue: ValidationIssue): string {
  const { code, message, category } = issue;
  
  // Try to get a short version from the code
  if (code) {
    const shortCodes: { [key: string]: string } = {
      'missing-narrative': 'Missing human-readable summary',
      'invalid-cardinality': 'Wrong number of occurrences',
      'unknown-element': 'Unknown field',
      'invalid-type': 'Wrong data type',
      'invalid-code': 'Invalid medical code',
      'invalid-reference': 'Broken reference',
      'business-rule-violation': 'Business rule violation',
      'invariant-violation': 'Rule violation'
    };
    
    for (const [key, value] of Object.entries(shortCodes)) {
      if (code.includes(key)) {
        return value;
      }
    }
  }
  
  // Fallback to category-based short message
  if (category) {
    const shortCategories: { [key: string]: string } = {
      'structural': 'Structure issue',
      'profile': 'Profile violation',
      'terminology': 'Code issue',
      'reference': 'Reference problem',
      'business-rule': 'Rule violation',
      'metadata': 'Metadata issue',
      'general': 'General issue'
    };
    
    return shortCategories[category] || 'Validation issue';
  }
  
  // Final fallback
  return message || code || 'Unknown issue';
}

/**
 * Get severity-based styling information
 */
export function getSeverityInfo(severity: string) {
  const severityMap = {
    'error': {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: 'AlertCircle'
    },
    'warning': {
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      icon: 'AlertTriangle'
    },
    'information': {
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: 'Info'
    }
  };
  
  return severityMap[severity as keyof typeof severityMap] || severityMap.information;
}

/**
 * Get category-based styling information
 */
export function getCategoryInfo(category: string) {
  const categoryMap = {
    'structural': {
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      icon: 'Code'
    },
    'profile': {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      icon: 'FileCheck'
    },
    'terminology': {
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      icon: 'BookOpen'
    },
    'reference': {
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      icon: 'Link'
    },
    'business-rule': {
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: 'Shield'
    },
    'metadata': {
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: 'FileText'
    },
    'general': {
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: 'AlertCircle'
    }
  };
  
  return categoryMap[category as keyof typeof categoryMap] || categoryMap.general;
}
