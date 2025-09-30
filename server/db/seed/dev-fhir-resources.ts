import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { 
  validationResultsPerAspect, 
  validationMessages, 
  validationMessageGroups 
} from '../../../shared/schema-validation-per-aspect';
import { fhirServers } from '../../../shared/schema';
import { eq } from 'drizzle-orm';
import { 
  generateSettingsSnapshotHash, 
  generateMessageSignature,
  defaultSettingsHash 
} from './validation-fixtures';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const db = drizzle(pool);

/**
 * Realistic FHIR validation scenarios for development
 */

// Scenario 1: Patient with structural errors
const patientStructuralErrors = {
  resourceType: 'Patient',
  resources: [
    {
      fhirId: 'pat-missing-name',
      aspect: 'structural',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      messages: [
        {
          severity: 'error' as const,
          code: 'required',
          path: 'Patient.name',
          text: 'Patient.name: minimum required = 1, but only found 0 (from http://hl7.org/fhir/StructureDefinition/Patient)',
          ruleId: 'dom-6',
        }
      ]
    },
    {
      fhirId: 'pat-invalid-identifier',
      aspect: 'structural',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      messages: [
        {
          severity: 'error' as const,
          code: 'structure',
          path: 'Patient.identifier[0]',
          text: 'Identifier.system is required when value is present',
          ruleId: 'ident-1',
        }
      ]
    }
  ]
};

// Scenario 2: Observation with terminology warnings
const observationTerminologyWarnings = {
  resourceType: 'Observation',
  resources: [
    {
      fhirId: 'obs-unknown-loinc',
      aspect: 'terminology',
      isValid: true,
      errorCount: 0,
      warningCount: 1,
      informationCount: 0,
      score: 90,
      messages: [
        {
          severity: 'warning' as const,
          code: 'code-unknown',
          path: 'Observation.code.coding[0].code',
          text: 'The code "99999-9" is not found in the LOINC value set http://loinc.org',
          ruleId: undefined,
        }
      ]
    },
    {
      fhirId: 'obs-invalid-unit',
      aspect: 'terminology',
      isValid: true,
      errorCount: 0,
      warningCount: 1,
      informationCount: 0,
      score: 90,
      messages: [
        {
          severity: 'warning' as const,
          code: 'code-invalid',
          path: 'Observation.valueQuantity.code',
          text: 'The unit code "XYZ" is not a valid UCUM unit',
          ruleId: undefined,
        }
      ]
    }
  ]
};

// Scenario 3: MedicationRequest with reference errors
const medicationRequestReferenceErrors = {
  resourceType: 'MedicationRequest',
  resources: [
    {
      fhirId: 'medreq-broken-ref',
      aspect: 'reference',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      messages: [
        {
          severity: 'error' as const,
          code: 'ref-invalid',
          path: 'MedicationRequest.subject',
          text: 'Unable to resolve reference to Patient/non-existent-patient',
          ruleId: undefined,
        }
      ]
    }
  ]
};

// Scenario 4: Condition with profile validation warnings
const conditionProfileWarnings = {
  resourceType: 'Condition',
  resources: [
    {
      fhirId: 'cond-profile-mismatch',
      aspect: 'profile',
      isValid: true,
      errorCount: 0,
      warningCount: 2,
      informationCount: 0,
      score: 80,
      messages: [
        {
          severity: 'warning' as const,
          code: 'profile-mismatch',
          path: 'Condition.category',
          text: 'Condition.category: minimum required = 1 for profile http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition',
          ruleId: undefined,
        },
        {
          severity: 'warning' as const,
          code: 'profile-element',
          path: 'Condition.onsetDateTime',
          text: 'Condition.onsetDateTime is recommended by US Core profile but not present',
          ruleId: undefined,
        }
      ]
    }
  ]
};

// Scenario 5: DiagnosticReport with business rule errors
const diagnosticReportBusinessRules = {
  resourceType: 'DiagnosticReport',
  resources: [
    {
      fhirId: 'dr-conflicting-dates',
      aspect: 'businessRule',
      isValid: false,
      errorCount: 1,
      warningCount: 0,
      informationCount: 0,
      score: 0,
      messages: [
        {
          severity: 'error' as const,
          code: 'business-rule',
          path: 'DiagnosticReport',
          text: 'DiagnosticReport.effectiveDateTime must be before or equal to DiagnosticReport.issued',
          ruleId: 'dr-1',
        }
      ]
    }
  ]
};

// Scenario 6: Valid resources (all aspects pass)
const validResources = {
  resources: [
    {
      resourceType: 'Patient',
      fhirId: 'pat-valid-complete',
      aspects: [
        { aspect: 'structural', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
        { aspect: 'profile', isValid: true, errorCount: 0, warningCount: 0, informationCount: 1, score: 100, messages: [
          { severity: 'information' as const, code: 'info', path: 'Patient', text: 'Resource validates against base FHIR Patient profile', ruleId: undefined }
        ]},
        { aspect: 'terminology', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
        { aspect: 'reference', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
      ]
    },
    {
      resourceType: 'Observation',
      fhirId: 'obs-valid-vitals',
      aspects: [
        { aspect: 'structural', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
        { aspect: 'terminology', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
        { aspect: 'reference', isValid: true, errorCount: 0, warningCount: 0, informationCount: 0, score: 100, messages: [] },
      ]
    }
  ]
};

/**
 * Seed realistic FHIR validation data
 */
async function seedDevFhirData() {
  try {
    console.log('🌱 Seeding development FHIR validation data...\n');
    
    // Get or create dev server
    let servers = await db.select().from(fhirServers).where(eq(fhirServers.name, 'Dev Server')).limit(1);
    
    let serverId: number;
    if (servers.length === 0) {
      console.log('Creating Dev Server...');
      const [newServer] = await db.insert(fhirServers).values({
        name: 'Dev Server',
        url: 'http://localhost:8080/fhir',
        isActive: true,
      }).returning();
      serverId = newServer.id;
      console.log(`✅ Created Dev Server (ID: ${serverId})\n`);
    } else {
      serverId = servers[0].id;
      console.log(`Using existing Dev Server (ID: ${serverId})\n`);
    }
    
    let totalResults = 0;
    let totalMessages = 0;
    let totalGroups = 0;
    
    // Helper to create validation result and messages
    async function createValidationData(resourceType: string, scenario: any) {
      for (const resource of scenario.resources) {
        const aspects = resource.aspects || [{ 
          aspect: resource.aspect, 
          isValid: resource.isValid,
          errorCount: resource.errorCount,
          warningCount: resource.warningCount,
          informationCount: resource.informationCount,
          score: resource.score,
          messages: resource.messages
        }];
        
        for (const aspectData of aspects) {
          // Insert validation result
          const [result] = await db.insert(validationResultsPerAspect).values({
            serverId,
            resourceType,
            fhirId: resource.fhirId,
            aspect: aspectData.aspect,
            isValid: aspectData.isValid,
            errorCount: aspectData.errorCount,
            warningCount: aspectData.warningCount,
            informationCount: aspectData.informationCount,
            score: aspectData.score,
            settingsSnapshotHash: defaultSettingsHash,
            durationMs: Math.floor(Math.random() * 500) + 50, // Random 50-550ms
            validationEngineVersion: '1.0.0',
          }).returning();
          
          totalResults++;
          
          // Insert messages
          for (const msg of aspectData.messages) {
            const canonicalPath = msg.path.replace(/\[\d+\]/g, '').toLowerCase();
            const normalizedText = msg.text.trim().replace(/\s+/g, ' ').toLowerCase();
            
            const signature = generateMessageSignature(
              aspectData.aspect,
              msg.severity,
              msg.code,
              canonicalPath,
              msg.ruleId,
              normalizedText
            );
            
            await db.insert(validationMessages).values({
              validationResultId: result.id,
              serverId,
              resourceType,
              fhirId: resource.fhirId,
              aspect: aspectData.aspect,
              severity: msg.severity,
              code: msg.code,
              canonicalPath,
              text: msg.text,
              normalizedText,
              ruleId: msg.ruleId,
              signature,
              signatureVersion: 1,
              pathTruncated: false,
              textTruncated: false,
            });
            
            totalMessages++;
            
            // Create/update group
            const existingGroup = await db.select().from(validationMessageGroups)
              .where(eq(validationMessageGroups.signature, signature))
              .limit(1);
            
            if (existingGroup.length === 0) {
              await db.insert(validationMessageGroups).values({
                serverId,
                signature,
                signatureVersion: 1,
                aspect: aspectData.aspect,
                severity: msg.severity,
                code: msg.code,
                canonicalPath,
                sampleText: msg.text,
                totalResources: 1,
              });
              totalGroups++;
            } else {
              await db.update(validationMessageGroups)
                .set({ totalResources: existingGroup[0].totalResources + 1 })
                .where(eq(validationMessageGroups.id, existingGroup[0].id));
            }
          }
        }
      }
    }
    
    // Seed all scenarios
    console.log('📝 Seeding validation scenarios...\n');
    
    console.log('  - Patient with structural errors...');
    await createValidationData('Patient', patientStructuralErrors);
    
    console.log('  - Observation with terminology warnings...');
    await createValidationData('Observation', observationTerminologyWarnings);
    
    console.log('  - MedicationRequest with reference errors...');
    await createValidationData('MedicationRequest', medicationRequestReferenceErrors);
    
    console.log('  - Condition with profile warnings...');
    await createValidationData('Condition', conditionProfileWarnings);
    
    console.log('  - DiagnosticReport with business rule errors...');
    await createValidationData('DiagnosticReport', diagnosticReportBusinessRules);
    
    console.log('  - Valid resources (all aspects pass)...');
    await createValidationData('Patient', { resources: validResources.resources.filter(r => r.resourceType === 'Patient') });
    await createValidationData('Observation', { resources: validResources.resources.filter(r => r.resourceType === 'Observation') });
    
    console.log('\n🎉 Development data seeding completed!\n');
    console.log('Summary:');
    console.log(`  ✅ Validation Results: ${totalResults}`);
    console.log(`  ✅ Messages: ${totalMessages}`);
    console.log(`  ✅ Message Groups: ${totalGroups}`);
    console.log(`  ✅ Server: ${serverId} (Dev Server)\n`);
    
    console.log('Coverage:');
    console.log('  - Structural errors (Patient)');
    console.log('  - Terminology warnings (Observation)');
    console.log('  - Reference errors (MedicationRequest)');
    console.log('  - Profile warnings (Condition)');
    console.log('  - Business rule errors (DiagnosticReport)');
    console.log('  - Valid resources (Patient, Observation)\n');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seedDevFhirData().catch(console.error);
}

export { seedDevFhirData };
