# Error Mapping System Guide
**Task 12.2: How to add and manage error mappings**

## Overview

The Error Mapping System translates technical FHIR validation errors into user-friendly messages. It converts cryptic HAPI error codes into actionable, human-readable messages.

## How Error Mapping Works

### Before Mapping (Technical)
```
HAPI-1834: Constraint failed: dom-6: "A resource should have narrative for robust management"
Expression: text.div.exists()
```

### After Mapping (User-Friendly)
```
✅ Missing narrative text
📝 Add a text summary to help users understand this resource
💡 Suggested fix: Add <text><div>Summary here</div></text>
```

---

## Error Mapping Architecture

```
HAPI Validator Error
        ↓
Error Mapping Engine
        ↓
Pattern Matching (40+ patterns)
        ↓
User-Friendly Message
        ↓
Suggested Fix (optional)
```

---

## Adding Custom Error Mappings

### Step 1: Identify the Error Pattern

Run validation and look at the technical error:

```json
{
  "message": "HAPI-1234: The element 'Patient.name' is required",
  "severity": "error",
  "location": "Patient.name"
}
```

**Extract:**
- Error code: `HAPI-1234`
- Pattern: `element.*is required`
- Field: `Patient.name`

### Step 2: Create Mapping Pattern

**Location:** `server/config/error-mappings.json`

Add new mapping:

```json
{
  "pattern": "element.*'(.+)'.*is required",
  "userMessage": "Missing required field: {field}",
  "suggestedFix": "Add the {field} field to your resource",
  "severity": "error",
  "category": "structure"
}
```

**Pattern syntax:**
- Use regex for flexible matching
- Capture groups with `(...)` for field extraction
- `{field}` placeholder for captured value

### Step 3: Test the Mapping

Create test resource that triggers the error:

```json
{
  "resourceType": "Patient"
  // Missing 'name' field
}
```

Run validation:

```bash
POST /api/validate
{
  "resource": {...}
}
```

**Expected mapped error:**
```json
{
  "message": "Missing required field: name",
  "suggestedFix": "Add the name field to your resource",
  "severity": "error"
}
```

---

## Error Mapping Patterns

### Common Patterns

**1. Missing Required Field**
```json
{
  "pattern": "element.*'(.+)'.*is required",
  "userMessage": "Missing required field: {field}",
  "category": "required-field"
}
```

**2. Invalid Enum Value**
```json
{
  "pattern": "value.*'(.+)'.*not in.*value set",
  "userMessage": "Invalid value for {field}. Must be from allowed list.",
  "category": "invalid-enum"
}
```

**3. Invalid Reference**
```json
{
  "pattern": "reference.*'(.+)'.*could not be resolved",
  "userMessage": "Referenced resource not found: {reference}",
  "category": "broken-reference"
}
```

**4. Invalid Code System**
```json
{
  "pattern": "code.*'(.+)'.*not found in system",
  "userMessage": "Code {code} is not valid in this code system",
  "category": "invalid-code"
}
```

**5. Cardinality Violation**
```json
{
  "pattern": "element.*has cardinality.*but found (\\d+)",
  "userMessage": "Field has {count} values but should have different number",
  "category": "cardinality"
}
```

---

## Mapping Categories

### Structure Errors
- Missing required fields
- Invalid data types
- Cardinality violations
- Schema violations

### Terminology Errors
- Invalid codes
- Unknown code systems
- Invalid value set bindings
- Display name mismatches

### Profile Errors
- Profile conformance failures
- Slicing errors
- Extension errors
- Constraint violations

### Reference Errors
- Broken references
- Invalid reference types
- Circular references
- Version mismatches

---

## Programmatic Error Mapping

### Error Mapping Engine

**Location:** `server/services/validation/utils/error-mapping-engine.ts`

**Usage:**
```typescript
import { ErrorMappingEngine } from './error-mapping-engine';

const engine = new ErrorMappingEngine();

// Map an error
const mapped = engine.mapError({
  message: "HAPI-1234: The element 'Patient.name' is required",
  severity: "error"
});

console.log(mapped.userMessage);
// "Missing required field: name"
```

### Adding Mappings Programmatically

```typescript
engine.addMapping({
  pattern: /custom pattern/,
  userMessage: "User-friendly message",
  suggestedFix: "How to fix",
  severity: "error",
  category: "custom"
});
```

---

## Error Message Best Practices

### Writing Good Error Messages

✅ **Be specific** - Mention the exact field or issue  
✅ **Be actionable** - Tell user how to fix  
✅ **Be friendly** - Avoid technical jargon  
✅ **Be concise** - Short and clear  
✅ **Provide context** - Explain why it matters  

**Example:**

❌ **Bad:**
```
Error: dom-6 constraint violation at Patient
```

✅ **Good:**
```
Missing narrative text
Add a <text> element to help users understand this resource.
```

### Suggested Fix Guidelines

✅ **Provide examples** - Show correct format  
✅ **Be specific** - Exact field names  
✅ **Link to docs** - FHIR spec reference  
✅ **Show code** - JSON example if helpful  

**Example:**
```
Suggested Fix:
Add a name field:
{
  "name": [
    {
      "family": "Smith",
      "given": ["John"]
    }
  ]
}
```

---

## Monitoring Error Mappings

### Unmapped Errors

Track errors that don't have mappings:

```bash
GET /api/validation/errors/unmapped
```

**Response:**
```json
{
  "unmappedErrors": [
    {
      "pattern": "Unknown error XYZ-123",
      "count": 15,
      "lastSeen": "2024-10-16T10:00:00Z"
    }
  ]
}
```

**Action:** Create new mapping for frequently occurring unmapped errors

### Mapping Statistics

```bash
GET /api/validation/errors/mapping-stats
```

**Response:**
```json
{
  "totalMappings": 42,
  "mappedErrors": 1234,
  "unmappedErrors": 15,
  "mappingRate": 98.8
}
```

**Target:** >95% mapping rate

---

## Testing Error Mappings

### Unit Tests

**Location:** `server/services/validation/utils/__tests__/error-mapping-engine.test.ts`

```typescript
describe('Error Mapping', () => {
  it('should map missing required field error', () => {
    const error = {
      message: "The element 'Patient.name' is required"
    };
    
    const mapped = engine.mapError(error);
    
    expect(mapped.userMessage).toContain('Missing required field');
    expect(mapped.suggestedFix).toBeDefined();
  });
});
```

### Integration Tests

**Location:** `server/tests/integration/error-mapping-integration.test.ts`

Tests that mapped errors appear in validation results.

---

## Related Documentation

- [Validation Engine Architecture](../architecture/VALIDATION_ENGINE_ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

---

## Summary

The Error Mapping System:

✅ **Translates** technical errors to user-friendly messages  
✅ **40+ mappings** pre-configured  
✅ **Extensible** - Add custom mappings easily  
✅ **Monitored** - Track unmapped errors  
✅ **Tested** - Integration tests verify correctness  

**Makes validation errors understandable for all users!** 💡

