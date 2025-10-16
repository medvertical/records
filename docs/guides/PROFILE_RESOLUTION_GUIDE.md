# Profile Resolution System Guide
**Task 12.5: Complete guide to automatic profile resolution and management**

## Overview

The Profile Resolution System automatically discovers, downloads, and caches FHIR StructureDefinition profiles from Simplifier and other sources. It handles dependency resolution, version management, and intelligent caching.

## How It Works

```
Resource declares profile
        ↓
Profile Resolver checks cache
        ↓
   Cache Hit? ──Yes──> Return cached profile
        │
        No
        ↓
Resolve from Simplifier
        ↓
Download dependencies
        ↓
Extract metadata
        ↓
Store in cache (L2 + L3)
        ↓
Return profile
```

---

## Automatic Profile Resolution

### Triggered By

1. **Resource validation** with `meta.profile` declared
2. **Manual resolution** via API
3. **Profile preloading** at startup
4. **IG package installation**

**Example resource:**
```json
{
  "resourceType": "Patient",
  "meta": {
    "profile": [
      "http://fhir.de/StructureDefinition/Patient-de-basis|1.0.0"
    ]
  },
  ...
}
```

**Auto-resolution:**
1. Detects canonical URL: `http://fhir.de/StructureDefinition/Patient-de-basis`
2. Detects version: `1.0.0`
3. Searches cache
4. If not cached, downloads from Simplifier
5. Resolves dependencies
6. Caches for future use

---

## Profile Resolution API

### POST /api/profiles/resolve

Manually resolve a profile by canonical URL.

**Request:**
```json
{
  "canonicalUrl": "http://fhir.de/StructureDefinition/Patient-de-basis",
  "version": "1.0.0"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "url": "http://fhir.de/StructureDefinition/Patient-de-basis",
    "version": "1.0.0",
    "name": "Patient-de-basis",
    "title": "Patient German Base Profile",
    "description": "...",
    "kind": "resource",
    "type": "Patient",
    "baseDefinition": "http://hl7.org/fhir/StructureDefinition/Patient"
  },
  "source": "cache",
  "dependencies": [
    "http://hl7.org/fhir/StructureDefinition/Patient"
  ]
}
```

---

## German Profile Auto-Detection

### Supported Profiles

**MII (Medizininformatik-Initiative):**
- Patient, Observation, Condition, Procedure, Medication, etc.
- Pattern: `https://www.medizininformatik-initiative.de/fhir/core/modul-*/StructureDefinition/*`

**ISiK (Informationstechnische Systeme im Krankenhaus):**
- Patient, Encounter, Coverage, etc.
- Pattern: `https://gematik.de/fhir/isik/*/StructureDefinition/*`

**KBV (Kassenärztliche Bundesvereinigung):**
- Patient, Practitioner, Organization, etc.
- Pattern: `https://fhir.kbv.de/StructureDefinition/*`

**HL7 Germany Base:**
- Various base profiles
- Pattern: `http://fhir.de/StructureDefinition/*`

### Auto-Detection Flow

```
Resource has profile URL
        ↓
Check if matches German pattern
        ↓
   Match? ──Yes──> Auto-download from Simplifier
        │
        No
        ↓
Use standard resolution
```

---

## Profile Preloading

### Automatic Preloading

**Enable in `.env`:**
```bash
ENABLE_PROFILE_PRELOADING=true
PROFILE_PRELOAD_ON_STARTUP=true
PRELOAD_GERMAN_PROFILES=true
```

**18+ Profiles Preloaded:**
- MII Patient, Observation, Condition, Procedure, Medication
- ISiK Patient, Encounter, Coverage
- KBV Patient, Practitioner, Organization
- HL7 Germany base profiles

**Benefit:** 90% faster cold start validation

### Manual Preloading

**Trigger via API:**
```bash
POST /api/performance/profiles/preload
```

**Response:**
```json
{
  "success": true,
  "profilesPreloaded": 18,
  "totalTimeMs": 12500,
  "avgTimePerProfile": 694,
  "profiles": [
    "http://fhir.de/StructureDefinition/Patient-de-basis",
    ...
  ]
}
```

### Custom Profile Preloading

**Add custom profiles:**
```bash
CUSTOM_PROFILES_TO_PRELOAD="http://myorg.com/fhir/StructureDefinition/MyPatient,http://myorg.com/fhir/StructureDefinition/MyObservation"
```

**Or via API:**
```bash
POST /api/performance/profiles/preload-custom
{
  "profiles": [
    "http://myorg.com/fhir/StructureDefinition/MyPatient"
  ]
}
```

---

## Dependency Resolution

### Automatic Dependency Graph

The system automatically resolves profile dependencies:

```
MyPatient
  ├─ depends on: Patient (HL7 base)
  │   └─ depends on: DomainResource
  │       └─ depends on: Resource
  └─ depends on: Extension-birthplace
      └─ depends on: Extension
```

**All dependencies automatically downloaded!**

### Dependency Resolution Algorithm

1. Parse profile StructureDefinition
2. Extract `baseDefinition` URL
3. Extract all extension URLs
4. Recursively resolve each dependency
5. Download in correct order (leaf-first)
6. Cache all profiles

**Prevents:** "Profile not found" errors due to missing dependencies

---

## Version Management

### Semantic Versioning

Supports semantic version resolution:

**Version syntax:**
- Exact: `1.0.0`
- Range: `^1.0.0` (compatible with 1.x.x)
- Latest: `latest` or omit version

**Examples:**
```
http://example.com/profile|1.0.0        # Exact version
http://example.com/profile|^1.0.0       # Compatible version
http://example.com/profile               # Latest version
```

### Version Resolution

```bash
POST /api/profiles/resolve
{
  "canonicalUrl": "http://fhir.de/StructureDefinition/Patient-de-basis",
  "version": "^1.0.0"
}
```

**Resolver finds best matching version:**
- Available: 1.0.0, 1.0.1, 1.1.0, 2.0.0
- Requested: ^1.0.0
- **Selected: 1.1.0** (latest compatible)

---

## Profile Cache

### Three-Layer Caching

**L1 (Memory):**
- LRU cache
- 30-minute TTL
- Fast access (1-5ms)

**L2 (Database):**
- Persistent storage
- Profile metadata indexed
- Version-aware queries

**L3 (Filesystem):**
- IG package `.tgz` files
- Extracted StructureDefinitions
- Permanent storage

### Cache Management

**Check cache status:**
```bash
GET /api/performance/profiles/preload-status
```

**Clear cache:**
```bash
DELETE /api/cache/clear
```

**Warm cache:**
```bash
POST /api/performance/profiles/preload
```

---

## Profile Metadata

### Extracted Metadata

For each profile, the system extracts:

- **url:** Canonical URL
- **version:** Version string
- **name:** Computer-friendly name
- **title:** Human-friendly title
- **description:** Purpose and usage
- **kind:** resource | complex-type | primitive-type
- **type:** Resource type (Patient, Observation, etc.)
- **baseDefinition:** Parent profile URL
- **derivation:** specialization | constraint
- **dependencies:** List of dependent profiles
- **elements:** Defined elements and constraints

**Storage:** `profile_cache` table in database

### Querying Profile Metadata

```bash
GET /api/profiles/search?type=Patient
GET /api/profiles/search?name=Patient-de-basis
GET /api/profiles/:id/metadata
```

---

## Profile Notifications

### UI Notifications

When profiles are auto-downloaded, users see:

```
🔔 Profile Downloaded
German Patient profile (Patient-de-basis v1.0.0) 
downloaded from Simplifier
```

**Toast notification with:**
- Profile name
- Version
- Source (Simplifier)
- Download time

### Notification Settings

**Enable/disable:**
```bash
# In UI: Settings → Notifications
# Or via API:
PUT /api/user-preferences
{
  "notifications": {
    "profileDownloads": true
  }
}
```

---

## Troubleshooting

### Profile Not Found

**Issue:** "Profile http://example.com/profile not found"

**Solutions:**

1. **Check Simplifier:**
```bash
curl https://simplifier.net/api/fhir/StructureDefinition?url=http://example.com/profile
```

2. **Manually download:**
```bash
POST /api/profiles/resolve
{
  "canonicalUrl": "http://example.com/profile"
}
```

3. **Check network connectivity:**
```bash
curl -I https://simplifier.net
```

4. **Enable profile preloading:**
```bash
ENABLE_PROFILE_PRELOADING=true
```

### Dependency Resolution Failing

**Issue:** "Could not resolve profile dependencies"

**Solutions:**

1. **Check Simplifier API:**
```bash
curl https://simplifier.net/api/fhir/StructureDefinition
```

2. **Download dependencies manually:**
```bash
# Download each dependency separately
POST /api/profiles/resolve
{
  "canonicalUrl": "http://base-profile-url"
}
```

3. **Check logs:**
```bash
tail -f logs/server.log | grep ProfileResolver
```

### Slow Profile Download

**Issue:** First validation very slow (>10s)

**Solutions:**

1. **Enable preloading:**
```bash
ENABLE_PROFILE_PRELOADING=true
PROFILE_PRELOAD_ON_STARTUP=true
```

2. **Preload common profiles:**
```bash
POST /api/performance/profiles/preload
```

3. **Cache profiles locally:**
- Profiles cached after first download
- Subsequent uses are instant

---

## Configuration

### Profile Resolution Settings

```bash
# Enable profile preloading
ENABLE_PROFILE_PRELOADING=true
PROFILE_PRELOAD_ON_STARTUP=true

# German profiles
PRELOAD_GERMAN_PROFILES=true

# Custom profiles
CUSTOM_PROFILES_TO_PRELOAD=http://myorg.com/profile1,http://myorg.com/profile2

# Cache settings
PROFILE_CACHE_SIZE=2000
PROFILE_CACHE_TTL=1800000  # 30 minutes

# Simplifier API
SIMPLIFIER_API_URL=https://simplifier.net/api
SIMPLIFIER_TIMEOUT=10000  # 10 seconds
```

---

## Best Practices

### Profile Management

✅ **Enable preloading** - 90% faster cold start  
✅ **Preload common profiles** - German profiles if applicable  
✅ **Monitor downloads** - Check UI notifications  
✅ **Cache aggressively** - Long TTL for stable profiles  
✅ **Version explicitly** - Specify versions in meta.profile  

### Performance

✅ **Preload at startup** - One-time cost, huge benefit  
✅ **Use profile cache** - Don't download repeatedly  
✅ **Batch downloads** - Resolve dependencies together  
✅ **Monitor metrics** - Check preload stats  

### Troubleshooting

✅ **Check Simplifier first** - Verify profile exists  
✅ **Monitor notifications** - See what's downloading  
✅ **Review logs** - Check for resolution errors  
✅ **Clear cache if needed** - Force re-download  

---

## Related Documentation

- [Profile Preloading Guide](../performance/profile-preloading-guide.md) - Performance optimization
- [Configuration Guide](./CONFIGURATION_GUIDE.md) - All settings
- [Architecture Guide](../architecture/VALIDATION_ENGINE_ARCHITECTURE.md) - System design

---

## Summary

The Profile Resolution System:

✅ **Automatic profile discovery** from canonical URLs  
✅ **Dependency resolution** with graph traversal  
✅ **Version management** with semantic versioning  
✅ **German profile support** (MII, ISiK, KBV)  
✅ **Three-layer caching** for performance  
✅ **UI notifications** for transparency  
✅ **90% faster** cold start with preloading  

**Seamless profile management for FHIR validation!** 📦✨

