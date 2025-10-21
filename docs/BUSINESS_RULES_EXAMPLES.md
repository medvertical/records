# Business Rules - Example Rules

This document provides instructions for adding example business rules to demonstrate the functionality of the Business Rules feature.

## Quick Start

To add example rules to your database, run the SQL migration:

```bash
# Using psql
psql -U your_username -d your_database -f migrations/0040_add_example_business_rules.sql

# Or using npm script (if configured)
npm run migrate
```

## Example Rules Included

### Patient Validation (3 rules)
1. **Patient Must Have Name** (Error)
   - FHIRPath: `Patient.name.exists()`
   - Ensures every patient has at least one name defined

2. **Patient Birth Date Required** (Warning)
   - FHIRPath: `Patient.birthDate.exists()`
   - Validates that patient has a birth date for age-based logic

3. **Patient Contact Information** (Info)
   - FHIRPath: `Patient.telecom.exists()`
   - Recommends that patients have contact information

### Clinical Validation (5 rules)
4. **Observation Must Have Value** (Error)
   - FHIRPath: `Observation.value.exists() or Observation.dataAbsentReason.exists()`
   - Ensures observations have either a value or a data absent reason

5. **Observation Effective Date** (Warning)
   - FHIRPath: `Observation.effective.exists()`
   - Validates that observations have an effective date or period

6. **Condition Clinical Status** (Error)
   - FHIRPath: `Condition.clinicalStatus.exists()`
   - Ensures conditions have a clinical status

7. **Condition Onset Information** (Info)
   - FHIRPath: `Condition.onset.exists()`
   - Recommends including when the condition started

8. **AllergyIntolerance Criticality** (Info, Disabled)
   - FHIRPath: `AllergyIntolerance.criticality.exists()`
   - Recommends specifying criticality for allergies

### Medication Validation (2 rules)
9. **Medication Request Dosage** (Warning)
   - FHIRPath: `MedicationRequest.dosageInstruction.exists()`
   - Ensures medication requests include dosage instructions

10. **Medication Request Intent** (Error)
    - FHIRPath: `MedicationRequest.intent.exists()`
    - Validates that medication request has an intent specified

### Encounter Validation (2 rules)
11. **Encounter Class Required** (Error)
    - FHIRPath: `Encounter.class.exists()`
    - Validates that encounters specify a class

12. **Encounter Period** (Warning)
    - FHIRPath: `Encounter.period.exists()`
    - Ensures encounters have a period defined

### Diagnostic Validation (1 rule)
13. **DiagnosticReport Status** (Error)
    - FHIRPath: `DiagnosticReport.status.exists()`
    - Validates that diagnostic reports have a status

### Procedure Validation (1 rule)
14. **Procedure Performed Date** (Error)
    - FHIRPath: `Procedure.performed.exists()`
    - Ensures procedures have a performed date or period

### Administrative Validation (1 rule)
15. **Practitioner Identifier** (Warning)
    - FHIRPath: `Practitioner.identifier.exists()`
    - Validates that practitioners have at least one identifier

## Summary Statistics

- **Total Rules**: 15
- **Error Severity**: 7 rules
- **Warning Severity**: 5 rules
- **Info Severity**: 3 rules
- **Enabled by Default**: 14 rules
- **Disabled by Default**: 1 rule (AllergyIntolerance Criticality)

## Viewing the Rules

After adding the example rules:

1. Open the application
2. Navigate to **Settings** → **Business Rules** tab
3. You should see all 15 example rules listed
4. Use the search and filter features to explore them
5. Try editing, duplicating, or creating new rules

## Testing Features

The example rules allow you to test all features of the Business Rules tab:

### Search & Filter
- Search by name: "Patient"
- Filter by severity: Error/Warning/Info
- Filter by resource type: Patient, Observation, etc.
- Filter by status: Enabled/Disabled

### CRUD Operations
- Edit any rule to modify its FHIRPath expression
- Duplicate rules to create variations
- Toggle rules enabled/disabled
- Delete rules you don't need

### Import/Export
- Export all rules to JSON
- Modify the JSON file
- Import it back to test the import feature

### Auto-Apply
- Toggle the auto-apply setting
- Rules will automatically run during validation when enabled

## Custom Rules

Feel free to modify these example rules or create your own! Here are some FHIRPath expressions you can use:

### Common Patterns

```fhirpath
# Check if field exists
Resource.field.exists()

# Check if field has specific value
Resource.field = 'value'

# Check multiple conditions (OR)
Resource.field1.exists() or Resource.field2.exists()

# Check multiple conditions (AND)
Resource.field1.exists() and Resource.field2.exists()

# Check array has items
Resource.field.count() > 0

# Check field is not empty
Resource.field.empty().not()

# Check nested fields
Resource.field.subfield.exists()

# Date comparisons
Resource.date > @2020-01-01
```

### Example Custom Rules

**Patient Age Validation**:
```fhirpath
Patient.birthDate.exists() and (today() - Patient.birthDate).years() < 120
```

**Observation Numeric Value Range**:
```fhirpath
Observation.value.ofType(Quantity).value >= 0
```

**Medication Active Status**:
```fhirpath
MedicationRequest.status = 'active' or MedicationRequest.status = 'completed'
```

## Troubleshooting

### Rules not showing up?
- Check that the migration ran successfully
- Check database connection
- Refresh the Business Rules tab

### Import fails?
- Ensure JSON format matches the export format
- Check that all required fields are present
- Review error messages in the import results

### Rule expression invalid?
- Use the "Test Expression" button in the editor
- Check FHIRPath syntax documentation
- Ensure you're using the correct resource type

## Resources

- [FHIRPath Specification](http://hl7.org/fhirpath/)
- [FHIR Resource Types](https://www.hl7.org/fhir/resourcelist.html)
- [FHIRPath Online Tester](https://fhirpath.fhirschool.org/)

