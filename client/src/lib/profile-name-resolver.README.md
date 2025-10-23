# Profile Name Resolver

## Overview

The Profile Name Resolver fetches and caches human-readable FHIR profile names from Simplifier.net to improve the display of validation messages.

## Features

- **Automatic Name Resolution**: Fetches profile titles from StructureDefinition resources
- **Smart Caching**: 1-hour cache to minimize API calls
- **Graceful Fallbacks**: Falls back to URL-based name extraction if API fails
- **Batch Preloading**: Support for loading multiple profile names in parallel
- **Timeout Protection**: 5-second timeout prevents hanging requests

## Usage

### Basic Usage

```typescript
import { getProfileName } from '@/lib/profile-name-resolver';

// Fetch a profile name
const name = await getProfileName(
  'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient'
);
// Returns: "MII PR Person Patient"
```

### With React Component

```typescript
import { ValidationProfileBadge } from '@/components/validation/ValidationProfileBadge';

<ValidationProfileBadge 
  profileUrl="https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient"
/>
```

### Batch Preloading

```typescript
import { preloadProfileNames } from '@/lib/profile-name-resolver';

// Preload multiple profiles (useful before rendering a list)
const profileUrls = [
  'https://example.com/StructureDefinition/Patient',
  'https://example.com/StructureDefinition/Observation',
];

await preloadProfileNames(profileUrls);
```

### Cache Management

```typescript
import { 
  clearProfileCache, 
  getProfileCacheStats 
} from '@/lib/profile-name-resolver';

// Clear cache
clearProfileCache();

// Get cache statistics
const stats = getProfileCacheStats();
console.log(`Cache size: ${stats.size}`);
console.log('Cached profiles:', stats.entries);
```

## How It Works

Due to CORS restrictions, we cannot fetch profile metadata directly from external URLs in the browser. Instead, the resolver uses a smart approach:

1. **Known Profiles**: First checks against a static mapping of common FHIR profiles (MII, HL7, US Core, etc.)
2. **Cache Check**: Checks if the profile URL is already in the in-memory cache
3. **Smart URL Parsing**: For unknown profiles, intelligently parses the URL and formats it into a human-readable name
4. **Caching**: Results are cached for 1 hour to optimize performance

## Example Transformations

| Profile URL | Displayed Name |
|-------------|---------------|
| `https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient` | `MII PR Person Patient` |
| `https://hl7.org/fhir/us/core/StructureDefinition/us-core-patient` | `US Core Patient Profile` |
| `https://example.com/StructureDefinition/CustomProfile\|2025.0.1` | `CustomProfile` (if fetch fails) |

## Performance

- **Known Profile**: < 1ms (static mapping lookup)
- **Unknown Profile**: < 5ms (URL parsing and formatting)
- **Cache Hit**: < 1ms (in-memory lookup)
- **Cache Duration**: 1 hour
- **No Network Requests**: All operations are synchronous and local

## Error Handling

The resolver is designed to never throw errors to the UI:

1. Unknown profiles → uses intelligent URL parsing and formatting
2. Invalid URL format → returns original URL
3. Empty cache → immediately resolves from known mappings or URL parsing
4. No network failures → all operations are local and synchronous

## Components

### ValidationProfileBadge

A React component that displays a profile badge with automatic name resolution:

**Props:**
- `profileUrl` (string): Full profile URL
- `className` (string, optional): Additional CSS classes

**Features:**
- Instant display (no loading state needed)
- Tooltip with full URL
- External link icon  
- Purple styling to match profile conventions
- Clickable link to profile documentation
- Supports known profiles and intelligent URL parsing

## API Reference

### `getProfileName(profileUrl: string): Promise<string>`

Fetches and caches the profile name.

**Parameters:**
- `profileUrl`: Full profile URL (with or without version)

**Returns:**
- Profile display name

### `preloadProfileNames(profileUrls: string[]): Promise<void>`

Preloads multiple profile names in parallel.

**Parameters:**
- `profileUrls`: Array of profile URLs

**Returns:**
- Promise that resolves when all profiles are loaded (or failed)

### `clearProfileCache(): void`

Clears the entire profile cache.

### `getProfileCacheStats(): object`

Returns cache statistics for debugging.

**Returns:**
```typescript
{
  size: number;
  entries: {
    url: string;
    name: string;
    age: number; // milliseconds since cached
  }[];
}
```

## Configuration

### Cache Duration

To change the cache duration, modify `CACHE_DURATION` in `profile-name-resolver.ts`:

```typescript
// Default: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

// Example: 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;
```

### Adding Known Profiles

To add more profile mappings, update the `KNOWN_PROFILES` object:

```typescript
const KNOWN_PROFILES: Record<string, string> = {
  // Add your profile URL and display name
  'https://example.com/fhir/StructureDefinition/MyProfile': 'My Custom Profile',
  // ...existing entries
};
```

## Testing

```typescript
import { 
  getProfileName, 
  clearProfileCache,
  getProfileCacheStats 
} from '@/lib/profile-name-resolver';

// Test with known profile
const name = await getProfileName(
  'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient'
);
console.assert(name === 'MII PR Person Patient', 'Profile name should match');

// Test caching
const stats1 = getProfileCacheStats();
console.log('Cache size:', stats1.size);

clearProfileCache();
const stats2 = getProfileCacheStats();
console.assert(stats2.size === 0, 'Cache should be empty');
```

## Future Enhancements

Potential improvements for future versions:

1. **Persistent Cache**: Store cache in localStorage/IndexedDB
2. **Backend Proxy**: Proxy requests through backend to bypass CORS
3. **Profile Registry**: Maintain a comprehensive registry of known profiles
4. **Custom Resolvers**: Allow custom resolution logic per domain
5. **Auto-Discovery**: Detect and cache new profiles from validation messages

## Why No Direct Fetching?

The original implementation attempted to fetch profile metadata directly from URLs, but this approach failed due to:

1. **CORS Restrictions**: Most profile URLs (HL7, MII, etc.) don't allow cross-origin requests from browsers
2. **Performance**: Network requests add 100-500ms latency
3. **Reliability**: External services may be unavailable or rate-limited

The static mapping + smart parsing approach:
- ✅ Works instantly (no network delays)
- ✅ Never fails due to network issues
- ✅ Provides consistent, predictable results
- ✅ Easy to extend with new known profiles

