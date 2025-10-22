// ============================================================================
// FHIR Extension and Slice Detection Utilities
// ============================================================================

import type { SliceMatch } from './types';
import type { SliceDefinition } from '@/lib/profile-slice-resolver';
import { matchElementToSlice as matchToProfile } from '@/lib/profile-slice-resolver';

export interface ExtensionInfo {
  url: string;
  valueType: string;
  value: any;
  displayName: string;
  isModifier: boolean;
}

export interface SliceInfo {
  name: string;
  discriminator: string;
}

/**
 * Check if a field is an extension field
 */
export function isExtensionField(key: string, value: any): boolean {
  return (key === 'extension' || key === 'modifierExtension') && Array.isArray(value);
}

/**
 * Extract extension information from an extension object
 */
export function extractExtensionInfo(extension: any, isModifier: boolean = false): ExtensionInfo | null {
  if (!extension || typeof extension !== 'object') {
    return null;
  }

  const url = extension.url || '';
  if (!url) {
    return null;
  }

  // Find the value field (valueString, valueCode, valueInteger, etc.)
  const valueKeys = Object.keys(extension).filter(key => key.startsWith('value'));
  const valueKey = valueKeys[0];
  const valueType = valueKey ? valueKey.substring(5) : 'unknown'; // Remove 'value' prefix
  const value = valueKey ? extension[valueKey] : extension.extension; // Nested extensions

  return {
    url,
    valueType,
    value,
    displayName: getExtensionDisplayName(url),
    isModifier,
  };
}

/**
 * Convert extension URL to readable display name
 */
export function getExtensionDisplayName(url: string): string {
  if (!url) return 'unknown';

  // Extract the last part of the URL
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1];

  // Remove common prefixes
  let displayName = lastPart
    .replace(/^patient-/, '')
    .replace(/^extension-/, '')
    .replace(/^ext-/, '');

  // Convert kebab-case or camelCase to space-separated
  displayName = displayName
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();

  // Capitalize first letter of each word
  displayName = displayName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return displayName;
}

/**
 * Auto-detect slice name from common FHIR discriminator patterns
 */
export function detectSliceName(arrayItem: any, arrayKey: string, index: number): string | null {
  if (!arrayItem || typeof arrayItem !== 'object') {
    return null;
  }

  // Common discriminator patterns in FHIR
  const discriminators = [
    'system',      // CodeableConcept, Identifier, Coding
    'use',         // ContactPoint, Identifier, HumanName
    'type',        // Identifier, CodeableConcept
    'code',        // Coding
    'profile',     // Reference
    'contentType', // Attachment
  ];

  // Check each discriminator
  for (const discriminator of discriminators) {
    if (arrayItem[discriminator]) {
      const discriminatorValue = arrayItem[discriminator];
      
      // Extract meaningful name from discriminator value
      let sliceName = '';
      
      if (typeof discriminatorValue === 'string') {
        sliceName = extractSliceNameFromString(discriminatorValue);
      } else if (typeof discriminatorValue === 'object' && discriminatorValue.coding) {
        // CodeableConcept
        sliceName = discriminatorValue.coding[0]?.code || discriminatorValue.coding[0]?.display || '';
      } else if (typeof discriminatorValue === 'object' && discriminatorValue.code) {
        // Coding
        sliceName = discriminatorValue.code;
      }

      if (sliceName) {
        return sliceName;
      }
    }
  }

  // Special cases for specific array types
  if (arrayKey === 'identifier' && arrayItem.system) {
    return extractSliceNameFromString(arrayItem.system);
  }

  if (arrayKey === 'telecom' && arrayItem.system) {
    return arrayItem.system; // phone, email, etc.
  }

  if (arrayKey === 'name' && arrayItem.use) {
    return arrayItem.use; // official, maiden, etc.
  }

  if (arrayKey === 'address' && arrayItem.use) {
    return arrayItem.use; // home, work, etc.
  }

  return null;
}

/**
 * Extract a readable slice name from a string value (URL, code, etc.)
 */
function extractSliceNameFromString(value: string): string {
  if (!value) return '';

  // If it's a URL, get the last meaningful part
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {
    const parts = value.split('/');
    const lastPart = parts[parts.length - 1];
    
    // Clean up common patterns
    return lastPart
      .replace(/^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/, 'OID') // OID format
      .replace(/^\{[a-f0-9-]+\}$/, 'UUID') // UUID format
      .substring(0, 30); // Limit length
  }

  // For simple codes, just return as-is (but limit length)
  return value.substring(0, 30);
}

/**
 * Check if an array item is an extension object
 */
export function isExtensionObject(value: any): boolean {
  return value && 
         typeof value === 'object' && 
         'url' in value && 
         typeof value.url === 'string';
}

/**
 * Detect slice name with profile support
 * 
 * Tries to match element to profile-defined slices first,
 * falls back to heuristic detection if profile unavailable.
 * 
 * @param arrayItem - The array element to match
 * @param arrayKey - The parent array key (e.g., "identifier")
 * @param index - Array index
 * @param sliceDefinitions - Optional slice definitions from profile
 * @returns SliceMatch object with slice name and confirmation status
 */
export function detectSliceNameWithProfile(
  arrayItem: any,
  arrayKey: string,
  index: number,
  sliceDefinitions?: SliceDefinition[]
): SliceMatch | null {
  // Debug logging for identifier slices
  if (arrayKey === 'identifier') {
    console.log(`[detectSliceNameWithProfile] Processing identifier[${index}]`);
    console.log(`[detectSliceNameWithProfile] Has slice definitions:`, !!sliceDefinitions, sliceDefinitions?.length);
    console.log(`[detectSliceNameWithProfile] Element system:`, arrayItem?.system);
  }

  // If we have slice definitions from profile, try profile-based matching first
  if (sliceDefinitions && sliceDefinitions.length > 0) {
    const match = matchToProfile(arrayItem, sliceDefinitions, arrayKey);
    
    if (arrayKey === 'identifier') {
      console.log(`[detectSliceNameWithProfile] Profile match result:`, match);
    }
    
    if (match.sliceName) {
      if (arrayKey === 'identifier') {
        console.log(`[detectSliceNameWithProfile] ✓ Using profile slice name: ${match.sliceName}`);
      }
      return {
        sliceName: match.sliceName,
        confirmed: true,
        confidence: match.confidence,
      };
    }
  }

  // Fallback to heuristic detection
  const heuristicName = detectSliceName(arrayItem, arrayKey, index);
  
  if (arrayKey === 'identifier') {
    console.log(`[detectSliceNameWithProfile] ✗ Falling back to heuristic: ${heuristicName}`);
  }
  
  if (heuristicName) {
    return {
      sliceName: heuristicName,
      confirmed: false,
      confidence: 'low',
    };
  }

  return null;
}

