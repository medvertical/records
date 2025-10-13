/**
 * Utility functions for working with resource data
 */

/**
 * Extracts the first 8 characters from a resource ID for display purposes
 * @param id - The full resource ID (e.g., "4f8ccf9d-db5b-4649-900a-873edaa12a11")
 * @returns The shortened ID (e.g., "4f8ccf9d")
 */
export function getShortId(id: string | null | undefined): string {
  if (!id) return '';
  
  // Return first 8 characters, or the full string if it's shorter than 8 characters
  return id.length >= 8 ? id.substring(0, 8) : id;
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
