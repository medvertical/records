# Error Mapping Process Documentation

## Overview

The Records FHIR Validation Platform uses an intelligent error mapping system to transform technical FHIR validation messages into user-friendly, actionable messages with German translations.

---

## What is Error Mapping?

Error mapping is the process of:
1. **Detecting** technical HAPI FHIR validation error codes
2. **Matching** them to predefined patterns in `error_map.json`
3. **Transforming** them into user-friendly messages
4. **Translating** them to German (DE) or keeping English (EN)
5. **Enriching** them with suggested fixes and documentation links

---

## Error Map Structure

### Location
`server/config/error_map.json`

### Schema

```json
{
  "error-code": {
    "en": "English message with {placeholder}",
    "de": "Deutsche Nachricht mit {platzhalter}",
    "severity": "error|warning|information",
    "category": "structural|profile|terminology|reference|business-rules|metadata",
    "suggestedFix": "How to fix this issue",
    "documentationUrl": "https://hl7.org/fhir/...",
    "pattern": "regex pattern for matching"
  }
}
```

### Example Entry

```json
{
  "invalid-email": {
    "en": "Invalid email format: {value}. Expected format: user@example.com",
    "de": "Ungültiges E-Mail-Format: {value}. Erwartetes Format: benutzer@beispiel.de",
    "severity": "error",
    "category": "structural",
    "suggestedFix": "Provide a valid email address in the format: user@domain.com",
    "documentationUrl": "https://hl7.org/fhir/datatypes.html#email",
    "pattern": "^email.*invalid$"
  }
}
```

---

## Error Categories

### 1. Structural Errors
**Description**: Issues with FHIR resource structure, required fields, data types.

**Examples**:
- Missing required fields (`identifier`, `status`, etc.)
- Invalid data types (string instead of integer)
- Invalid JSON structure
- Cardinality violations (0..1, 1..1, 0..*, 1..*)

**Codes**:
- `structure-missing-required`
- `structure-invalid-type`
- `structure-cardinality-min`
- `structure-cardinality-max`

### 2. Profile Errors
**Description**: Violations of FHIR profiles and Implementation Guides.

**Examples**:
- Missing profile-required fields
- Invalid slice discriminator
- Extension not allowed
- Profile constraint violation

**Codes**:
- `profile-constraint-violation`
- `profile-extension-not-allowed`
- `profile-slice-invalid`
- `profile-binding-strength`

### 3. Terminology Errors
**Description**: Issues with coded values, ValueSets, CodeSystems.

**Examples**:
- Code not in ValueSet
- Unknown CodeSystem
- Invalid code format
- Terminology server unreachable

**Codes**:
- `terminology-code-not-in-valueset`
- `terminology-unknown-codesystem`
- `terminology-invalid-code`
- `terminology-server-error`

### 4. Reference Errors
**Description**: Issues with resource references and relationships.

**Examples**:
- Broken reference (target not found)
- Invalid reference format
- Circular reference
- Cross-version reference

**Codes**:
- `reference-not-found`
- `reference-invalid-format`
- `reference-circular`
- `reference-version-mismatch`

### 5. Business Rules Errors
**Description**: Custom FHIRPath business rule violations.

**Examples**:
- Patient must have name
- Observation must have value
- Encounter must have period
- Custom organization rules

**Codes**:
- `business-rule-{ruleId}`
- Pattern: `^business-rule-.*`

### 6. Metadata Errors
**Description**: Issues with resource metadata (`meta.*` fields).

**Examples**:
- Missing `lastUpdated`
- Invalid `versionId` format
- Unauthorized `tag`
- Missing `security` label

**Codes**:
- `metadata-missing-lastupdated`
- `metadata-invalid-versionid`
- `metadata-unauthorized-tag`
- `metadata-missing-security`

---

## Mapping Process Flow

### Step 1: HAPI Validation
```
Resource → HAPI Validator → OperationOutcome
```

**Example OperationOutcome**:
```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "structure",
      "diagnostics": "Patient.identifier: minimum cardinality of 1 is required, but there are 0 instances",
      "expression": ["Patient.identifier"]
    }
  ]
}
```

### Step 2: Error Code Detection
```
diagnostics → pattern matching → error code
```

**Algorithm**:
1. Extract `diagnostics` and `code` from OperationOutcome issue
2. Try exact code match in `error_map.json`
3. If no match, try pattern matching (regex)
4. If still no match, use generic fallback

### Step 3: Pattern Matching

**Example Patterns**:
```json
{
  "structure-missing-required": {
    "pattern": "minimum cardinality of (\\d+) is required, but there are (\\d+)"
  },
  "terminology-code-not-in-valueset": {
    "pattern": "The code '([^']+)' is not in the value set '([^']+)'"
  }
}
```

**Captured Groups**:
- `\1`, `\2`, etc. → Available as `{0}`, `{1}`, etc. in message template

### Step 4: Placeholder Substitution

**Template**:
```json
{
  "en": "Missing required field: {field}. Minimum cardinality: {min}, found: {count}",
  "de": "Fehlendes Pflichtfeld: {field}. Minimale Kardinalität: {min}, gefunden: {count}"
}
```

**Substitution**:
- `{field}` → Extracted from `expression` (e.g., `Patient.identifier`)
- `{min}` → Captured from regex group 1
- `{count}` → Captured from regex group 2

**Result**:
```
EN: Missing required field: Patient.identifier. Minimum cardinality: 1, found: 0
DE: Fehlendes Pflichtfeld: Patient.identifier. Minimale Kardinalität: 1, gefunden: 0
```

### Step 5: Enrichment

Add metadata to mapped error:
- `suggestedFix`: How to resolve the issue
- `documentationUrl`: Link to relevant FHIR specification
- `category`: Error category (structural, profile, etc.)
- `severity`: Normalized severity (error, warning, information)

---

## Error Map Management

### Adding New Mappings

#### 1. Identify Unmapped Errors

Use the admin UI:
```
Settings → System → Unmapped Errors
```

Or API:
```bash
GET /api/validation/error-mapping/unmapped
```

#### 2. Create Mapping Entry

```json
{
  "new-error-code": {
    "en": "English message with {placeholder}",
    "de": "Deutsche Nachricht mit {platzhalter}",
    "severity": "error",
    "category": "structural",
    "suggestedFix": "How to fix",
    "documentationUrl": "https://...",
    "pattern": "regex pattern"
  }
}
```

#### 3. Test Mapping

Use the test endpoint:
```bash
POST /api/validation/error-mapping/test
Content-Type: application/json

{
  "diagnostics": "Patient.identifier: minimum cardinality of 1 is required, but there are 0 instances",
  "code": "structure",
  "expression": ["Patient.identifier"]
}
```

#### 4. Deploy

Commit changes to `error_map.json` and restart server (or hot-reload if enabled).

### Updating Existing Mappings

1. Locate entry in `error_map.json`
2. Update `en`, `de`, or other fields
3. Test with existing validation results
4. Deploy

### Removing Mappings

1. Remove entry from `error_map.json`
2. Errors will fall back to original HAPI message
3. Deploy

---

## Advanced Features

### Pattern Matching Examples

#### Example 1: Cardinality Violations

**Pattern**:
```regex
minimum cardinality of (\d+) is required, but there are (\d+)
```

**Matches**:
- "minimum cardinality of 1 is required, but there are 0"
- "minimum cardinality of 2 is required, but there are 1"

**Template**:
```json
{
  "en": "Field {field} is required (min: {0}), but found: {1}",
  "de": "Feld {field} ist erforderlich (min: {0}), aber gefunden: {1}"
}
```

#### Example 2: Code Not in ValueSet

**Pattern**:
```regex
The code '([^']+)' is not in the value set '([^']+)'
```

**Matches**:
- "The code 'ABC' is not in the value set 'http://hl7.org/fhir/ValueSet/gender'"

**Template**:
```json
{
  "en": "Code '{0}' is not valid for ValueSet '{1}'",
  "de": "Code '{0}' ist nicht gültig für ValueSet '{1}'"
}
```

### Fallback Chain

If no mapping found:
1. Try exact code match
2. Try pattern matching
3. Try category-based fallback
4. Use generic fallback message

**Generic Fallback**:
```json
{
  "generic-error": {
    "en": "Validation error: {diagnostics}",
    "de": "Validierungsfehler: {diagnostics}",
    "severity": "error",
    "category": "unknown"
  }
}
```

### Suggested Fix Generation

**Static Fixes**:
```json
{
  "suggestedFix": "Add an identifier with system and value"
}
```

**Dynamic Fixes**:
```json
{
  "suggestedFix": "Change {field} to a valid {type} value"
}
```

**With Placeholders**:
```json
{
  "suggestedFix": "Replace '{0}' with a code from ValueSet: {1}"
}
```

---

## Error Mapping Statistics

### Tracking Metrics

The platform tracks:
- **Mapped Errors**: Errors successfully mapped to `error_map.json`
- **Unmapped Errors**: Errors without mapping (fallback used)
- **Mapping Success Rate**: `mapped / (mapped + unmapped)`

### Viewing Statistics

#### Via UI
```
Settings → System → Error Mapping Statistics
```

#### Via API
```bash
GET /api/validation/error-mapping/stats
```

**Response**:
```json
{
  "totalErrors": 12543,
  "mappedErrors": 11892,
  "unmappedErrors": 651,
  "successRate": 0.948,
  "topMappedCodes": [
    "structure-missing-required",
    "terminology-code-not-in-valueset",
    "profile-constraint-violation"
  ],
  "topUnmappedCodes": [
    "custom-rule-123",
    "unknown-extension-xyz"
  ]
}
```

---

## Best Practices

### 1. Be Specific

**Bad**:
```json
{
  "en": "Invalid value",
  "de": "Ungültiger Wert"
}
```

**Good**:
```json
{
  "en": "Invalid email format: {value}. Expected: user@example.com",
  "de": "Ungültiges E-Mail-Format: {value}. Erwartet: benutzer@beispiel.de"
}
```

### 2. Provide Actionable Fixes

**Bad**:
```json
{
  "suggestedFix": "Fix the error"
}
```

**Good**:
```json
{
  "suggestedFix": "Add at least one identifier with 'system' and 'value' properties"
}
```

### 3. Use Consistent Terminology

Align with FHIR specification:
- "CodeSystem" not "Code System"
- "ValueSet" not "Value Set"
- "StructureDefinition" not "Structure Definition"

### 4. Include Documentation Links

Always provide a `documentationUrl`:
```json
{
  "documentationUrl": "https://hl7.org/fhir/R4/datatypes.html#Identifier"
}
```

### 5. Test Edge Cases

Test mappings with:
- Missing placeholders
- Invalid regex groups
- Unicode characters
- Long diagnostics messages

---

## Common Patterns

### Pattern Library

```json
{
  "cardinality-min": "minimum cardinality of (\\d+) is required, but there are (\\d+)",
  "cardinality-max": "maximum cardinality of (\\d+) is exceeded, found (\\d+)",
  "invalid-type": "expected type '([^']+)' but found '([^']+)'",
  "missing-field": "required field '([^']+)' is missing",
  "code-not-found": "code '([^']+)' not found in system '([^']+)'",
  "reference-not-found": "reference '([^']+)' could not be resolved",
  "invalid-format": "invalid format for '([^']+)', expected '([^']+)'"
}
```

---

## Troubleshooting

### Issue: Mapping Not Applied

**Symptoms**: Error message shows original HAPI message instead of mapped message.

**Solutions**:
1. Check error code matches exactly
2. Verify pattern regex is correct (test with regex101.com)
3. Check JSON syntax in `error_map.json`
4. Restart server to reload error map
5. Check logs for error map parsing errors

### Issue: Placeholder Not Substituted

**Symptoms**: Message shows `{placeholder}` instead of actual value.

**Solutions**:
1. Verify placeholder name matches extraction key
2. Check regex capture group index (`{0}`, `{1}`, etc.)
3. Ensure field name extraction works for `{field}`
4. Test with actual OperationOutcome issue

### Issue: German Translation Missing

**Symptoms**: German users see English messages.

**Solutions**:
1. Add `de` field to error map entry
2. Ensure all placeholders are included in German translation
3. Check `Accept-Language` header in request
4. Verify translation covers all edge cases

---

## Performance Considerations

### Caching

Error mappings are cached in memory:
- **Cache Size**: 10,000 entries (LRU)
- **TTL**: Indefinite (until server restart)
- **Hot Reload**: Supported via API

### Optimization Tips

1. **Use Exact Matches**: Faster than regex patterns
2. **Limit Pattern Complexity**: Avoid catastrophic backtracking
3. **Pre-compile Patterns**: Done automatically on load
4. **Monitor Unmapped Errors**: Indicates missing mappings

---

## Resources

- **FHIR OperationOutcome**: [https://hl7.org/fhir/operationoutcome.html](https://hl7.org/fhir/operationoutcome.html)
- **HAPI FHIR Validation**: [https://hapifhir.io/hapi-fhir/docs/validation/validation.html](https://hapifhir.io/hapi-fhir/docs/validation/validation.html)
- **Error Map JSON**: `server/config/error_map.json`
- **Admin UI**: Settings → System → Error Mapping

---

*Last Updated: 2025-01-10*
*Records Platform Version: MVP V1.2*

