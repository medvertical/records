# FHIRPath Rule Authoring Guide

## Overview

This guide explains how to create, test, and deploy custom FHIRPath-based business rules for advanced FHIR resource validation in the Records Platform.

---

## What are Business Rules?

Business rules are custom validation constraints that go beyond standard FHIR structural and profile validation. They use **FHIRPath** expressions to enforce organization-specific policies, data quality requirements, and clinical guidelines.

### Examples
- "Every Patient must have at least one valid phone number or email"
- "Observation resources must have either a value or a dataAbsentReason"
- "Encounter period.end must be after period.start"
- "Medication requests must reference an active Practitioner"

---

## FHIRPath Basics

### What is FHIRPath?

FHIRPath is a path-based navigation language for FHIR resources, similar to XPath for XML. It allows you to:
- **Navigate** resource hierarchies
- **Filter** collections
- **Test** conditions
- **Extract** values

### Simple Examples

#### 1. Check if Field Exists
```fhirpath
name.exists()
```
Returns `true` if `name` field is present.

#### 2. Check Field Value
```fhirpath
status = 'active'
```
Returns `true` if status equals "active".

#### 3. Count Elements
```fhirpath
identifier.count() >= 1
```
Returns `true` if at least one identifier exists.

#### 4. Navigate Nested Fields
```fhirpath
name.given.exists()
```
Checks if `name.given` (first name) exists.

#### 5. Filter Collections
```fhirpath
telecom.where(system = 'email').exists()
```
Checks if an email contact point exists.

---

## Rule Structure

### Database Schema

```sql
CREATE TABLE business_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fhirpath_expression TEXT NOT NULL,
  resource_types TEXT[], -- ['Patient', 'Observation']
  severity VARCHAR(20) NOT NULL, -- 'error', 'warning', 'information'
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Rule Object

```typescript
interface BusinessRule {
  id: string;
  name: string;
  description: string;
  fhirPathExpression: string;
  resourceTypes: string[];
  severity: 'error' | 'warning' | 'information';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Creating Rules

### Method 1: Via UI

#### 1. Navigate to Business Rules
```
Settings → Rules → Add Rule
```

#### 2. Fill in Rule Details
- **Name**: "Patient Must Have Contact Info"
- **Description**: "Every patient must have at least one phone or email"
- **Resource Types**: `Patient`
- **Severity**: `Error`
- **FHIRPath Expression**:
  ```fhirpath
  telecom.where(system = 'phone' or system = 'email').exists()
  ```

#### 3. Test Rule
Click **Test Rule** and paste a sample Patient resource.

#### 4. Save and Enable
Click **Save** to create the rule. It's automatically enabled.

---

### Method 2: Via API

```bash
POST /api/business-rules
Content-Type: application/json

{
  "name": "Patient Must Have Contact Info",
  "description": "Every patient must have at least one phone or email",
  "fhirPathExpression": "telecom.where(system = 'phone' or system = 'email').exists()",
  "resourceTypes": ["Patient"],
  "severity": "error",
  "enabled": true
}
```

---

## Rule Examples

### Patient Rules

#### 1. Patient Must Have Name
```fhirpath
name.exists()
```

#### 2. Patient Must Have Family Name
```fhirpath
name.family.exists()
```

#### 3. Patient Must Have Valid Birthdate
```fhirpath
birthDate.exists() and birthDate <= today()
```

#### 4. Patient Must Have Identifier
```fhirpath
identifier.count() >= 1
```

#### 5. Patient Must Have Gender
```fhirpath
gender.exists() and gender in ('male' | 'female' | 'other' | 'unknown')
```

---

### Observation Rules

#### 1. Observation Must Have Value or DataAbsentReason
```fhirpath
value.exists() or dataAbsentReason.exists()
```

#### 2. Observation Must Have Code
```fhirpath
code.exists() and code.coding.exists()
```

#### 3. Observation Effective Date Must Be in Past
```fhirpath
effective.exists() and effective <= now()
```

#### 4. Observation Must Have Valid Status
```fhirpath
status in ('registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown')
```

#### 5. Vital Signs Must Have Numeric Value
```fhirpath
category.coding.where(code = 'vital-signs').exists() implies valueQuantity.value.exists()
```

---

### Encounter Rules

#### 1. Encounter Period End After Start
```fhirpath
period.end.empty() or period.start <= period.end
```

#### 2. Encounter Must Have Class
```fhirpath
class.exists()
```

#### 3. Encounter Must Have Valid Status
```fhirpath
status in ('planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown')
```

#### 4. Finished Encounter Must Have Period End
```fhirpath
status = 'finished' implies period.end.exists()
```

---

### Medication Rules

#### 1. MedicationRequest Must Have Medication
```fhirpath
medication.exists()
```

#### 2. MedicationRequest Must Have Dosage
```fhirpath
dosageInstruction.exists()
```

#### 3. Active Medication Must Have Prescriber
```fhirpath
status = 'active' implies requester.exists()
```

---

## Advanced FHIRPath

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `status = 'active'` |
| `!=` | Not equals | `status != 'cancelled'` |
| `>`, `<` | Comparison | `value > 0` |
| `>=`, `<=` | Comparison | `age >= 18` |
| `and`, `or` | Logical | `a and b` |
| `in` | Membership | `status in ('active' \| 'completed')` |
| `contains` | String contains | `name contains 'Smith'` |
| `~` | Equivalent | `code ~ 'http://loinc.org\|1234-5'` |

### Functions

#### Collection Functions

**`exists()`**: Check if any element exists
```fhirpath
name.exists()
```

**`empty()`**: Check if no elements exist
```fhirpath
name.empty()
```

**`count()`**: Count elements
```fhirpath
identifier.count() >= 2
```

**`first()`**: Get first element
```fhirpath
name.first().family
```

**`where()`**: Filter collection
```fhirpath
telecom.where(system = 'phone')
```

**`all()`**: Check if all elements match
```fhirpath
identifier.all(system.exists())
```

**`any()`**: Check if any element matches (same as `exists()`)
```fhirpath
identifier.any(use = 'official')
```

#### String Functions

**`matches()`**: Regex match
```fhirpath
identifier.value.matches('^[A-Z]{2}\\d{6}$')
```

**`contains()`**: Substring check
```fhirpath
name.family.contains('Smith')
```

**`startsWith()`**: Prefix check
```fhirpath
identifier.system.startsWith('http://hospital.org')
```

**`length()`**: String length
```fhirpath
name.family.length() <= 50
```

#### Math Functions

**`abs()`**: Absolute value
```fhirpath
valueQuantity.value.abs() > 0
```

**`ceiling()`**: Round up
```fhirpath
valueQuantity.value.ceiling()
```

**`floor()`**: Round down
```fhirpath
valueQuantity.value.floor()
```

**`round()`**: Round to nearest
```fhirpath
valueQuantity.value.round()
```

#### Date Functions

**`now()`**: Current date/time
```fhirpath
effective <= now()
```

**`today()`**: Current date
```fhirpath
birthDate <= today()
```

---

## Testing Rules

### Test Mode

Use test mode to validate rules against sample resources without saving.

#### Via UI
1. Navigate to **Settings → Rules**
2. Click **Test Rule** on any rule
3. Paste sample FHIR resource JSON
4. Click **Evaluate**
5. View result (true/false) and execution time

#### Via API
```bash
POST /api/business-rules/test
Content-Type: application/json

{
  "fhirPathExpression": "telecom.where(system = 'email').exists()",
  "resource": {
    "resourceType": "Patient",
    "id": "example",
    "telecom": [
      {
        "system": "email",
        "value": "patient@example.com"
      }
    ]
  }
}
```

**Response**:
```json
{
  "result": true,
  "executionTime": 3,
  "error": null
}
```

---

## Rule Execution

### Validation Flow

1. **Resource Submitted** for validation
2. **Determine Resource Type** (Patient, Observation, etc.)
3. **Load Active Rules** for resource type
4. **Execute FHIRPath** expressions
5. **Collect Results** (pass/fail)
6. **Generate Validation Messages** for failures
7. **Store Results** in database

### Execution Context

Each rule runs with:
- **Resource**: The FHIR resource being validated
- **Timeout**: 5 seconds (configurable)
- **Isolation**: Separate context per rule

### Performance

- **Sequential Execution**: Rules run one-by-one
- **Early Exit**: Stops on first critical error (optional)
- **Caching**: Rule compilation cached
- **Timeout**: Rules exceeding timeout are terminated

---

## Rule Management

### Enable/Disable Rules

#### Via UI
Toggle the switch next to each rule in **Settings → Rules**.

#### Via API
```bash
PATCH /api/business-rules/{ruleId}
Content-Type: application/json

{
  "enabled": false
}
```

### Update Rules

#### Via UI
1. Click **Edit** on rule
2. Modify expression or metadata
3. Click **Save**

#### Via API
```bash
PUT /api/business-rules/{ruleId}
Content-Type: application/json

{
  "name": "Updated Rule Name",
  "fhirPathExpression": "new.expression()"
}
```

### Delete Rules

#### Via UI
Click **Delete** on rule and confirm.

#### Via API
```bash
DELETE /api/business-rules/{ruleId}
```

---

## Best Practices

### 1. Be Specific

**Bad**:
```fhirpath
name.exists()
```

**Good**:
```fhirpath
name.exists() and name.family.exists() and name.given.exists()
```

### 2. Handle Edge Cases

**Bad**:
```fhirpath
period.start < period.end
```

**Good**:
```fhirpath
period.end.empty() or period.start <= period.end
```

### 3. Use Descriptive Names

**Bad**: "Rule 1"  
**Good**: "Patient Must Have Contact Information"

### 4. Add Helpful Descriptions

**Bad**: "Checks names"  
**Good**: "Ensures every patient has both family and given names for proper identification"

### 5. Test Thoroughly

Test with:
- Valid resources (should pass)
- Invalid resources (should fail)
- Edge cases (empty arrays, null values)
- Performance (large resources)

### 6. Use Appropriate Severity

- **Error**: Must be fixed (blocks workflow)
- **Warning**: Should be reviewed (doesn't block)
- **Information**: Nice to know (optional)

### 7. Avoid Overly Complex Rules

**Bad** (complex, hard to maintain):
```fhirpath
(telecom.where(system = 'phone').exists() or telecom.where(system = 'email').exists()) and (identifier.where(use = 'official').exists() or identifier.where(type.coding.code = 'MR').exists())
```

**Good** (split into multiple rules):
```fhirpath
// Rule 1
telecom.where(system = 'phone' or system = 'email').exists()

// Rule 2
identifier.where(use = 'official' or type.coding.code = 'MR').exists()
```

---

## Troubleshooting

### Issue: Rule Always Fails

**Symptoms**: Rule fails even for valid resources.

**Solutions**:
1. Test expression with sample resource
2. Check for typos in field names (case-sensitive)
3. Verify resource type matches
4. Check FHIRPath syntax (use online evaluators)

### Issue: Rule Times Out

**Symptoms**: Validation takes > 5 seconds per resource.

**Solutions**:
1. Simplify FHIRPath expression
2. Avoid complex nested `where()` clauses
3. Split into multiple simpler rules
4. Increase timeout in settings (if necessary)

### Issue: Rule Not Applied

**Symptoms**: Rule doesn't appear in validation results.

**Solutions**:
1. Verify rule is enabled
2. Check resource type matches
3. Verify rule was saved correctly
4. Check for JavaScript errors in browser console
5. Restart validation service

---

## Common Patterns

### Pattern 1: Required Field
```fhirpath
{field}.exists()
```

### Pattern 2: Required Field with Value
```fhirpath
{field}.exists() and {field}.count() > 0
```

### Pattern 3: Conditional Requirement
```fhirpath
{condition} implies {requirement}
```

Example:
```fhirpath
status = 'active' implies medication.exists()
```

### Pattern 4: Either/Or Requirement
```fhirpath
{field1}.exists() or {field2}.exists()
```

### Pattern 5: Date Range Check
```fhirpath
{dateField}.empty() or ({dateField} >= {minDate} and {dateField} <= {maxDate})
```

### Pattern 6: Regex Validation
```fhirpath
{field}.matches('{regex pattern}')
```

Example:
```fhirpath
identifier.value.matches('^[A-Z]{3}\\d{6}$')
```

---

## Resources

### FHIRPath Specification
- **Official Spec**: [http://hl7.org/fhirpath/](http://hl7.org/fhirpath/)
- **Grammar**: [http://hl7.org/fhirpath/grammar.html](http://hl7.org/fhirpath/grammar.html)

### Online Tools
- **FHIRPath Evaluator**: [https://fhirpath-lab.github.io/](https://fhirpath-lab.github.io/)
- **FHIR Validator**: [https://validator.fhir.org/](https://validator.fhir.org/)

### FHIR Resources
- **Patient**: [https://hl7.org/fhir/patient.html](https://hl7.org/fhir/patient.html)
- **Observation**: [https://hl7.org/fhir/observation.html](https://hl7.org/fhir/observation.html)
- **Encounter**: [https://hl7.org/fhir/encounter.html](https://hl7.org/fhir/encounter.html)

### Records Platform
- **Business Rules UI**: Settings → Rules
- **API Documentation**: `/api/docs`
- **Example Rules**: `server/config/sample-business-rules.json`

---

## Appendix: FHIRPath Quick Reference

### Navigation
- `.` - Navigate to child element
- `[]` - Filter/index collection

### Operators
- `=`, `!=` - Equality
- `>`, `<`, `>=`, `<=` - Comparison
- `and`, `or`, `xor` - Logical
- `in` - Membership
- `contains` - String contains
- `~` - Equivalence

### Functions
- `exists()`, `empty()` - Existence
- `count()`, `first()`, `last()` - Collection
- `where()`, `all()`, `any()` - Filtering
- `matches()`, `startsWith()` - String
- `now()`, `today()` - Date/Time

---

*Last Updated: 2025-01-10*
*Records Platform Version: MVP V1.2*

