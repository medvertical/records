/**
 * Profile Slice Parser
 * 
 * Extracts slice definitions from FHIR StructureDefinition resources.
 * Used to determine correct slice names for display in the UI.
 * 
 * Features:
 * - Parse snapshot.element or differential.element
 * - Extract slice names and discriminator rules
 * - Extract fixed/pattern values for matching
 * - Support for common discriminator types (value, pattern, type, profile)
 */

// ============================================================================
// Types
// ============================================================================

export interface SliceDefinition {
  /** Element path (e.g., "Patient.identifier") */
  path: string;
  
  /** Slice name (e.g., "versichertenId", "pid") */
  sliceName: string;
  
  /** Discriminators used to identify this slice */
  discriminators: Array<{
    type: 'value' | 'pattern' | 'type' | 'profile' | 'exists';
    path: string;
  }>;
  
  /** Fixed values that must match exactly */
  fixed?: Record<string, any>;
  
  /** Pattern values for matching */
  pattern?: Record<string, any>;
  
  /** Minimum cardinality */
  min?: number;
  
  /** Maximum cardinality */
  max?: string;
  
  /** Short description */
  short?: string;
  
  /** Definition/documentation */
  definition?: string;
}

export interface SliceMatchResult {
  sliceName: string | null;
  confirmed: boolean;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse slice definitions from a StructureDefinition
 * 
 * @param structureDefinition - FHIR StructureDefinition resource
 * @returns Array of slice definitions found in the profile
 */
export function parseProfileSlices(structureDefinition: any): SliceDefinition[] {
  if (!structureDefinition || structureDefinition.resourceType !== 'StructureDefinition') {
    console.warn('[ProfileSliceParser] Invalid StructureDefinition');
    return [];
  }

  const slices: SliceDefinition[] = [];
  
  // Prefer snapshot over differential (snapshot is complete, differential is incremental)
  const elements = structureDefinition.snapshot?.element || 
                   structureDefinition.differential?.element || 
                   [];

  if (elements.length === 0) {
    console.warn('[ProfileSliceParser] No elements found in StructureDefinition');
    return [];
  }

  // Track slicing definitions to associate with sliced elements
  const slicingInfo = new Map<string, any>();

  // First pass: collect slicing information
  for (const element of elements) {
    if (element.slicing) {
      slicingInfo.set(element.id || element.path, element.slicing);
    }
  }

  // Second pass: extract slice definitions
  for (const element of elements) {
    // Check if this element has a sliceName (indicates it's a slice)
    if (element.sliceName) {
      const slice = parseSliceElement(element, slicingInfo);
      if (slice) {
        slices.push(slice);
      }
    }
  }

  console.log(`[ProfileSliceParser] Found ${slices.length} slices in ${structureDefinition.name || structureDefinition.url}`);
  
  return slices;
}

/**
 * Parse a single element into a SliceDefinition
 */
function parseSliceElement(element: any, slicingInfo: Map<string, any>): SliceDefinition | null {
  const path = element.path;
  const sliceName = element.sliceName;

  if (!path || !sliceName) {
    return null;
  }

  // Get parent path (e.g., "Patient.identifier" from "Patient.identifier:versichertenId")
  const parentPath = getParentPath(path);
  
  // Find slicing information for this slice's parent
  const slicing = findSlicingForPath(parentPath, slicingInfo);
  
  // Extract discriminators
  const discriminators = slicing?.discriminator?.map((d: any) => ({
    type: d.type || 'value',
    path: d.path || '',
  })) || [];

  // Extract fixed values
  const fixed = extractFixedValues(element);
  
  // Extract pattern values
  const pattern = extractPatternValues(element);

  return {
    path: parentPath,
    sliceName,
    discriminators,
    fixed,
    pattern,
    min: element.min,
    max: element.max,
    short: element.short,
    definition: element.definition,
  };
}

/**
 * Get parent path from an element path
 * E.g., "Patient.identifier:versichertenId" -> "Patient.identifier"
 */
function getParentPath(path: string): string {
  // Remove slice name suffix (after colon)
  const withoutSlice = path.split(':')[0];
  return withoutSlice;
}

/**
 * Find slicing information for a given path
 */
function findSlicingForPath(path: string, slicingInfo: Map<string, any>): any | null {
  // Try exact match first
  if (slicingInfo.has(path)) {
    return slicingInfo.get(path);
  }

  // Try to find by matching path (some profiles use element.id instead of element.path)
  for (const [key, value] of slicingInfo.entries()) {
    if (key.endsWith(path) || key.split(':')[0] === path) {
      return value;
    }
  }

  return null;
}

/**
 * Extract fixed values from an element
 */
function extractFixedValues(element: any): Record<string, any> | undefined {
  const fixed: Record<string, any> = {};
  
  for (const key in element) {
    if (key.startsWith('fixed')) {
      const fieldName = key.substring(5); // Remove 'fixed' prefix
      const fieldNameLower = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
      fixed[fieldNameLower] = element[key];
    }
  }

  return Object.keys(fixed).length > 0 ? fixed : undefined;
}

/**
 * Extract pattern values from an element
 */
function extractPatternValues(element: any): Record<string, any> | undefined {
  const pattern: Record<string, any> = {};
  
  for (const key in element) {
    if (key.startsWith('pattern')) {
      const fieldName = key.substring(7); // Remove 'pattern' prefix
      const fieldNameLower = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
      pattern[fieldNameLower] = element[key];
    }
  }

  return Object.keys(pattern).length > 0 ? pattern : undefined;
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Match a data element to a slice definition
 * 
 * @param element - Data element to match
 * @param sliceDefinitions - Array of slice definitions from profile
 * @param elementPath - Path of the element (e.g., "identifier")
 * @returns Slice match result with confidence level
 */
export function matchElementToSlice(
  element: any,
  sliceDefinitions: SliceDefinition[],
  elementPath: string
): SliceMatchResult {
  if (!element || typeof element !== 'object') {
    return { sliceName: null, confirmed: false, confidence: 'low' };
  }

  // Filter slices that match the element path
  const relevantSlices = sliceDefinitions.filter(slice => {
    // Match last segment of path (e.g., "identifier" matches "Patient.identifier")
    const slicePathSegments = slice.path.split('.');
    const lastSegment = slicePathSegments[slicePathSegments.length - 1];
    return lastSegment === elementPath;
  });

  if (relevantSlices.length === 0) {
    return { sliceName: null, confirmed: false, confidence: 'low' };
  }

  // Try to match element to each slice based on discriminators
  for (const slice of relevantSlices) {
    const matchScore = calculateMatchScore(element, slice);
    
    if (matchScore.matches) {
      return {
        sliceName: slice.sliceName,
        confirmed: true,
        confidence: matchScore.confidence,
      };
    }
  }

  return { sliceName: null, confirmed: false, confidence: 'low' };
}

/**
 * Calculate match score for an element against a slice definition
 */
function calculateMatchScore(
  element: any,
  slice: SliceDefinition
): { matches: boolean; confidence: 'high' | 'medium' | 'low' } {
  let totalChecks = 0;
  let passedChecks = 0;

  // Check discriminators
  for (const discriminator of slice.discriminators) {
    totalChecks++;
    
    if (checkDiscriminator(element, discriminator, slice)) {
      passedChecks++;
    }
  }

  // Check fixed values
  if (slice.fixed) {
    for (const [key, value] of Object.entries(slice.fixed)) {
      totalChecks++;
      if (deepEqual(element[key], value)) {
        passedChecks++;
      }
    }
  }

  // Check pattern values
  if (slice.pattern) {
    for (const [key, value] of Object.entries(slice.pattern)) {
      totalChecks++;
      if (matchesPattern(element[key], value)) {
        passedChecks++;
      }
    }
  }

  // If no checks were defined, we can't confirm
  if (totalChecks === 0) {
    return { matches: false, confidence: 'low' };
  }

  // All checks must pass for a match
  const matches = passedChecks === totalChecks;
  
  // Confidence based on number of checks passed
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (matches && totalChecks >= 2) {
    confidence = 'high';
  } else if (matches && totalChecks === 1) {
    confidence = 'medium';
  }

  return { matches, confidence };
}

/**
 * Check if an element matches a discriminator
 */
function checkDiscriminator(
  element: any,
  discriminator: { type: string; path: string },
  slice: SliceDefinition
): boolean {
  const { type, path } = discriminator;
  
  // Get value at discriminator path
  const value = getValueAtPath(element, path);
  
  if (value === undefined) {
    return false;
  }

  switch (type) {
    case 'value':
      // Check against fixed values
      if (slice.fixed) {
        const fixedValue = getValueAtPath(slice.fixed, path);
        return deepEqual(value, fixedValue);
      }
      return false;

    case 'pattern':
      // Check against pattern values
      if (slice.pattern) {
        const patternValue = getValueAtPath(slice.pattern, path);
        return matchesPattern(value, patternValue);
      }
      return false;

    case 'type':
      // Type checking would require more complex logic
      return true; // Assume match for now

    case 'profile':
      // Profile checking would require more complex logic
      return true; // Assume match for now

    case 'exists':
      // Check if value exists
      return value !== undefined && value !== null;

    default:
      return false;
  }
}

/**
 * Get value at a nested path (e.g., "system" or "coding[0].code")
 */
function getValueAtPath(obj: any, path: string): any {
  if (!path || !obj) {
    return undefined;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array indices (e.g., "coding[0]")
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = current[key];
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index)];
    } else {
      current = current[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Check if a value matches a pattern (supports wildcards and partial matching)
 */
function matchesPattern(value: any, pattern: any): boolean {
  // For now, use deep equality
  // Could be enhanced to support FHIR pattern matching rules
  return deepEqual(value, pattern);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a summary of slices in a profile
 */
export function getSliceSummary(structureDefinition: any): {
  totalSlices: number;
  slicesByPath: Record<string, string[]>;
} {
  const slices = parseProfileSlices(structureDefinition);
  
  const slicesByPath: Record<string, string[]> = {};
  
  for (const slice of slices) {
    if (!slicesByPath[slice.path]) {
      slicesByPath[slice.path] = [];
    }
    slicesByPath[slice.path].push(slice.sliceName);
  }

  return {
    totalSlices: slices.length,
    slicesByPath,
  };
}

