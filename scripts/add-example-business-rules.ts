/**
 * Script to add example business rules
 * Run with: npx tsx scripts/add-example-business-rules.ts
 */

const API_BASE = 'http://localhost:5000';

interface ExampleRule {
  name: string;
  description: string;
  fhirPath: string;
  severity: 'error' | 'warning' | 'information';
  resourceType: string;
  message: string;
  enabled: boolean;
  category: string;
}

const exampleRules: ExampleRule[] = [
  {
    name: 'Patient Must Have Name',
    description: 'Ensures every patient has at least one name defined',
    fhirPath: 'Patient.name.exists()',
    severity: 'error',
    resourceType: 'Patient',
    message: 'Patient resource must have at least one name',
    enabled: true,
    category: 'Patient Validation',
  },
  {
    name: 'Patient Birth Date Required',
    description: 'Validates that patient has a birth date for age-based logic',
    fhirPath: 'Patient.birthDate.exists()',
    severity: 'warning',
    resourceType: 'Patient',
    message: 'Patient should have a birth date defined',
    enabled: true,
    category: 'Patient Validation',
  },
  {
    name: 'Patient Contact Information',
    description: 'Recommends that patients have contact information (phone or email)',
    fhirPath: 'Patient.telecom.exists()',
    severity: 'information',
    resourceType: 'Patient',
    message: 'Consider adding patient contact information (phone, email)',
    enabled: true,
    category: 'Patient Validation',
  },
  {
    name: 'Observation Must Have Value',
    description: 'Ensures observations have either a value or a data absent reason',
    fhirPath: 'Observation.value.exists() or Observation.dataAbsentReason.exists()',
    severity: 'error',
    resourceType: 'Observation',
    message: 'Observation must have either a value or a data absent reason',
    enabled: true,
    category: 'Clinical Validation',
  },
  {
    name: 'Observation Effective Date',
    description: 'Validates that observations have an effective date or period',
    fhirPath: 'Observation.effective.exists()',
    severity: 'warning',
    resourceType: 'Observation',
    message: 'Observation should have an effective date or period',
    enabled: true,
    category: 'Clinical Validation',
  },
  {
    name: 'Medication Request Dosage',
    description: 'Ensures medication requests include dosage instructions',
    fhirPath: 'MedicationRequest.dosageInstruction.exists()',
    severity: 'warning',
    resourceType: 'MedicationRequest',
    message: 'MedicationRequest should include dosage instructions',
    enabled: true,
    category: 'Medication Validation',
  },
  {
    name: 'Medication Request Intent',
    description: 'Validates that medication request has an intent specified',
    fhirPath: 'MedicationRequest.intent.exists()',
    severity: 'error',
    resourceType: 'MedicationRequest',
    message: 'MedicationRequest must specify an intent (order, plan, etc.)',
    enabled: true,
    category: 'Medication Validation',
  },
  {
    name: 'Condition Clinical Status',
    description: 'Ensures conditions have a clinical status (active, resolved, etc.)',
    fhirPath: 'Condition.clinicalStatus.exists()',
    severity: 'error',
    resourceType: 'Condition',
    message: 'Condition must have a clinical status',
    enabled: true,
    category: 'Clinical Validation',
  },
  {
    name: 'Condition Onset Information',
    description: 'Recommends including when the condition started',
    fhirPath: 'Condition.onset.exists()',
    severity: 'information',
    resourceType: 'Condition',
    message: 'Consider specifying when the condition started (onset)',
    enabled: true,
    category: 'Clinical Validation',
  },
  {
    name: 'Encounter Class Required',
    description: 'Validates that encounters specify a class (inpatient, outpatient, etc.)',
    fhirPath: 'Encounter.class.exists()',
    severity: 'error',
    resourceType: 'Encounter',
    message: 'Encounter must specify a class (AMB, IMP, EMER, etc.)',
    enabled: true,
    category: 'Encounter Validation',
  },
  {
    name: 'Encounter Period',
    description: 'Ensures encounters have a period defined',
    fhirPath: 'Encounter.period.exists()',
    severity: 'warning',
    resourceType: 'Encounter',
    message: 'Encounter should have a period (start and/or end date)',
    enabled: true,
    category: 'Encounter Validation',
  },
  {
    name: 'AllergyIntolerance Criticality',
    description: 'Recommends specifying criticality for allergies',
    fhirPath: 'AllergyIntolerance.criticality.exists()',
    severity: 'information',
    resourceType: 'AllergyIntolerance',
    message: 'Consider specifying criticality (low, high, unable-to-assess)',
    enabled: false,
    category: 'Clinical Validation',
  },
  {
    name: 'DiagnosticReport Status',
    description: 'Validates that diagnostic reports have a status',
    fhirPath: 'DiagnosticReport.status.exists()',
    severity: 'error',
    resourceType: 'DiagnosticReport',
    message: 'DiagnosticReport must have a status',
    enabled: true,
    category: 'Diagnostic Validation',
  },
  {
    name: 'Procedure Performed Date',
    description: 'Ensures procedures have a performed date or period',
    fhirPath: 'Procedure.performed.exists()',
    severity: 'error',
    resourceType: 'Procedure',
    message: 'Procedure must specify when it was performed',
    enabled: true,
    category: 'Clinical Validation',
  },
  {
    name: 'Practitioner Identifier',
    description: 'Validates that practitioners have at least one identifier',
    fhirPath: 'Practitioner.identifier.exists()',
    severity: 'warning',
    resourceType: 'Practitioner',
    message: 'Practitioner should have at least one identifier (NPI, license, etc.)',
    enabled: true,
    category: 'Administrative Validation',
  },
];

async function createRule(rule: ExampleRule): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/validation/business-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`❌ Failed to create rule "${rule.name}":`, error.message || response.statusText);
      return;
    }

    const created = await response.json();
    console.log(`✅ Created rule: ${rule.name} (${rule.severity})`);
  } catch (error) {
    console.error(`❌ Error creating rule "${rule.name}":`, error);
  }
}

async function checkIfRulesExist(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/validation/business-rules`);
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.rules && data.rules.length > 0;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🚀 Adding example business rules...\n');

  // Check if rules already exist
  const rulesExist = await checkIfRulesExist();
  if (rulesExist) {
    console.log('⚠️  Business rules already exist. This will add more rules.');
    console.log('   To start fresh, delete existing rules first.\n');
  }

  // Create all example rules
  for (const rule of exampleRules) {
    await createRule(rule);
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n✨ Finished! Added ${exampleRules.length} example business rules.`);
  console.log('\n📋 Summary:');
  console.log(`   - Error rules: ${exampleRules.filter(r => r.severity === 'error').length}`);
  console.log(`   - Warning rules: ${exampleRules.filter(r => r.severity === 'warning').length}`);
  console.log(`   - Info rules: ${exampleRules.filter(r => r.severity === 'information').length}`);
  console.log(`   - Enabled: ${exampleRules.filter(r => r.enabled).length}`);
  console.log(`   - Disabled: ${exampleRules.filter(r => !r.enabled).length}`);
  console.log('\n🌐 Open the Business Rules tab in Settings to view and manage them.');
}

main().catch(console.error);

