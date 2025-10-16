# Profile Resolution API Documentation

**Task 4.11**: Profile Resolution Endpoints for Smart Profile Management

These endpoints expose the ProfileResolver functionality, enabling automatic profile resolution, German profile detection, metadata extraction, and version management.

---

## Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/profiles/resolve` | Resolve profile by canonical URL |
| GET | `/api/profiles/metadata` | Get profile metadata |
| GET | `/api/profiles/summary` | Get human-readable profile summary |
| POST | `/api/profiles/detect-german` | Detect German profile family |
| GET | `/api/profiles/available-versions` | Get available versions |
| GET | `/api/profiles/cached` | Check if profile is cached |
| POST | `/api/profiles/clear-cache` | Clear profile cache |
| GET | `/api/profiles/cache-stats` | Get cache statistics |
| GET | `/api/profiles/german-packages` | Get suggested German packages |

---

## 1. Resolve Profile

**Endpoint:** `POST /api/profiles/resolve`

Resolves a FHIR profile by canonical URL, automatically downloading and caching it if not available. Supports version resolution, German profile detection, and dependency resolution.

### Request

```http
POST /api/profiles/resolve
Content-Type: application/json

{
  "canonicalUrl": "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient",
  "version": "2.0.0"  // Optional - supports ranges like "^2.0.0", "latest"
}
```

### Response

```json
{
  "success": true,
  "canonicalUrl": "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient",
  "version": "2.0.0",
  "source": "database",
  "downloaded": true,
  "resolutionTime": 45,
  "dependencies": [
    "http://fhir.de/StructureDefinition/identifier-kvid",
    "http://fhir.de/StructureDefinition/address-de-basis"
  ],
  "metadata": {
    "name": "MIIPatient",
    "title": "MII Profile - Patient",
    "type": "Patient",
    "kind": "resource",
    "status": "active",
    "elementCount": 47,
    "constraintCount": 8,
    "mustSupportCount": 12,
    "extensionCount": 5,
    "complexityScore": 68
  },
  "germanProfile": {
    "isGermanProfile": true,
    "family": "mii",
    "confidence": 100,
    "module": "person",
    "recommendedPackage": "de.medizininformatikinitiative.kerndatensatz.person",
    "packageVersion": "latest",
    "description": "Medizininformatik-Initiative (MII) - German Medical Informatics Initiative core dataset profiles",
    "useCase": "Research data collection",
    "patternMatched": "medizininformatikinitiative"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Profile not found in any source"
}
```

---

## 2. Get Profile Metadata

**Endpoint:** `GET /api/profiles/metadata`

Retrieves detailed metadata for a profile, including elements, constraints, extensions, and bindings.

### Request

```http
GET /api/profiles/metadata?canonicalUrl=http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient&version=6.1.0
```

### Query Parameters

- `canonicalUrl` (required): Profile canonical URL
- `version` (optional): Specific version

### Response

```json
{
  "success": true,
  "metadata": {
    "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    "name": "USCorePatient",
    "title": "US Core Patient Profile",
    "version": "6.1.0",
    "status": "active",
    "fhirVersion": "4.0.1",
    "type": "Patient",
    "kind": "resource",
    "abstract": false,
    "baseDefinition": "http://hl7.org/fhir/StructureDefinition/Patient",
    "derivation": "constraint",
    "elements": [
      {
        "path": "Patient.identifier",
        "min": 1,
        "max": "*",
        "types": ["Identifier"],
        "mustSupport": true
      }
      // ... more elements
    ],
    "constraints": [
      {
        "key": "us-core-1",
        "severity": "error",
        "human": "Either Patient.name.given or Patient.name.family SHALL be present",
        "expression": "name.exists() implies (name.given.exists() or name.family.exists())"
      }
      // ... more constraints
    ],
    "extensions": [
      {
        "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
        "usedIn": ["Patient.extension"],
        "min": 0,
        "max": "1"
      }
      // ... more extensions
    ],
    "bindings": [
      {
        "path": "Patient.gender",
        "strength": "required",
        "valueSet": "http://hl7.org/fhir/ValueSet/administrative-gender"
      }
      // ... more bindings
    ],
    "mustSupportElements": ["Patient.identifier", "Patient.name", "Patient.gender"],
    "complexityScore": 68,
    "requiredElements": [...],
    "modifierElements": [...]
  }
}
```

---

## 3. Get Profile Summary

**Endpoint:** `GET /api/profiles/summary`

Generates a human-readable text summary of a profile.

### Request

```http
GET /api/profiles/summary?canonicalUrl=http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient&version=6.1.0
```

### Response

```json
{
  "success": true,
  "summary": "Profile: USCorePatient (http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient)\nType: Patient (resource)\nVersion: 6.1.0\nStatus: active\nBase: http://hl7.org/fhir/StructureDefinition/Patient\n\nStatistics:\n  Elements: 47\n  Required Elements: 3\n  Must-Support Elements: 12\n  Constraints: 8\n  Extensions: 5\n  Value Set Bindings: 6\n  Slicing Definitions: 2\n  Complexity Score: 68/100\n\nMust-Support Elements:\n  - Patient.identifier\n  - Patient.name\n  - Patient.gender\n  ...\n\nConstraints:\n  - us-core-1: Either name.given or name.family SHALL be present\n  ..."
}
```

---

## 4. Detect German Profile

**Endpoint:** `POST /api/profiles/detect-german`

Detects if a profile belongs to a German profile family (MII, ISiK, KBV, Basisprofil, etc.) and provides recommendations.

### Request

```http
POST /api/profiles/detect-german
Content-Type: application/json

{
  "canonicalUrl": "https://www.medizininformatik-initiative.de/fhir/core/modul-diagnose/StructureDefinition/Diagnose"
}
```

### Response

```json
{
  "success": true,
  "detection": {
    "isGermanProfile": true,
    "family": "mii",
    "confidence": 100,
    "module": "diagnose",
    "recommendedPackage": "de.medizininformatikinitiative.kerndatensatz.diagnose",
    "packageVersion": "latest",
    "description": "Medizininformatik-Initiative (MII) - German Medical Informatics Initiative core dataset profiles",
    "useCase": "Research data collection",
    "patternMatched": "medizininformatikinitiative"
  },
  "recommendations": [
    "✓ Detected Medizininformatik-Initiative (MII) - German Medical Informatics Initiative core dataset profiles",
    "📦 Recommended package: de.medizininformatikinitiative.kerndatensatz.diagnose",
    "📋 Module: diagnose",
    "💡 Common use case: Research data collection",
    "⚕️ Consider validating against complete MII Kerndatensatz modules",
    "🔗 May require related modules (e.g., Person + Diagnose)"
  ]
}
```

---

## 5. Get Available Versions

**Endpoint:** `GET /api/profiles/available-versions`

Returns all available versions for a profile from database cache and external sources.

### Request

```http
GET /api/profiles/available-versions?canonicalUrl=http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient
```

### Response

```json
{
  "success": true,
  "canonicalUrl": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  "versions": ["7.0.0", "6.1.0", "6.0.0", "5.0.1", "5.0.0"],
  "count": 5
}
```

---

## 6. Check Cache Status

**Endpoint:** `GET /api/profiles/cached`

Checks if a profile is currently cached in memory.

### Request

```http
GET /api/profiles/cached?canonicalUrl=http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient&version=6.1.0
```

### Response

```json
{
  "success": true,
  "canonicalUrl": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  "version": "6.1.0",
  "cached": true
}
```

---

## 7. Clear Profile Cache

**Endpoint:** `POST /api/profiles/clear-cache`

Clears the in-memory profile cache.

### Request

```http
POST /api/profiles/clear-cache
```

### Response

```json
{
  "success": true,
  "message": "Profile cache cleared successfully"
}
```

---

## 8. Get Cache Statistics

**Endpoint:** `GET /api/profiles/cache-stats`

Returns statistics about the current profile cache.

### Request

```http
GET /api/profiles/cache-stats
```

### Response

```json
{
  "success": true,
  "stats": {
    "size": 15,
    "profiles": [
      "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient|6.1.0",
      "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient|2.0.0",
      "..."
    ]
  }
}
```

---

## 9. Get German Packages

**Endpoint:** `GET /api/profiles/german-packages`

Returns suggested German FHIR packages for download.

### Request

```http
GET /api/profiles/german-packages
```

### Response

```json
{
  "success": true,
  "packages": [
    {
      "family": "basisprofil",
      "packages": ["de.basisprofil.r4"]
    },
    {
      "family": "mii",
      "packages": ["de.medizininformatikinitiative.kerndatensatz.person"]
    },
    {
      "family": "isik",
      "packages": ["de.gematik.isik-basismodul"]
    },
    {
      "family": "kbv",
      "packages": ["kbv.basis"]
    }
  ]
}
```

---

## Usage Examples

### Resolve a Profile

```typescript
// Resolve US Core Patient profile
const response = await fetch('/api/profiles/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    canonicalUrl: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient',
    version: '^6.0.0'  // Supports version ranges
  })
});

const result = await response.json();
console.log(`Profile resolved from ${result.source} in ${result.resolutionTime}ms`);
```

### Detect German Profile

```typescript
// Check if a profile is German
const response = await fetch('/api/profiles/detect-german', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    canonicalUrl: 'https://www.medizininformatik-initiative.de/fhir/core/modul-diagnose/StructureDefinition/Diagnose'
  })
});

const result = await response.json();
if (result.detection.isGermanProfile) {
  console.log(`German ${result.detection.family.toUpperCase()} profile detected!`);
  console.log('Recommendations:', result.recommendations);
}
```

### Get Profile Metadata

```typescript
// Get detailed metadata
const canonicalUrl = encodeURIComponent('http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient');
const response = await fetch(`/api/profiles/metadata?canonicalUrl=${canonicalUrl}&version=6.1.0`);

const result = await response.json();
console.log(`Profile has ${result.metadata.elementCount} elements`);
console.log(`Complexity score: ${result.metadata.complexityScore}/100`);
console.log(`Must-support elements:`, result.metadata.mustSupportElements);
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes:**
- `200`: Success
- `400`: Bad request (missing required parameters)
- `404`: Profile not found
- `500`: Server error (resolution failed, network issues, etc.)

---

## Features

### Automatic Profile Resolution
- Multi-source search (database → Simplifier → FHIR Registry)
- Automatic downloads with caching
- Dependency resolution
- Version-aware selection

### German Profile Support
- Detects MII, ISiK, KBV, Basisprofil, HL7-DE, gematik profiles
- Provides package recommendations
- Auto-downloads recommended packages
- Context-aware suggestions

### Performance Optimization
- Multi-layer caching (memory + database)
- Parallel dependency downloads
- SHA-256 content hashing
- Access statistics tracking

### Metadata Extraction
- Element definitions with cardinality
- Constraints (invariants) with FHIRPath
- Extension analysis
- Value set bindings
- Slicing information
- Complexity scoring

---

## Integration with Frontend

These endpoints can be used to build rich UI features:

### Profile Selector Component
```typescript
// Fetch available versions for dropdown
const versions = await fetchAvailableVersions(canonicalUrl);

// Check if already cached (show indicator)
const isCached = await checkCacheStatus(canonicalUrl, version);

// Resolve profile when user selects it
const result = await resolveProfile(canonicalUrl, version);
```

### German Profile Badge
```typescript
// Show badge for German profiles
const detection = await detectGermanProfile(canonicalUrl);
if (detection.isGermanProfile) {
  showBadge(detection.family); // Shows "MII", "ISiK", etc.
}
```

### Profile Info Panel
```typescript
// Show detailed profile information
const metadata = await getProfileMetadata(canonicalUrl);
renderProfileInfo({
  elements: metadata.elementCount,
  constraints: metadata.constraintCount,
  complexity: metadata.complexityScore,
  mustSupport: metadata.mustSupportElements
});
```

---

## Performance Considerations

- **First Resolution**: 500-2000ms (includes download and caching)
- **Cached Resolution**: 5-50ms (from memory or database)
- **Metadata Extraction**: 10-100ms (depends on profile complexity)
- **German Detection**: <1ms (pattern matching)

### Optimization Tips

1. **Pre-resolve common profiles** at application startup
2. **Cache statistics endpoint** is lightweight - safe to poll
3. **Use version ranges** (`^6.0.0`) for automatic updates
4. **German package endpoint** provides instant suggestions

---

## Security

- No authentication required (profiles are public resources)
- Rate limiting recommended for production
- Input validation on all endpoints
- SQL injection protection via parameterized queries

---

## Logging

All endpoints produce detailed logs:
```
[ProfileRoutes] Resolving profile: http://example.org/Profile
[ProfileResolver] Resolving profile: http://example.org/Profile
[ProfileResolver] Version resolved: latest → 2.1.0
[ProfileResolver] ✓ German profile detected: MII (confidence: 100%)
[ProfileResolver] Found in database cache: http://example.org/Profile@2.1.0
[ProfileRoutes] Profile resolution successful in 45ms
```

---

## Related Components

- **ProfileResolver**: Core resolution logic
- **GermanProfileDetector**: Pattern recognition
- **VersionResolver**: Version management
- **ProfileMetadataExtractor**: Metadata parsing
- **PackageDependencyResolver**: Package management


