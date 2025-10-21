-- Migration: Add Example Business Rules
-- Description: Inserts example business rules to demonstrate the functionality

INSERT INTO business_rules (
  rule_id,
  name,
  description,
  expression,
  resource_types,
  severity,
  enabled,
  category,
  version,
  created_at,
  updated_at
) VALUES
  -- Patient Validation Rules
  (
    'patient-name-required',
    'Patient Must Have Name',
    'Ensures every patient has at least one name defined',
    'Patient.name.exists()',
    ARRAY['Patient'],
    'error',
    true,
    'Patient Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'patient-birthdate-recommended',
    'Patient Birth Date Required',
    'Validates that patient has a birth date for age-based logic',
    'Patient.birthDate.exists()',
    ARRAY['Patient'],
    'warning',
    true,
    'Patient Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'patient-contact-info',
    'Patient Contact Information',
    'Recommends that patients have contact information (phone or email)',
    'Patient.telecom.exists()',
    ARRAY['Patient'],
    'info',
    true,
    'Patient Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Observation Validation Rules
  (
    'observation-value-required',
    'Observation Must Have Value',
    'Ensures observations have either a value or a data absent reason',
    'Observation.value.exists() or Observation.dataAbsentReason.exists()',
    ARRAY['Observation'],
    'error',
    true,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'observation-effective-date',
    'Observation Effective Date',
    'Validates that observations have an effective date or period',
    'Observation.effective.exists()',
    ARRAY['Observation'],
    'warning',
    true,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Medication Validation Rules
  (
    'medication-request-dosage',
    'Medication Request Dosage',
    'Ensures medication requests include dosage instructions',
    'MedicationRequest.dosageInstruction.exists()',
    ARRAY['MedicationRequest'],
    'warning',
    true,
    'Medication Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'medication-request-intent',
    'Medication Request Intent',
    'Validates that medication request has an intent specified',
    'MedicationRequest.intent.exists()',
    ARRAY['MedicationRequest'],
    'error',
    true,
    'Medication Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Condition Validation Rules
  (
    'condition-clinical-status',
    'Condition Clinical Status',
    'Ensures conditions have a clinical status (active, resolved, etc.)',
    'Condition.clinicalStatus.exists()',
    ARRAY['Condition'],
    'error',
    true,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'condition-onset-info',
    'Condition Onset Information',
    'Recommends including when the condition started',
    'Condition.onset.exists()',
    ARRAY['Condition'],
    'info',
    true,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Encounter Validation Rules
  (
    'encounter-class-required',
    'Encounter Class Required',
    'Validates that encounters specify a class (inpatient, outpatient, etc.)',
    'Encounter.class.exists()',
    ARRAY['Encounter'],
    'error',
    true,
    'Encounter Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  (
    'encounter-period',
    'Encounter Period',
    'Ensures encounters have a period defined',
    'Encounter.period.exists()',
    ARRAY['Encounter'],
    'warning',
    true,
    'Encounter Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- AllergyIntolerance Validation Rules
  (
    'allergy-criticality',
    'AllergyIntolerance Criticality',
    'Recommends specifying criticality for allergies',
    'AllergyIntolerance.criticality.exists()',
    ARRAY['AllergyIntolerance'],
    'info',
    false,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- DiagnosticReport Validation Rules
  (
    'diagnostic-report-status',
    'DiagnosticReport Status',
    'Validates that diagnostic reports have a status',
    'DiagnosticReport.status.exists()',
    ARRAY['DiagnosticReport'],
    'error',
    true,
    'Diagnostic Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Procedure Validation Rules
  (
    'procedure-performed-date',
    'Procedure Performed Date',
    'Ensures procedures have a performed date or period',
    'Procedure.performed.exists()',
    ARRAY['Procedure'],
    'error',
    true,
    'Clinical Validation',
    '1.0.0',
    NOW(),
    NOW()
  ),
  
  -- Practitioner Validation Rules
  (
    'practitioner-identifier',
    'Practitioner Identifier',
    'Validates that practitioners have at least one identifier',
    'Practitioner.identifier.exists()',
    ARRAY['Practitioner'],
    'warning',
    true,
    'Administrative Validation',
    '1.0.0',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

