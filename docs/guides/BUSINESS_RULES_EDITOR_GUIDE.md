# Business Rules Editor User Guide
**Task 12.8: Complete guide for creating and managing custom FHIRPath validation rules**

## Overview

The Business Rules Editor allows you to create custom validation rules using FHIRPath expressions. These rules extend the validation engine with organization-specific or use-case-specific constraints.

## Accessing the Editor

**URL:** `http://localhost:3000/settings` → Business Rules tab

**Or directly via API:**
```bash
curl http://localhost:3000/api/validation/rules
```

---

## Creating a Rule

### Step 1: Open the Rule Editor

1. Navigate to **Settings** page
2. Click **Business Rules** tab
3. Click **Create New Rule** button

### Step 2: Fill in Rule Details

**Basic Information Tab:**
- **Rule Name:** Descriptive name (e.g., "Patient must have birthDate")
- **Description:** Detailed explanation of what the rule checks
- **Resource Type:** Select from dropdown (Patient, Observation, etc.)
- **FHIR Version:** R4, R5, or R6
- **Severity:** error | warning | information

**Example:**
```
Name: Patient birthDate required
Description: All patient resources must include a birthDate for age calculations
Resource Type: Patient
FHIR Version: R4
Severity: error
```

### Step 3: Write FHIRPath Expression

**FHIRPath Tab:**

Write your validation logic using FHIRPath:

```fhirpath
birthDate.exists()
```

**Autocomplete Support:**
- Type to see suggestions
- 40+ FHIRPath functions available
- Resource-specific field suggestions
- Keyword completion

**Example Expressions:**

**Check field exists:**
```fhirpath
name.exists()
```

**Check field has value:**
```fhirpath
name.family.exists() and name.given.exists()
```

**Conditional logic:**
```fhirpath
(gender = 'female').not() or (birthDate.exists())
```

**Complex validation:**
```fhirpath
identifier.where(system = 'http://example.org/mrn').exists()
```

### Step 4: Test the Rule

**Testing Tab:**

1. **Load Sample Resource:** Click "Load Sample" or paste JSON
2. **Execute Rule:** Click "Test Rule"
3. **View Results:** See if rule passes or fails

**Example:**
```json
{
  "resourceType": "Patient",
  "name": [{"family": "Smith"}]
  // Missing birthDate - rule should fail
}
```

**Expected Result:**
```
❌ Rule Failed
Message: "All patient resources must include a birthDate for age calculations"
```

### Step 5: Save the Rule

Click **Save Rule** button

**The rule is now active and will be applied to all Patient validations!**

---

## Managing Rules

### List All Rules

**UI:** Settings → Business Rules tab

**API:**
```bash
GET /api/validation/rules
```

**Response:**
```json
{
  "rules": [
    {
      "id": "rule-1",
      "name": "Patient birthDate required",
      "resourceType": "Patient",
      "fhirPathExpression": "birthDate.exists()",
      "enabled": true,
      "severity": "error"
    }
  ]
}
```

### Edit a Rule

1. Click **Edit** button on rule
2. Modify fields
3. Click **Save**

**API:**
```bash
PUT /api/validation/rules/:id
{
  "name": "Updated name",
  "enabled": false
}
```

### Delete a Rule

1. Click **Delete** button on rule
2. Confirm deletion

**API:**
```bash
DELETE /api/validation/rules/:id
```

### Enable/Disable a Rule

Toggle the **Enabled** switch

**API:**
```bash
PUT /api/validation/rules/:id
{
  "enabled": false
}
```

---

## FHIRPath Expression Guide

### Basic Syntax

**Field access:**
```fhirpath
name
name.family
name.given
```

**Existence check:**
```fhirpath
name.exists()
birthDate.exists()
```

**Value comparison:**
```fhirpath
gender = 'male'
active = true
```

**Logical operators:**
```fhirpath
name.exists() and birthDate.exists()
gender = 'male' or gender = 'female'
```

### Common Functions

**exists()** - Check if field has value
```fhirpath
name.exists()  // true if name is present
```

**empty()** - Check if field is empty
```fhirpath
name.empty()  // true if name is absent
```

**count()** - Count elements
```fhirpath
name.count() > 0
identifier.count() >= 1
```

**where()** - Filter elements
```fhirpath
identifier.where(system = 'http://example.org/mrn').exists()
telecom.where(system = 'email').exists()
```

**all()** - Check all elements match
```fhirpath
name.all(family.exists())
```

**matches()** - Regular expression
```fhirpath
identifier.value.matches('[0-9]{6}')
```

**length()** - String length
```fhirpath
name.family.length() > 2
```

---

## Example Rules

### Required Fields

**Patient must have name:**
```fhirpath
name.exists()
```

**Patient must have at least one identifier:**
```fhirpath
identifier.count() >= 1
```

**Observation must have code:**
```fhirpath
code.exists()
```

### Conditional Rules

**If gender is female, check for pregnancy status:**
```fhirpath
gender != 'female' or extension.where(url = 'http://example.org/pregnancy').exists()
```

**Active patients must have contact info:**
```fhirpath
active = false or telecom.exists()
```

### Data Quality Rules

**Patient family name must be >2 characters:**
```fhirpath
name.all(family.length() > 2)
```

**Email must be valid format:**
```fhirpath
telecom.where(system = 'email').all(value.matches('.+@.+\\..+'))
```

**MRN must be 6 digits:**
```fhirpath
identifier.where(system = 'http://example.org/mrn').all(value.matches('[0-9]{6}'))
```

### Cross-Field Validation

**BirthDate must be before deathDate:**
```fhirpath
deceased.empty() or birthDate < deceasedDateTime
```

**Observation value must match code:**
```fhirpath
code.coding.code = '8867-4' implies valueQuantity.exists()
```

---

## Rule Testing

### Interactive Testing

**In the UI:**
1. Create rule
2. Go to **Testing** tab
3. Load sample resource
4. Click **Test Rule**
5. See immediate results

**API Testing:**
```bash
POST /api/validation/rules/:id/test
{
  "resource": {
    "resourceType": "Patient",
    "name": [{"family": "Smith"}]
  }
}
```

**Response:**
```json
{
  "passed": true,
  "message": "Rule passed",
  "executionTime": 5
}
```

### Batch Testing

Test rule against multiple resources:

```bash
POST /api/validation/rules/:id/test-batch
{
  "resources": [
    {"resourceType": "Patient", ...},
    {"resourceType": "Patient", ...}
  ]
}
```

**Response:**
```json
{
  "totalResources": 2,
  "passed": 1,
  "failed": 1,
  "results": [...]
}
```

---

## Rule Library

### Pre-Built Rules

The editor includes a library of common rules:

**Patient Rules:**
- Patient must have name
- Patient must have identifier
- Patient birthDate required
- Patient contact info required if active

**Observation Rules:**
- Observation must have code
- Observation must have value or reason
- Observation effective time required

**Condition Rules:**
- Condition must have clinical status
- Condition must have verification status
- Condition must have code

**To use:** Click **Load from Library** and select a rule

---

## Rule Templates

### Available Templates

**1. Required Field Template**
```fhirpath
{fieldName}.exists()
```

**2. Conditional Logic Template**
```fhirpath
{condition} implies {consequence}
```

**3. Cross-Field Validation Template**
```fhirpath
{field1}.exists() and {field2}.exists()
```

**4. Value Range Template**
```fhirpath
{field} >= {min} and {field} <= {max}
```

**5. Regex Pattern Template**
```fhirpath
{field}.matches('{pattern}')
```

**To use:** Click **Load Template** and customize

---

## Troubleshooting

### Rule Not Executing

**Check:**
1. Rule is enabled
2. Resource type matches
3. FHIR version matches
4. Business rules aspect is enabled in settings

**Solution:**
```bash
# Check if aspect enabled
GET /api/validation/settings

# Should show:
{
  "aspects": {
    "businessRules": {"enabled": true}
  }
}
```

### FHIRPath Syntax Errors

**Common Issues:**

**Issue:** `Unexpected token`  
**Cause:** Syntax error in expression  
**Fix:** Check parentheses, quotes, operators

**Issue:** `Unknown function`  
**Cause:** Function name misspelled  
**Fix:** Use autocomplete or check FHIRPath spec

**Issue:** `Field not found`  
**Cause:** Field name doesn't exist on resource  
**Fix:** Check FHIR resource definition

### Rule Always Passes/Fails

**Check:**
1. Expression logic is correct
2. Field names match resource structure
3. Test with sample resources
4. Check execution logs

---

## Best Practices

### Rule Design

✅ **Keep rules simple** - One check per rule  
✅ **Use descriptive names** - Clear intent  
✅ **Test thoroughly** - Multiple resources  
✅ **Document well** - Explain why the rule exists  
✅ **Version appropriately** - Separate rules for R4/R5/R6  

### Performance

✅ **Avoid expensive operations** - Minimize loops  
✅ **Use where() efficiently** - Filter early  
✅ **Test performance** - Check execution time  
✅ **Enable caching** - Results are cached  

### Maintenance

✅ **Review regularly** - Keep rules current  
✅ **Disable unused rules** - Improve performance  
✅ **Export/import** - Share between systems  
✅ **Version control** - Track rule changes  

---

## API Reference

### Create Rule
```bash
POST /api/validation/rules
{
  "name": "My Rule",
  "resourceType": "Patient",
  "fhirPathExpression": "birthDate.exists()",
  "errorMessage": "Patient must have birthDate",
  "severity": "error"
}
```

### Update Rule
```bash
PUT /api/validation/rules/:id
{
  "enabled": false
}
```

### Delete Rule
```bash
DELETE /api/validation/rules/:id
```

### Test Rule
```bash
POST /api/validation/rules/:id/test
{
  "resource": {...}
}
```

### List Rules
```bash
GET /api/validation/rules
GET /api/validation/rules?resourceType=Patient
GET /api/validation/rules?enabled=true
```

---

## Advanced Features

### Rule Import/Export

**Export rules:**
```bash
GET /api/validation/rules/export
```

**Response:** JSON file with all rules

**Import rules:**
```bash
POST /api/validation/rules/import
{
  "rules": [...]
}
```

### Rule Versioning

Rules are versioned in the database:
- Each update creates a new version
- History is maintained
- Rollback supported (via API)

### Rule Statistics

```bash
GET /api/validation/rules/:id/stats
```

**Response:**
```json
{
  "ruleId": "rule-1",
  "executions": 1523,
  "passed": 1234,
  "failed": 289,
  "avgExecutionTime": 5
}
```

---

## Related Documentation

- [FHIRPath Specification](http://hl7.org/fhirpath/)
- [Validation Engine Architecture](../architecture/VALIDATION_ENGINE_ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

## Summary

The Business Rules Editor enables:

✅ **Custom validation logic** via FHIRPath  
✅ **Interactive rule creation** with autocomplete  
✅ **Real-time testing** with sample resources  
✅ **Rule library** with common patterns  
✅ **Templates** for quick start  
✅ **Import/export** for sharing  
✅ **API integration** for automation  

**Create powerful custom validation rules in minutes!** 🧠✨

