/**
 * Utility functions for working with resource data
 */

/**
 * Extracts a short identifier for display purposes
 * - For UUIDs: returns only the first segment (before first hyphen)
 * - For non-UUIDs: returns the full ID
 * @param id - The full resource ID (e.g., "4f8ccf9d-db5b-4649-900a-873edaa12a11" or "test-mii-invalid")
 * @returns The shortened ID (e.g., "4f8ccf9d") or full ID for non-UUIDs (e.g., "test-mii-invalid")
 */
export function getShortId(id: string | null | undefined): string {
  if (!id) return '';
  
  // Check if it's a UUID (8-4-4-4-12 format)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidPattern.test(id)) {
    // For UUIDs, return only the first segment (before first hyphen)
    return id.split('-')[0];
  }
  
  // For non-UUIDs, return the full ID
  return id;
}

/**
 * Shortens a reference string that may contain a full resource ID
 * @param reference - The reference string (e.g., "Patient/V860290281141073")
 * @returns The reference with shortened ID (e.g., "Patient/V8602902")
 */
export function getShortReference(reference: string | null | undefined): string {
  if (!reference) return '';
  
  // Check if it's in the format "ResourceType/Id"
  const slashIndex = reference.indexOf('/');
  if (slashIndex === -1) {
    // No slash found, just shorten the whole string
    return getShortId(reference);
  }
  
  const resourceType = reference.substring(0, slashIndex);
  const id = reference.substring(slashIndex + 1);
  const shortId = getShortId(id);
  
  return `${resourceType}/${shortId}`;
}
