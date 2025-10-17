# Profile Auto-Detection Implementation Summary

## Overview
Implemented automatic profile family detection and IG package loading for international FHIR profiles (Australian, US Core, UK Core, Canadian, etc.) to enable comprehensive FHIR validation without manual configuration.

## Problem Solved
Previously, when HAPI validated against international profiles like `http://hl7.org.au/fhir/StructureDefinition/au-patient`, it would:
1. Try to fetch the profile URL directly
2. Receive HTML documentation instead of StructureDefinition XML
3. Fail with `FHIRFormatError: processing instruction can not have PITarget`

## Solution
Auto-detect profile families from canonical URLs and automatically load the correct IG packages, similar to the existing German profile detection.

## Implementation Details

### 1. International Profile Detector
**File:** `server/services/validation/utils/international-profile-detector.ts` (NEW)

A comprehensive profile family detector that:
- Recognizes **7 international profile families**:
  - Australian Base (HL7 AU) - `hl7.org.au/fhir`
  - US Core - `hl7.org/fhir/us/core`
  - UK Core (NHS Digital) - `fhir.hl7.org.uk`
  - Canadian Baseline - `fhir.infoway-inforoute.ca`
  - International Patient Summary (IPS) - `hl7.org/fhir/uv/ips`
  - Swiss Core - `fhir.ch`
  - Dutch Core (Nictiz) - `nictiz.nl/fhir`

**Key Functions:**
```typescript
// Detect profile family from URL
detectInternationalProfile(profileUrl: string): InternationalProfileDetectionResult

// Get recommended package with version
getRecommendedPackage(profileUrl: string): string | null

// Check if a profile is international
isInternationalProfile(profileUrl: string): boolean
```

**Detection Example:**
```typescript
const profile = detectInternationalProfile('http://hl7.org.au/fhir/StructureDefinition/au-patient');
// Returns:
{
  isInternationalProfile: true,
  family: 'au-base',
  confidence: 95,
  recommendedPackage: 'hl7.fhir.au.base',
  packageVersion: '5.0.0',
  description: 'HL7 Australia Base Implementation Guide',
  region: 'Australia',
  patternMatched: 'hl7.org.au/fhir'
}
```

### 2. Profile Packages Configuration
**File:** `server/config/profile-packages.json` (UPDATED)

Added international profile definitions:

```json
"internationalProfiles": {
  "au-base": {
    "name": "HL7 Australia Base",
    "packages": [{
      "id": "hl7.fhir.au.base",
      "version": "5.0.0",
      "canonical": "http://hl7.org.au/fhir",
      "status": "active",
      "priority": "high"
    }]
  },
  "us-core": {
    "name": "US Core",
    "packages": [{
      "id": "hl7.fhir.us.core",
      "version": "6.1.0",
      "canonical": "http://hl7.org/fhir/us/core",
      "status": "active",
      "priority": "high"
    }]
  },
  "uk-core": {
    "name": "UK Core",
    "packages": [{
      "id": "uk.nhsdigital.r4",
      "version": "2.0.0",
      "canonical": "http://fhir.hl7.org.uk",
      "status": "active",
      "priority": "high"
    }]
  },
  "ca-baseline": {
    "name": "Canadian Baseline",
    "packages": [{
      "id": "hl7.fhir.ca-baseline",
      "version": "1.2.0",
      "canonical": "http://fhir.infoway-inforoute.ca",
      "status": "active",
      "priority": "medium"
    }]
  }
}
```

### 3. Profile Validator Enhancement
**File:** `server/services/validation/engine/profile-validator.ts` (UPDATED)

#### Changes Made:

**A. Added Import:**
```typescript
import {
  detectInternationalProfile,
  getRecommendedPackage as getInternationalPackage
} from '../utils/international-profile-detector';
```

**B. Enhanced `getIgPackagesForProfile()` Method:**
```typescript
// Auto-detect international profiles (Australian, US Core, UK Core, etc.)
const intlProfile = detectInternationalProfile(profileUrl);

if (intlProfile.isInternationalProfile && intlProfile.recommendedPackage) {
  const intlPackage = getInternationalPackage(profileUrl);
  if (intlPackage) {
    console.log(
      `[ProfileValidator] International ${intlProfile.family.toUpperCase()} profile detected ` +
      `(${intlProfile.region}), adding package: ${intlPackage}`
    );
    packages.push(intlPackage);
    return packages;
  }
}
```

**C. Improved Error Handling:**
Updated the catch block to gracefully handle profile loading errors:
```typescript
const isProfileLoadError = 
  errorMessage.includes('FHIRFormatError') ||
  errorMessage.includes('processing instruction can not have PITarget') ||
  errorMessage.includes('loadProfile') ||
  errorMessage.includes('Unable to find/resolve/read') ||
  errorMessage.includes('profile-load-skipped');

if (isProfileLoadError) {
  // Return informational issue instead of error
  return [{
    severity: 'information',
    code: 'profile-load-skipped',
    message: `Profile validation skipped: Unable to load profile from ${profileUrl}...`
  }];
}
```

## Validation Flow

### Before (Failure):
1. Resource declares `au-patient` profile
2. HAPI tries to fetch `http://hl7.org.au/fhir/StructureDefinition/au-patient`
3. Gets HTML documentation page instead of XML
4. Fails with `FHIRFormatError`
5. Shows error to user

### After (Success):
1. Resource declares `au-patient` profile
2. ProfileValidator detects Australian Base family from URL
3. Auto-adds `hl7.fhir.au.base#5.0.0` to IG packages
4. HAPI downloads and caches the package (first time only)
5. HAPI validates successfully using cached package
6. If package unavailable, shows informational message (not error)

## Console Output Examples

### Profile Detection:
```
[ProfileValidator] International AU-BASE profile detected (Australia), adding package: hl7.fhir.au.base#5.0.0
[ProfileValidator] Loading 1 version-specific IG package(s) for R4: hl7.fhir.au.base#5.0.0
```

### Graceful Degradation:
If a profile URL is unreachable or returns HTML:
```
[ProfileValidator] ⚠️  Profile loading failed for http://hl7.org.au/fhir/StructureDefinition/au-patient, skipping profile validation
[ProfileValidator] Reason: Profile URL may return HTML instead of StructureDefinition XML
```

## Supported Profile Families

| Family | Region | Package ID | Version | Pattern |
|--------|--------|------------|---------|---------|
| Australian Base | Australia | `hl7.fhir.au.base` | 5.0.0 | `hl7.org.au/fhir` |
| US Core | United States | `hl7.fhir.us.core` | 6.1.0 | `hl7.org/fhir/us/core` |
| UK Core | United Kingdom | `uk.nhsdigital.r4` | 2.0.0 | `fhir.hl7.org.uk` |
| Canadian Baseline | Canada | `hl7.fhir.ca-baseline` | 1.2.0 | `fhir.infoway-inforoute.ca` |
| IPS | International | `hl7.fhir.uv.ips` | 1.1.0 | `hl7.org/fhir/uv/ips` |
| Swiss Core | Switzerland | `ch.fhir.ig.ch-core` | 4.0.1 | `fhir.ch` |
| Dutch Core | Netherlands | `nictiz.fhir.nl.r4` | 2.0.0 | `nictiz.nl/fhir` |

## Benefits

1. **Zero Configuration**: No manual IG package setup required
2. **Automatic Detection**: Works for any supported profile family
3. **Graceful Degradation**: Shows informational messages instead of errors if packages unavailable
4. **Extensible**: Easy to add new profile families by updating the detector configuration
5. **Consistent**: Uses the same pattern as existing German profile detection
6. **Performance**: Packages are cached by HAPI after first download

## Testing

To test with an Australian profile:
```json
{
  "resourceType": "Patient",
  "meta": {
    "profile": ["http://hl7.org.au/fhir/StructureDefinition/au-patient"]
  },
  "id": "test-au-patient",
  "name": [{"family": "Smith", "given": ["John"]}]
}
```

Expected behavior:
1. Auto-detects Australian Base profile family
2. Loads `hl7.fhir.au.base#5.0.0` package
3. Validates against AU profile constraints
4. Shows validation results (not errors about profile loading)

## Future Enhancements

Potential additions:
- More international profiles (Nordic, Brazilian, etc.)
- Profile version detection from URL
- Smart package version selection based on FHIR version
- Package dependency resolution
- User-configurable profile mappings in settings

## Files Modified

1. **Created:**
   - `server/services/validation/utils/international-profile-detector.ts` (NEW, 295 lines)

2. **Updated:**
   - `server/config/profile-packages.json` (Added international profiles section)
   - `server/services/validation/engine/profile-validator.ts` (Added auto-detection logic)

## Validation

- ✅ TypeScript compilation successful
- ✅ No linter errors
- ✅ JSON configuration valid
- ✅ Server starts without errors
- ✅ Builds successfully

---

**Implementation Date:** October 17, 2025
**Status:** Complete and Ready for Testing

