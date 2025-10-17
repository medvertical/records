/**
 * Profile Name Resolver
 * 
 * Fetches and caches FHIR profile metadata from Simplifier.net
 * to display human-readable profile names instead of URLs.
 */

// In-memory cache for profile metadata
const profileCache = new Map<string, {
  name: string;
  title?: string;
  description?: string;
  cachedAt: number;
}>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

/**
 * Extract profile name from the URL path
 * Falls back to last segment if API call fails
 */
function extractProfileNameFromUrl(profileUrl: string): string {
  try {
    const cleanUrl = profileUrl.replace(/\/$/, '');
    const parts = cleanUrl.split('/');
    const lastSegment = parts[parts.length - 1];
    
    // Remove version if present (e.g., "Patient|2025.0.1" -> "Patient")
    const withoutVersion = lastSegment.split('|')[0];
    return withoutVersion;
  } catch (error) {
    return profileUrl;
  }
}

/**
 * Known profile name mappings for common profiles
 * This avoids CORS issues by using a static mapping
 */
const KNOWN_PROFILES: Record<string, string> = {
  // MII (Medizininformatik Initiative) Profiles
  'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient': 'MII PR Person Patient',
  'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/PatientPseudonymisiert': 'MII PR Person Patient (Pseudonymized)',
  'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/ResearchSubject': 'MII PR Person ResearchSubject',
  
  // HL7 Base Profiles
  'http://hl7.org/fhir/StructureDefinition/Patient': 'FHIR Patient',
  'http://hl7.org/fhir/StructureDefinition/Observation': 'FHIR Observation',
  'http://hl7.org/fhir/StructureDefinition/Condition': 'FHIR Condition',
  'http://hl7.org/fhir/StructureDefinition/Procedure': 'FHIR Procedure',
  'http://hl7.org/fhir/StructureDefinition/DomainResource': 'FHIR DomainResource',
  'http://hl7.org/fhir/StructureDefinition/Resource': 'FHIR Resource',
  
  // US Core Profiles
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient': 'US Core Patient',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation': 'US Core Observation',
};

/**
 * Fetch profile metadata from known mappings or parse from URL
 * 
 * Due to CORS restrictions, we can't fetch directly from most profile URLs.
 * Instead, we use a combination of known mappings and smart URL parsing.
 */
async function fetchProfileMetadata(profileUrl: string): Promise<{
  name: string;
  title?: string;
  description?: string;
}> {
  // Check known profiles first
  const baseUrl = profileUrl.split('|')[0]; // Remove version
  if (KNOWN_PROFILES[baseUrl]) {
    return {
      name: KNOWN_PROFILES[baseUrl],
      title: KNOWN_PROFILES[baseUrl],
    };
  }

  // For unknown profiles, use smart URL parsing
  const parsedName = extractProfileNameFromUrl(profileUrl);
  
  // Try to make it more human-readable
  const humanReadableName = parsedName
    .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
    .join(' ');

  return {
    name: humanReadableName,
  };
}

/**
 * Get profile name with caching
 * 
 * @param profileUrl - Full profile URL (e.g., https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient)
 * @returns Profile display name (e.g., "MII PR Person Patient") or falls back to last URL segment
 */
export async function getProfileName(profileUrl: string): Promise<string> {
  // Remove version from URL for caching (e.g., "Patient|2025.0.1" -> "Patient")
  const baseUrl = profileUrl.split('|')[0];
  
  // Check cache first
  const cached = profileCache.get(baseUrl);
  if (cached && Date.now() - cached.cachedAt < CACHE_DURATION) {
    return cached.name;
  }

  // Fetch from Simplifier
  const metadata = await fetchProfileMetadata(baseUrl);
  
  // Cache the result
  profileCache.set(baseUrl, {
    ...metadata,
    cachedAt: Date.now(),
  });

  return metadata.name;
}

/**
 * Preload profile names for multiple URLs
 * Useful for batch loading in lists
 */
export async function preloadProfileNames(profileUrls: string[]): Promise<void> {
  const uniqueUrls = [...new Set(profileUrls)];
  const uncachedUrls = uniqueUrls.filter(url => {
    const cached = profileCache.get(url.split('|')[0]);
    return !cached || Date.now() - cached.cachedAt >= CACHE_DURATION;
  });

  // Fetch all uncached profiles in parallel
  await Promise.allSettled(
    uncachedUrls.map(url => getProfileName(url))
  );
}

/**
 * Clear the profile name cache
 * Useful for testing or forcing refresh
 */
export function clearProfileCache(): void {
  profileCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getProfileCacheStats(): {
  size: number;
  entries: { url: string; name: string; age: number }[];
} {
  const now = Date.now();
  return {
    size: profileCache.size,
    entries: Array.from(profileCache.entries()).map(([url, data]) => ({
      url,
      name: data.name,
      age: now - data.cachedAt,
    })),
  };
}

