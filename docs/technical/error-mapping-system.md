# Error Mapping System Documentation

**Version:** 1.0.0  
**Last Updated:** October 2025  
**Component:** FHIR Validation Engine - Error Translation System

---

## Overview

The Error Mapping System translates technical FHIR validation error codes into user-friendly messages with actionable suggested fixes. This system bridges the gap between technical validation output and user comprehension, making FHIR validation accessible to non-technical users.

### Key Features
- 📝 **User-Friendly Messages**: Technical codes → plain English
- 💡 **Suggested Fixes**: Actionable recommendations for each error
- 🔗 **Documentation Links**: Direct links to FHIR specification
- 🎯 **Context-Aware**: Variable substitution with resource context
- 🌐 **Multi-Aspect Support**: Coverage for all 6 validation aspects

---

## Architecture

```
ValidationIssue (Technical)
  ↓
ErrorMappingEngine.enhanceIssue()
  ├─ Load mapping from error-mappings.json
  ├─ Substitute context variables ({code}, {system}, etc.)
  └─ Generate suggested fixes
  ↓
EnhancedValidationIssue (User-Friendly)
  └─ Display in EnhancedValidationIssueCard component
```

---

## JSON Schema

### File Location
`/server/config/error-mappings.json`

### Schema Structure

```json
{
  "$schema": "error-mappings-schema.json",
  "version": "1.0.0",
  "lastUpdated": "2025-10-15",
  "description": "Error mapping dictionary",
  
  "mappings": {
    "{aspect}": {
      "{error-code}": {
        "userMessage": "User-friendly message with {variables}",
        "suggestedFixes": [
          "Actionable fix 1",
          "Actionable fix 2"
        ],
        "severity": "error|warning|info",
        "documentation": "https://hl7.org/fhir/..."
      }
    }
  }
}
```

### Field Definitions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userMessage` | string | ✅ Yes | User-friendly error message. Can include {variables} for context substitution |
| `suggestedFixes` | string[] | ✅ Yes | Array of actionable recommendations (3-5 suggestions) |
| `severity` | enum | ✅ Yes | Error severity: "error", "warning", or "info" |
| `documentation` | string | ❌ No | URL to FHIR specification or documentation |

### Context Variables

Variables available for substitution in `userMessage` and `suggestedFixes`:

| Variable | Description | Example |
|----------|-------------|---------|
| `{code}` | Code value | "male", "final", "active" |
| `{system}` | Code system URL | "http://hl7.org/fhir/administrative-gender" |
| `{valueSet}` | ValueSet URL | "http://hl7.org/fhir/ValueSet/observation-status" |
| `{path}` | Field path in resource | "gender", "status", "code.coding[0]" |
| `{resourceType}` | Resource type | "Patient", "Observation" |
| `{fhirVersion}` | FHIR version | "R4", "R5", "R6" |
| `{profileUrl}` | Profile canonical URL | "http://hl7.org/fhir/us/core/..." |
| `{expectedType}` | Expected data type | "string", "integer", "CodeableConcept" |
| `{actualType}` | Actual data type found | "number", "object" |

---

## Validation Aspects

The error mapping system covers all 6 validation aspects:

### 1. Structural Validation (`structural`)
Technical validation of FHIR resource structure and data types.

**Example Error Codes:**
- `structure-failed` - Resource doesn't match FHIR schema
- `invalid-datatype` - Field has wrong data type
- `cardinality-violation` - Too many/few elements
- `required-element-missing` - Missing required field

### 2. Profile Validation (`profile`)
Conformance to FHIR profiles and StructureDefinitions.

**Example Error Codes:**
- `profile-mismatch` - Resource doesn't conform to profile
- `constraint-failed` - Profile constraint (invariant) failed
- `extension-unknown` - Unknown or disallowed extension
- `profile-not-declared` - No profile in meta.profile

### 3. Terminology Validation (`terminology`)
Code validation against ValueSets and CodeSystems.

**Example Error Codes:**
- `code-unknown` - Code not found in system
- `code-not-in-valueset` - Code not in required ValueSet
- `valueset-expansion-failed` - Cannot expand ValueSet
- `binding-strength-violated` - Required binding not satisfied
- `invalid-display` - Display text doesn't match canonical

### 4. Reference Validation (`reference`)
Reference integrity and type checking.

**Example Error Codes:**
- `reference-not-found` - Referenced resource doesn't exist
- `reference-type-mismatch` - Wrong resource type referenced
- `circular-reference` - Circular reference detected

### 5. Business Rules (`businessRule`)
Custom FHIRPath and business logic validation.

**Example Error Codes:**
- `fhirpath-evaluation-failed` - FHIRPath expression error
- `rule-violation` - Custom business rule failed

### 6. Metadata Validation (`metadata`)
Resource metadata and provenance validation.

**Example Error Codes:**
- `meta-lastUpdated-invalid` - Invalid timestamp
- `meta-versionId-inconsistent` - Version ID mismatch
- `meta-security-invalid` - Invalid security label

### System Errors (`system`)
Infrastructure and connectivity errors.

**Example Error Codes:**
- `TIMEOUT` - Validation operation timed out
- `NETWORK_ERROR` - Cannot reach validation server
- `VALIDATION_ERROR` - Internal validation error

---

## Usage

### Backend: Enhancing Validation Issues

```typescript
import { getErrorMappingEngine } from './error-mapping-engine';

// Single issue
const engine = getErrorMappingEngine();
const enhanced = engine.enhanceIssue(issue, {
  resourceType: 'Patient',
  fhirVersion: 'R4',
  code: 'male',
  system: 'http://hl7.org/fhir/administrative-gender'
});

// Multiple issues
const enhancedIssues = engine.enhanceIssues(issues, context);
```

### Frontend: Displaying Enhanced Errors

```tsx
import { EnhancedValidationIssueCard } from './enhanced-validation-issue';

<EnhancedValidationIssueCard 
  issue={enhancedIssue}
  compact={false}
/>
```

### API: Retrieving Error Explanations

```bash
# Get specific error explanation
GET /api/validation/errors/code-unknown?aspect=terminology

# Response:
{
  "code": "code-unknown",
  "aspect": "terminology",
  "userMessage": "Code '{code}' is not found in code system '{system}'",
  "suggestedFixes": [...],
  "severity": "error",
  "documentation": "https://hl7.org/fhir/terminologies.html"
}
```

---

## Contributing Error Mappings

### Adding a New Error Mapping

1. **Identify the error code** from validation output
2. **Determine the aspect** (structural, profile, terminology, etc.)
3. **Write user-friendly message** with context variables
4. **Create 3-5 suggested fixes** (actionable, specific)
5. **Add documentation link** (FHIR spec URL if available)
6. **Add to error-mappings.json**

### Example Contribution

```json
"terminology": {
  "new-error-code": {
    "userMessage": "The code '{code}' has an issue with {context}",
    "suggestedFixes": [
      "First, try this specific action",
      "If that doesn't work, try this",
      "Common solution: do this",
      "Check documentation: {documentation}"
    ],
    "severity": "error",
    "documentation": "https://hl7.org/fhir/relevant-page.html"
  }
}
```

### Best Practices

#### ✅ Good User Messages
- **Clear and concise**: "Code 'xyz' is not found in system 'http://...'"
- **Context-rich**: Use variables to show specific values
- **Action-oriented**: Tell the user what's wrong, not just that something is wrong

#### ❌ Avoid
- **Technical jargon**: Don't use terms like "cardinality", "invariant" without explanation
- **Vague messages**: "Validation failed" (too generic)
- **Blame language**: "You entered an invalid code" (neutral tone)

#### ✅ Good Suggested Fixes
- **Specific actions**: "Add the required field 'gender' to the resource"
- **Step-by-step**: "1. Check spelling, 2. Verify system, 3. Use valid code"
- **Examples included**: "Example: \"gender\": \"male\""
- **Links to tools**: "Search for valid codes at: https://..."

#### ❌ Avoid
- **Vague suggestions**: "Fix the error" (not actionable)
- **Too technical**: "Modify the JSON schema validator configuration"
- **Too many fixes**: Limit to 3-5 most relevant

### Testing Your Contribution

```bash
# 1. Add mapping to error-mappings.json
# 2. Create test case
npm test -- error-mapping-engine.test.ts

# 3. Test in UI
npm run dev
# Navigate to resource with error, verify user message displays
```

---

## Examples

### Example 1: Terminology Error

**Technical Message:**
```
Code 'invalid-gender' not found in system 'http://hl7.org/fhir/administrative-gender'
```

**Enhanced Message:**
```
User Message:
  Code 'invalid-gender' is not found in code system 
  'http://hl7.org/fhir/administrative-gender'

Suggested Fixes:
  • Check the spelling of the code: 'invalid-gender'
  • Verify you're using the correct code system
  • Valid codes: male, female, other, unknown
  • Search for valid codes at: https://terminology.hl7.org

Documentation:
  https://hl7.org/fhir/terminologies.html
```

### Example 2: Profile Constraint

**Technical Message:**
```
Constraint 'pat-1' failed: Patient.contact SHALL have at least contact.telecom or contact.address
```

**Enhanced Message:**
```
User Message:
  Profile constraint 'pat-1' failed: Contact must have telecom or address

Suggested Fixes:
  • Add contact.telecom (phone, email, etc.)
  • Or add contact.address
  • At least one is required by this profile
  • Review profile constraints in documentation

Documentation:
  https://hl7.org/fhir/conformance-rules.html#constraints
```

### Example 3: Structural Error

**Technical Message:**
```
Element 'birthDate' has invalid type: found number, expected string
```

**Enhanced Message:**
```
User Message:
  Field 'birthDate' has an invalid data type. 
  Expected string, got number

Suggested Fixes:
  • Convert the value to string type
  • Use FHIR date format: YYYY-MM-DD
  • Example: "birthDate": "1990-01-15"
  • Check the FHIR specification for Patient.birthDate

Documentation:
  https://hl7.org/fhir/datatypes.html
```

---

## Maintenance

### Adding New Aspects

If you add a new validation aspect:

1. Create aspect section in `error-mappings.json`:
```json
"newAspect": {
  "error-code-1": { ... },
  "error-code-2": { ... }
}
```

2. Add aspect to `ValidationAspect` type in `@shared/validation-settings`

3. Add test cases in `error-mapping-engine.test.ts`

### Updating Existing Mappings

1. Edit `error-mappings.json`
2. Update `version` and `lastUpdated` fields
3. Run tests to ensure no regressions
4. Document changes in commit message

### Monitoring Coverage

Check which error codes are not mapped:

```typescript
// In validation-engine.ts
const enhanced = errorEngine.enhanceIssues(issues);
const unmapped = enhanced.filter(i => !i.mapped);
console.log('Unmapped errors:', unmapped.map(i => i.code));
```

---

## Performance Considerations

- **JSON Loading**: Mappings loaded once on first use (lazy loading)
- **Memory Usage**: ~50KB for full mapping dictionary
- **Lookup Time**: O(1) hash map lookup by aspect+code
- **No Runtime Overhead**: Substitution is simple string replacement

---

## Internationalization (Future)

The error mapping system is designed to support future internationalization:

```json
"mappings": {
  "en": { /* English mappings */ },
  "de": { /* German mappings */ },
  "es": { /* Spanish mappings */ }
}
```

Load appropriate language based on user preference or Accept-Language header.

---

## API Reference

### ErrorMappingEngine Methods

#### `loadMappings(): void`
Loads error mappings from JSON file. Called automatically on first use.

#### `enhanceIssue(issue, context): EnhancedValidationIssue`
Enhances a single validation issue with user-friendly error information.

**Parameters:**
- `issue`: Original ValidationIssue
- `context`: Optional error context (resourceType, fhirVersion, etc.)

**Returns:** EnhancedValidationIssue with userMessage, suggestedFixes, mapped flag

#### `enhanceIssues(issues, context): EnhancedValidationIssue[]`
Enhances multiple validation issues.

#### `getMapping(aspect, code): ErrorMapping | null`
Retrieves error mapping for specific aspect and code.

#### `hasMapping(aspect, code): boolean`
Checks if mapping exists for error code.

---

## Troubleshooting

### Mappings Not Loading
- **Check file exists**: `/server/config/error-mappings.json`
- **Check JSON syntax**: Use JSON validator
- **Check console logs**: Look for "[ErrorMappingEngine] Loaded..." message

### Variables Not Substituting
- **Check variable name**: Must match context property exactly
- **Check context passed**: Ensure context object has the required fields
- **Check spelling**: {code} vs {Code} (case-sensitive)

### Suggested Fixes Not Showing
- **Check suggestedFixes array**: Must be non-empty in JSON
- **Check UI component**: EnhancedValidationIssueCard must be used
- **Check mapping applied**: Look for "Enhanced" badge in UI

---

## Related Documentation

- [Validation Engine PRD](../requirements/prd-validation-engine.md)
- [Validation Engine Architecture](./validation-engine-architecture.md)
- [FHIR Validation Specification](https://hl7.org/fhir/validation.html)

---

## Version History

### 1.0.0 (October 2025)
- Initial release
- 20+ error codes mapped across 6 aspects
- Context variable substitution
- Suggested fixes system
- API endpoint for error explanations
- UI component for enhanced display

