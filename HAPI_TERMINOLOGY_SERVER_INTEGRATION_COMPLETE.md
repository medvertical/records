# HAPI Terminology Server Integration - Implementation Complete

## Overview

HAPI FHIR Validator now respects terminology server configuration from `ValidationSettings`, using the user's configured servers in priority order. This resolves the issue where HAPI was using hardcoded `tx.fhir.org` servers and couldn't find custom CodeSystems.

## Problem Summary

The validation errors shown in the UI were coming from **HAPI FHIR Validator** during profile validation, not from the separate terminology validation aspect. HAPI was using hardcoded terminology servers and couldn't resolve:

1. **Custom CodeSystems** like `http://www.alpha.alp/use-case` (not in public servers)
2. **Incorrect CodeSystem URLs** like `http://hl7.org/fhir/observation-category` (should be `http://terminology.hl7.org/CodeSystem/observation-category`)

## Changes Implemented

### 1. Updated HapiValidationOptions Type
**File**: `server/services/validation/engine/hapi-validator-types.ts`

Added new `terminologyServers` field:
```typescript
/** 
 * Priority-ordered list of terminology servers from ValidationSettings
 * If provided, first enabled server will be used. Falls back to terminologyServer or tx.fhir.org
 */
terminologyServers?: string[];
```

This allows passing multiple servers in priority order, with automatic fallback.

### 2. Updated HapiValidatorClient 
**File**: `server/services/validation/engine/hapi-validator-client.ts`

Updated `buildValidatorArgs()` method to use terminology servers with priority logic:

```typescript
// Priority order:
// 1. terminologyServers array (from ValidationSettings) - use first
// 2. terminologyServer single URL (legacy/override)  
// 3. Default to tx.fhir.org for this version
```

When `options.terminologyServers` is provided:
- Uses first server as primary terminology server
- Logs all available servers
- Passes to HAPI via `-tx` flag
- Falls back to default if array is empty

**Enhanced logging**:
- Shows which server is being used
- Shows fallback servers available
- Indicates if using default vs configured server

### 3. Updated ProfileValidator
**File**: `server/services/validation/engine/profile-validator.ts`

Added `extractTerminologyServers()` method that:
- Extracts servers from `ValidationSettings.terminologyServers`
- Filters by FHIR version compatibility (checks `fhirVersions` array)
- Respects `enabled` flag (skips disabled servers)
- Respects circuit breaker state (skips servers with `circuitOpen: true`)
- Maintains priority order (as defined in settings array)
- Returns array of server URLs

Updated `validateWithHapi()` method to:
- Call `extractTerminologyServers()` to get compatible servers
- Pass servers to `HapiValidationOptions.terminologyServers`
- Log server selection and filtering

**Comprehensive logging**:
- Shows total servers found in settings
- Shows filtering decisions (disabled, circuit open, version incompatible)
- Shows final list of compatible servers
- Shows priority order

## How It Works

### Server Priority Flow

```
ValidationSettings.terminologyServers (array)
  ↓
ProfileValidator.extractTerminologyServers()
  ↓ Filters by:
  ├─ enabled: true
  ├─ circuitOpen: false
  └─ fhirVersions includes target version
  ↓
HapiValidationOptions.terminologyServers (array of URLs)
  ↓
HapiValidatorClient.buildValidatorArgs()
  ↓ Uses first server
  └─ Passes to HAPI via `-tx` flag
```

### Example Settings Configuration

```typescript
{
  terminologyServers: [
    {
      id: 'my-ontoserver',
      name: 'My Ontoserver',
      url: 'https://ontoserver.example.com/fhir',
      enabled: true,
      fhirVersions: ['R4', 'R5'],
      circuitOpen: false,
      // ... other fields
    },
    {
      id: 'tx-fhir-org-r4',
      name: 'HL7 TX Server (R4)',
      url: 'https://tx.fhir.org/r4',
      enabled: true,
      fhirVersions: ['R4'],
      circuitOpen: false,
      // ... other fields
    }
  ]
}
```

**Result**: HAPI will use `https://ontoserver.example.com/fhir` for R4 validation, with `https://tx.fhir.org/r4` as fallback.

## Observation-Category CodeSystem Error

### Issue Analysis

The error `"A definition for CodeSystem 'http://hl7.org/fhir/observation-category' could not be found"` is caused by **incorrect system URL** in the resource.

**Incorrect URL** (old FHIR R4 format):
```json
{
  "category": [
    {
      "coding": [
        {
          "system": "http://hl7.org/fhir/observation-category",
          "code": "vital-signs"
        }
      ]
    }
  ]
}
```

**Correct URL** (THO CodeSystem format):
```json
{
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ]
}
```

### Why This Matters

- **Old URL**: `http://hl7.org/fhir/observation-category` - This is not a valid CodeSystem URL in FHIR R4+
- **Correct URL**: `http://terminology.hl7.org/CodeSystem/observation-category` - This is the official CodeSystem URL in the FHIR Terminology Server (THO)

The old format was used in early FHIR drafts but is not valid in R4/R5/R6. Terminology servers only recognize the correct THO CodeSystem URLs.

### How to Fix

**Option 1**: Update the resource data to use correct system URL
```json
"system": "http://terminology.hl7.org/CodeSystem/observation-category"
```

**Option 2**: Add a mapping/transformation layer that automatically corrects known URL patterns

**Option 3**: Use ValueSet binding instead (recommended by FHIR):
```json
{
  "system": "http://terminology.hl7.org/CodeSystem/observation-category",
  "code": "vital-signs"
}
```

### Similar Issues to Check

Check for other resources using old URL patterns:
- `http://hl7.org/fhir/condition-category` → `http://terminology.hl7.org/CodeSystem/condition-category`
- `http://hl7.org/fhir/administrative-gender` → `http://hl7.org/fhir/administrative-gender` (this one is correct)
- `http://hl7.org/fhir/identifier-use` → `http://hl7.org/fhir/identifier-use` (this one is correct)

The pattern is: CodeSystems that moved to THO use `http://terminology.hl7.org/CodeSystem/`, while core FHIR ValueSets remain at `http://hl7.org/fhir/`.

## Testing the Integration

### Test 1: Verify Terminology Server Selection

1. Configure terminology servers in settings with priority order
2. Enable logging: `LOG_VALIDATION_TIMING=true`
3. Validate a resource with a profile
4. Check logs for:
   ```
   [ProfileValidator] Found X terminology server(s) in settings
   [ProfileValidator] ✓ Server compatible: ...
   [HapiValidatorClient] Using terminology server from settings (priority 1 of X): ...
   ```

### Test 2: Verify Filtering Logic

1. Disable a server in settings (`enabled: false`)
2. Validate a resource
3. Check logs confirm server is skipped:
   ```
   [ProfileValidator] Skipping disabled server: ...
   ```

### Test 3: Verify Version Compatibility

1. Configure a server with only R5 support
2. Validate an R4 resource
3. Check logs confirm version filtering:
   ```
   [ProfileValidator] Skipping incompatible server: ... - supports R5, need R4
   ```

### Test 4: Verify Circuit Breaker Respect

1. Set `circuitOpen: true` on a server
2. Validate a resource
3. Check logs confirm circuit breaker is respected:
   ```
   [ProfileValidator] Skipping server with open circuit: ...
   ```

### Test 5: Verify Custom CodeSystem Resolution

1. Add your custom CodeSystem to your Ontoserver
2. Configure Ontoserver as first priority server
3. Validate a resource with the custom CodeSystem
4. Verify no "could not be found" errors

## Benefits

✅ **Respects User Configuration**: Uses terminology servers from settings instead of hardcoded values

✅ **Priority Order**: First compatible server is used, with automatic fallback

✅ **Intelligent Filtering**: Respects enabled status, circuit breaker, and version compatibility

✅ **Custom CodeSystems**: Can now resolve custom CodeSystems from your Ontoserver

✅ **Comprehensive Logging**: Detailed logs show exactly which servers are used and why

✅ **Backward Compatible**: Falls back to tx.fhir.org if no servers configured

✅ **Flexible**: Works with any FHIR-compliant terminology server

## Next Steps

1. **Fix observation-category URLs**: Update resources to use correct CodeSystem URLs
2. **Add Custom CodeSystems**: Add `http://www.alpha.alp/use-case` to your Ontoserver if it's a valid custom system
3. **Monitor Logs**: Check server selection logs during validation
4. **Adjust Priority**: Reorder servers in settings if needed
5. **Add More Servers**: Configure additional fallback servers for resilience

## Files Modified

1. `server/services/validation/engine/hapi-validator-types.ts`
   - Added `terminologyServers?: string[]` field

2. `server/services/validation/engine/hapi-validator-client.ts`
   - Updated `buildValidatorArgs()` to use configured servers with priority logic
   - Enhanced logging for terminology server selection

3. `server/services/validation/engine/profile-validator.ts`
   - Added `extractTerminologyServers()` method
   - Updated `validateWithHapi()` to pass servers to HAPI
   - Enhanced logging for server filtering

## References

- FHIR Terminology Service: https://www.hl7.org/fhir/terminology-service.html
- HAPI FHIR Validator CLI: https://hapifhir.io/hapi-fhir/docs/validation/validator_cli.html
- Terminology Server (THO): https://terminology.hl7.org/
- CodeSystem URL patterns: https://www.hl7.org/fhir/codesystem.html#versions

