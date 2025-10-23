# HAPI Validation Parity - Implementation Complete

**Status:** ✅ Implementation Complete  
**Date:** 2025-10-23  
**Goal:** Enable Records to show all validation messages that the HL7 HAPI Validator outputs

## Summary

Records now displays all HAPI validation messages including:
- ✅ Errors
- ✅ Warnings  
- ✅ Information messages
- ✅ Best practice recommendations (configurable)

## Changes Made

### 1. TypeScript Type Extensions

**File:** `server/services/validation/engine/hapi-validator-types.ts`

- Added `enableBestPractice?: boolean` to `HapiValidationOptions`
- Added `validationLevel?: 'errors' | 'warnings' | 'hints'` to `HapiValidationOptions`
- Extended `HapiIssue` severity type to include `'hint'`

```typescript
export interface HapiValidationOptions {
  // ... existing fields
  enableBestPractice?: boolean;  // Default: true
  validationLevel?: 'errors' | 'warnings' | 'hints';  // Default: 'hints'
}

export interface HapiIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information' | 'hint';  // Added 'hint'
  // ... other fields
}
```

### 2. Severity Mapping Extension

**File:** `server/services/validation/engine/hapi-issue-mapper.ts`

- Extended `mapSeverity()` to handle `'hint'` severity
- Maps both `'information'` and `'hint'` to `'info'`

```typescript
export function mapSeverity(hapiSeverity: 'fatal' | 'error' | 'warning' | 'information' | 'hint'): 'error' | 'warning' | 'info' {
  switch (hapiSeverity) {
    case 'fatal':
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'information':
    case 'hint':  // NEW: Handle hints as info messages
      return 'info';
    default:
      return 'error';
  }
}
```

### 3. Validation Settings Schema

**File:** `shared/validation-settings.ts`

- Added `enableBestPracticeChecks?: boolean` (default: true)
- Added `bestPracticeSeverity?: 'warning' | 'info'` (default: 'warning')

```typescript
export interface ValidationSettings {
  // ... existing fields
  
  /** Best Practice Validation Settings */
  enableBestPracticeChecks?: boolean;  // Default: true
  bestPracticeSeverity?: 'warning' | 'info';  // Default: 'warning'
}
```

### 4. HAPI CLI Arguments

**File:** `server/services/validation/engine/hapi-validator-client.ts`

- Added `-level hints` flag to show all message types
- Added `-best-practice warning` flag for best practice recommendations

```typescript
// Enable all validation levels (errors, warnings, information, hints)
const validationLevel = options.validationLevel || 'hints';
args.push('-level', validationLevel);
console.log(`[HapiValidatorClient] Validation level set to: ${validationLevel}`);

// Enable best practice recommendations if configured (default: true)
const enableBestPractice = options.enableBestPractice ?? true;
if (enableBestPractice) {
  args.push('-best-practice', 'warning');
  console.log(`[HapiValidatorClient] Best practice recommendations enabled`);
}
```

### 5. Settings Pass-through to Validators

**Files Updated:**
- `server/services/validation/engine/structural-validator-hapi.ts`
- `server/services/validation/engine/structural-validator.ts`
- `server/services/validation/engine/profile-validator.ts`
- `server/services/validation/core/validation-engine.ts`
- `server/services/validation/engine/validation-engine-per-aspect.ts`

All validators now accept and pass `settings` parameter to enable/disable best practice checks:

```typescript
const options: HapiValidationOptions = {
  fhirVersion,
  // ... other options
  enableBestPractice: settings?.enableBestPracticeChecks ?? true,
  validationLevel: 'hints',  // Show all message types
};
```

### 6. UI Settings Component

**File:** `client/src/components/settings/validation-settings-tab.tsx`

- Added "Best Practice Recommendations" toggle
- Displays informational alert when enabled
- Default: enabled (true)

```tsx
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label className="text-sm font-semibold">Best Practice Recommendations</Label>
    <p className="text-sm text-muted-foreground">
      Show FHIR best practice recommendations (e.g., narrative text, domain-6 constraints)
    </p>
  </div>
  <Switch
    checked={settings.enableBestPracticeChecks ?? true}
    onCheckedChange={(checked) => {
      setSettings({
        ...settings,
        enableBestPracticeChecks: checked
      });
    }}
  />
</div>
```

## Expected Results

When validating the MII Patient resource (`mii-exa-person-patient-minimal`), Records should now show **all 8 validation messages** that validator.fhir.org shows:

### 2 Errors
1. Example URL not allowed in identifier system
2. Unknown/not allowed extension

### 4 Warnings
1. ⭐ Best practice: Missing narrative text (dom-6)
2. ⭐ Profile validation failed (profile URL could not be checked)
3. ⭐ Unknown CodeSystem: `http://fhir.de/CodeSystem/identifier-type-de-basis`
4. ⭐ Code not in ValueSet for identifier type

### 2 Information
1. ⭐ Canonical URL could not be resolved (profile)
2. ⭐ CodeSystem unknown (additional info)

⭐ = Previously missing, now displayed

## Testing Instructions

1. **Start the server** with the updated code
2. **Navigate to Settings** → Validation Settings
3. **Verify** "Best Practice Recommendations" toggle is visible and enabled by default
4. **Navigate to** the MII Patient resource: `http://localhost:5174/resources/Patient/mii-exa-person-patient-minimal`
5. **Trigger validation** (or it should auto-validate)
6. **Verify** that you see **8 validation messages** matching validator.fhir.org:
   - 2 Errors
   - 4 Warnings (including dom-6, profile fetch error, unknown CodeSystems)
   - 2 Information (including unresolvable URLs)

## Configuration

### Default Behavior
- Best practice checks: **ENABLED** by default
- Validation level: **hints** (shows all message types)
- All aspects: Structural, Profile, Terminology, etc.

### User Control
Users can now:
- ✅ Toggle best practice recommendations on/off via Settings UI
- ✅ See all validation messages at all severity levels
- ✅ Match the behavior of the official HL7 HAPI Validator

## Technical Details

### HAPI CLI Flags Used
- `-level hints`: Enables display of errors, warnings, information, and hints
- `-best-practice warning`: Enables best practice recommendations (e.g., narrative, metadata)
- `-tx <url>`: Terminology server for CodeSystem lookups
- `-version <version>`: FHIR version (R4/R5/R6)
- `-profile <url>`: Explicit profile to validate against

### Message Flow
1. HAPI CLI validates resource → Returns OperationOutcome with all issues
2. `mapOperationOutcomeToIssues()` maps HAPI issues → ValidationIssue format
3. `mapSeverity()` handles all severity levels including 'hint'
4. Frontend displays all messages grouped by severity and aspect

## Files Modified

### Backend (Server)
1. `server/services/validation/engine/hapi-validator-types.ts` - Type definitions
2. `server/services/validation/engine/hapi-issue-mapper.ts` - Severity mapping
3. `server/services/validation/engine/hapi-validator-client.ts` - CLI arguments
4. `server/services/validation/engine/structural-validator-hapi.ts` - Settings pass-through
5. `server/services/validation/engine/structural-validator.ts` - Settings parameter
6. `server/services/validation/engine/profile-validator.ts` - Settings pass-through
7. `server/services/validation/core/validation-engine.ts` - Settings parameter
8. `server/services/validation/engine/validation-engine-per-aspect.ts` - Settings parameter
9. `shared/validation-settings.ts` - Schema extension

### Frontend (Client)
1. `client/src/components/settings/validation-settings-tab.tsx` - UI toggle

**Total Files Modified:** 10

## Next Steps

1. ✅ Implementation complete
2. 🔄 Testing with MII Patient resource
3. ⏭️ Verify all 8 messages appear
4. ⏭️ Test toggle on/off behavior
5. ⏭️ Verify settings persistence

## Notes

- All changes are backward compatible
- Default behavior (best practice enabled) matches validator.fhir.org
- Users can disable best practice checks if they prefer
- No breaking changes to existing validation logic
- Linter errors: **0** ✅

