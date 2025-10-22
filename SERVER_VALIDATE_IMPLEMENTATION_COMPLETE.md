# Server-Based Profile Validation Implementation Complete

## Overview
Implemented support for using FHIR server's `$validate` operation for profile validation when `profile.engine = 'server'` is configured in validation settings.

## Changes Made

### 1. ProfileValidator Enhanced (`server/services/validation/engine/profile-validator.ts`)

**Added Features:**
- Support for `profile.engine` setting: `'hapi'`, `'server'`, or `'auto'`
- New `validateWithServer()` method that calls FhirClient.validateResourceDirect()
- New `mapOperationOutcomeToIssues()` method to convert FHIR OperationOutcome to ValidationIssue[]
- FhirClient dependency injected via constructor
- Engine selection logic in `validateAgainstProfile()` method

**Key Methods:**

```typescript
private async validateWithServer(
  resource: any,
  profileUrl: string
): Promise<ValidationIssue[]>
```
- Calls FHIR server's `$validate` operation with profile URL
- Returns ValidationIssue[] array

```typescript
private mapOperationOutcomeToIssues(
  outcome: FhirOperationOutcome
): ValidationIssue[]
```
- Maps FHIR OperationOutcome.issue[] to ValidationIssue[]
- Converts severity: 'fatal'|'error' → 'error', 'warning' → 'warning', 'info' → 'info'
- Extracts path from expression or location
- Uses diagnostics or details.text as message

### 2. Engine Selection Logic

**In `validateAgainstProfile()` method:**

```typescript
const engine = settings?.aspects?.profile?.engine || 'hapi';

if (engine === 'server' || engine === 'auto') {
  try {
    return await this.validateWithServer(resource, profileUrl);
  } catch (error) {
    if (engine === 'server') throw error;
    // Fall through to HAPI for 'auto' mode
  }
}

// Use HAPI validation (existing logic)
```

**Behavior:**
- `engine === 'server'`: Uses FHIR server $validate exclusively, fails if server unavailable
- `engine === 'hapi'`: Uses HAPI validator (existing behavior)
- `engine === 'auto'`: Tries server first, falls back to HAPI on failure

## Configuration

### Enable Server Validation

Users can enable server-based validation by updating validation settings:

```typescript
{
  aspects: {
    profile: {
      enabled: true,
      severity: 'error',
      engine: 'server'  // Use FHIR server $validate
    }
  }
}
```

### Environment Configuration

The Firely server URL is configured in `server/config/fhir-validation.env.ts`:

```typescript
firelyServerUrl: process.env.FHIR_FIRELY_SERVER_URL || 'https://server.fire.ly'
```

Can be overridden with environment variable:
```bash
FHIR_FIRELY_SERVER_URL=http://localhost:8080/fhir
```

## Use Cases

### 1. MII Profile Validation
When you have installed MII and ISiK profiles on your Firely server:
- Set `profile.engine = 'server'`
- System will use Firely's $validate with the installed profiles
- Should detect cardinality/slice constraints better than HAPI with local packages

### 2. Custom IG Packages
If you have custom IG packages installed on your FHIR server:
- Use server validation to leverage server's installed profiles
- Avoids need to distribute IG packages to all clients

### 3. Hybrid Mode
Use `engine = 'auto'` for best of both worlds:
- Tries server first (if available and has the profile)
- Falls back to HAPI if server fails or is unavailable
- Provides resilience

## Benefits

1. **Leverage Server-Side Profiles**: Use profiles installed on Firely server (MII, ISiK, etc.)
2. **Better Slice Validation**: Firely may detect cardinality/slice issues HAPI misses
3. **Centralized Profile Management**: Profiles managed on server, not distributed to clients
4. **Flexibility**: Choose between server, HAPI, or auto mode
5. **No Breaking Changes**: Existing HAPI validation continues to work (default)

## Testing

### Test with MII Patient Resources

1. Set validation settings:
```typescript
{
  aspects: {
    profile: {
      enabled: true,
      severity: 'error',
      engine: 'server'
    }
  }
}
```

2. Validate a Patient resource declaring MII profile:
```json
{
  "resourceType": "Patient",
  "meta": {
    "profile": [
      "https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient"
    ]
  },
  ...
}
```

3. Check validation results for cardinality/slice constraint violations

### Expected Behavior

- Server validation should report missing required slices
- Should detect exceeded cardinality constraints
- Should report slice mismatches
- Validation messages should come from Firely's OperationOutcome

## Compatibility

- Works with any FHIR server supporting `$validate` operation
- Default configuration uses `https://server.fire.ly`
- Can be configured to use local FHIR server
- Requires FHIR R4+ server

## Files Modified

1. `server/services/validation/engine/profile-validator.ts`
   - Added FhirClient import
   - Added constructor to initialize FhirClient
   - Added validateWithServer() method
   - Added mapOperationOutcomeToIssues() method
   - Modified validateAgainstProfile() to support engine selection
   - Updated file header documentation

## Implementation Status

✅ Engine selection logic implemented
✅ validateWithServer() method added
✅ OperationOutcome mapping implemented
✅ FhirClient dependency injected
✅ Documentation updated
✅ Ready for testing with MII Patient resources

## Next Steps

Users can now:
1. Configure `profile.engine = 'server'` in validation settings
2. Validate MII Patient resources against Firely server
3. Compare results with HAPI validation
4. Determine which validator provides better slice/cardinality checking

## Notes

- Base FHIR profiles still use fast validation (bypass server/HAPI)
- Custom profiles (MII, KBV, US Core, etc.) use configured engine
- Firely server URL defaults to public instance but can be configured
- OperationOutcome issues are mapped to ValidationIssue format for consistency

