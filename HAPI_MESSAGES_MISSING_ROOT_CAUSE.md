# HAPI Validation Messages Missing - Root Cause Analysis

## Problem
User reported "can't see HAPI validation messages" when viewing Patient/mii-exa-person-patient-full.

## Investigation

### Direct HAPI Test Results
Tested HAPI validator directly with the sample patient resource:

**HAPI returned 9 issues:**
- **Terminology (2 issues):**
  1. [error] Invalid displayLanguage error from tx.fhir.org
  2. [warning] Code not in ValueSet 'IdentifierType'

- **Structural (6 issues):**
  1. [error] Extension http://fhir.de/StructureDefinition/gender-amtlich-de not known/allowed
  2. [error] Extension http://fhir.de/StructureDefinition/destatis/ags not known/allowed
  3. [info] Canonical URL for profile cannot be resolved
  4. [info] CodeSystem http://fhir.de/CodeSystem/gender-amtlich-de unknown
  5. [info] CodeSystem http://fhir.de/sid/destatis/ags unknown
  6. [warning] Profile reference not checked (error fetching from MII server)

- **Profile (1 issue):**
  1. [warning] Constraint failed: dom-6 'A resource should have narrative' (Best Practice)

**Total: 3 errors + 3 warnings + 3 information**

### Current UI Display
The UI only shows **5 total issues**:
- metadata: 2 errors (timezone, versionId) - from schema validator, NOT HAPI
- terminology: 3 warnings (CodeSystem not found) - from HAPI

**Missing from UI:**
- ✗ Structural errors (2) about unknown extensions
- ✗ Structural warnings (1) about profile fetch error
- ✗ Structural info (3) about profile/CodeSystem resolution
- ✗ Profile warning (1) about missing narrative
- ✗ Terminology error (1) about displayLanguage

## Root Cause

**4 of 9 HAPI messages are missing** (or being filtered/not persisted):

1. **Information-level messages** might be filtered out somewhere in the pipeline
2. **Structural/Profile messages** from HAPI might not be getting associated with the correct aspect
3. **Some messages** might be deduplicated or filtered during persistence

## Next Steps

Need to check:
1. ✅ ValidationEnginePerAspect - check if it calls HAPI with `includeInformation: true`
2. ✅ Per-aspect persistence - check if `information` severity is handled
3. ✅ Settings - check if information messages are disabled by default
4. ✅ Issue mapper - check if all HAPI issues are correctly mapped to aspects

## Test Command

```bash
npx tsx test-hapi-direct.ts
```

This directly calls HAPI validator and shows all 9 issues that HAPI actually returns.

